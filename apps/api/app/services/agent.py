"""Agent service - Orchestrates test execution using browser, LLM, and emitter services."""
import time

from app.store import store
from app.services.browser import BrowserController
from app.services.llm import LLMClient
from app.services.emitter import EventEmitter
from app.services.utils import log


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
            # DB: verify test exists
            test_run = store.get(test_id)
            if not test_run:
                raise ValueError(f"Test run {test_id} not found")
            
            # Browser: launch and navigate
            self.browser.launch()
            self.browser.goto(url)
            
            # Emitter: emit initial navigation action
            initial_screenshot = self.browser.screenshot()
            self.emitter.emit_action("navigate", url, None, initial_screenshot)
            
            # Agent: run the agent loop
            test_completed = self._run_loop()
            
            # Agent: handle timeout if not completed
            if not test_completed:
                self._handle_timeout()
            
            # Browser: cleanup
            self.browser.close()
            time.sleep(5)
            
            # Agent: mark complete
            self.emitter.emit_complete()
            
        except Exception as e:
            self._handle_error(e)
    
    def _run_loop(self) -> bool:
        """Run the main agent loop. Returns True if test completed normally."""
        for turn in range(self.TURN_LIMIT):
            log.info(f"Turn {turn + 1}/{self.TURN_LIMIT}")
            
            # Browser: get current state
            screenshot = self.browser.screenshot()
            current_url = self.browser.current_url
            
            # LLM: makes decision on pass/fail of test
            decision = self.llm.decide(screenshot, self.focus, current_url, self.history)
            
            if not decision:
                log.note("Failed to parse model response, retrying...")
                continue
            
            action_name = decision.get("action", "")
            args = decision.get("args", {})
            reasoning = decision.get("reasoning", "")
            observation = decision.get("observation", "")
            
            # Agent: check if done
            if action_name == "done":
                return self._handle_done(decision)
            
            # Browser: execute action
            result = self.browser.execute_action(action_name, args)
            
            # Emitter: take screenshot after action and emit
            action_screenshot = self.browser.screenshot()
            self.emitter.emit_action(action_name, result.get('element', ''), reasoning, action_screenshot)
            
            # Agent: update history
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
        
        if success:
            log.success(f"Test passed: {message}")
        else:
            log.error(f"Test failed: {message}")
        
        final_screenshot = self.browser.screenshot()
        self.emitter.emit_action("done", message, reasoning, final_screenshot)
        
        return True
    
    def _handle_timeout(self) -> None:
        """Handle test timeout when turn limit is reached."""
        timeout_screenshot = self.browser.screenshot()
        reasoning = f"The test did not complete within {self.TURN_LIMIT} turns. The agent may need more steps or encountered an issue."
        
        self.emitter.emit_action("done", "Test reached maximum turn limit", reasoning, timeout_screenshot)
        log.note("Test timed out - reached turn limit")
    
    def _handle_error(self, error: Exception) -> None:
        """Handle test execution error."""
        import traceback
        log.error(f"Agent error: {str(error)}")
        traceback.print_exc()
        
        # Try to capture error screenshot
        error_screenshot = None
        if self.browser and self.browser._page:
            try:
                error_screenshot = self.browser.screenshot()
                log.info("Captured error screenshot")
            except Exception as screenshot_error:
                log.note(f"Could not capture error screenshot: {screenshot_error}")
        
        # Emit error action
        try:
            self.emitter.emit_action(
                "done", 
                "Test failed with error", 
                f"An error occurred during test execution: {str(error)}",
                error_screenshot
            )
        except Exception as action_error:
            log.error(f"Failed to emit error action: {action_error}")
        
        # Emit error event
        if self.emitter:
            self.emitter.emit_error(str(error))
