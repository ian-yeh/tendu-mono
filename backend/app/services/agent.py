"""Agent service - Orchestrates test execution using browser, LLM, and emitter services."""
import asyncio
import time
from datetime import datetime

from app.models import Action
from app.store import store
from app.services.browser import BrowserController
from app.services.llm import LLMClient
from app.services.emitter import EventEmitter


class Agent:
    """Orchestrates the test automation loop using injected services."""
    
    TURN_LIMIT = 50
    
    def __init__(self):
        self.browser: BrowserController | None = None
        self.llm: LLMClient | None = None
        self.emitter: EventEmitter | None = None
        self.history: list[dict] = []
        self.test_id: str = ""
        self.url: str = ""
        self.focus: str = ""
    
    def run(self, test_id: str, url: str, focus: str, sio, loop) -> None:
        """
        Run the test agent synchronously (called from thread pool).
        
        Args:
            test_id: Unique test identifier
            url: Target URL to test
            focus: Test objective/focus
            sio: Socket.IO instance
            loop: Async event loop for emissions
        """
        # Initialize state
        self.test_id = test_id
        self.url = url
        self.focus = focus
        self.history = []
        
        # Initialize services
        self.browser = BrowserController()
        self.llm = LLMClient()
        self.emitter = EventEmitter(sio, loop, test_id)
        
        try:
            # Validate test exists
            test_run = store.get(test_id)
            if not test_run:
                raise ValueError(f"Test run {test_id} not found")
            
            # Launch browser and navigate
            self.browser.launch()
            self.browser.goto(url)
            
            # Emit initial navigation action
            initial_screenshot = self.browser.screenshot()
            self._emit_action("navigate", url, None, initial_screenshot)
            
            # Run the agent loop
            test_completed = self._run_loop()
            
            # Handle timeout if not completed
            if not test_completed:
                self._handle_timeout()
            
            # Cleanup
            self.browser.close()
            time.sleep(5)
            
            # Mark complete
            self.emitter.emit_complete()
            
        except Exception as e:
            self._handle_error(e)
    
    def _run_loop(self) -> bool:
        """Run the main agent loop. Returns True if test completed normally."""
        for turn in range(self.TURN_LIMIT):
            print(f"Turn {turn + 1}/{self.TURN_LIMIT}")
            
            # Get current state
            screenshot = self.browser.screenshot()
            current_url = self.browser.current_url
            
            # Ask LLM for decision
            decision = self.llm.decide(screenshot, self.focus, current_url, self.history)
            
            if not decision:
                print("Failed to parse model response, retrying...")
                continue
            
            action_name = decision.get("action", "")
            args = decision.get("args", {})
            reasoning = decision.get("reasoning", "")
            observation = decision.get("observation", "")
            
            # Check if done
            if action_name == "done":
                return self._handle_done(decision)
            
            # Execute action
            result = self.browser.execute_action(action_name, args)
            
            # Take screenshot after action and emit
            action_screenshot = self.browser.screenshot()
            self._emit_action(action_name, result.get('element', ''), reasoning, action_screenshot)
            
            # Update history
            self.history.append({
                "action": action_name,
                "args": args,
                "observation": observation,
                "result": result
            })
        
        return False  # Did not complete within turn limit
    
    def _handle_done(self, decision: dict) -> bool:
        """Handle the 'done' action from LLM."""
        args = decision.get("args", {})
        reasoning = decision.get("reasoning", "")
        success = args.get("success", True)
        message = args.get("message", "Test completed")
        
        print(f"Test {'passed' if success else 'failed'}: {message}")
        
        final_screenshot = self.browser.screenshot()
        self._emit_action("done", message, reasoning, final_screenshot)
        
        return True
    
    def _handle_timeout(self) -> None:
        """Handle test timeout when turn limit is reached."""
        timeout_screenshot = self.browser.screenshot()
        reasoning = f"The test did not complete within {self.TURN_LIMIT} turns. The agent may need more steps or encountered an issue."
        
        self._emit_action("done", "Test reached maximum turn limit", reasoning, timeout_screenshot)
        print(f"Emitting timeout action")
    
    def _handle_error(self, error: Exception) -> None:
        """Handle test execution error."""
        import traceback
        print(f"Agent error: {str(error)}")
        traceback.print_exc()
        
        # Try to capture error screenshot
        error_screenshot = None
        if self.browser and self.browser._page:
            try:
                error_screenshot = self.browser.screenshot()
                print("Successfully captured error screenshot")
            except Exception as screenshot_error:
                print(f"Could not capture error screenshot: {screenshot_error}")
        
        # Emit error action
        try:
            self._emit_action(
                "done", 
                "Test failed with error", 
                f"An error occurred during test execution: {str(error)}",
                error_screenshot
            )
        except Exception as action_error:
            print(f"Failed to emit error action: {action_error}")
        
        # Emit error event
        if self.emitter:
            self.emitter.emit_error(str(error))
    
    def _emit_action(self, action_type: str, element: str, reasoning: str | None, screenshot: str | None) -> None:
        """Create and emit an action."""
        action = Action(
            type=action_type,
            element=element,
            reasoning=reasoning,
            screenshot=screenshot,
            timestamp=datetime.now()
        )
        self.emitter.emit_action(action)
