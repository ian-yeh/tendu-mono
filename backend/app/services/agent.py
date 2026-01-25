import base64
import json
import asyncio
import time
from datetime import datetime
from nanoid import generate
from playwright.sync_api import sync_playwright
from google import genai

from app.models import Action, TestCase
from app.store import store
from app.services.gemini import GEMINI_API_KEY

# Screen dimensions
SCREEN_WIDTH = 1440
SCREEN_HEIGHT = 900

SYSTEM_PROMPT = """You are a web automation agent that analyzes screenshots and decides what actions to take to complete a test.

Available actions (action_name variable):
- navigate: Navigate to a URL. Args: {"url": "string"}
- click_at: Click at coordinates. Args: {"x": int (0-999), "y": int (0-999)}
- type_text_at: Type text at coordinates. Args: {"x": int (0-999), "y": int (0-999), "text": "string", "press_enter": bool, "clear_before_typing": bool}
- scroll_document: Scroll the page. Args: {"direction": "up"|"down"|"left"|"right"}
- go_back: Go back in browser history. Args: {}
- go_forward: Go forward in browser history. Args: {}
- wait_5_seconds: Wait 5 seconds. Args: {}
- key_combination: Press keyboard keys. Args: {"keys": "string"}
- done: Mark test as complete. Args: {"success": bool, "message": "string"}

Respond with JSON only:
{
  "observation": "What you see in the screenshot and current state",
  "reasoning": "Why you're taking this action",
  "action": "action_name",
  "args": {action arguments}
}

Coordinates are normalized 0-999 for both x and y regardless of actual screen size."""

async def run_agent(test_id: str, url: str, focus: str, sio) -> None:
    """Main agent that uses Gemini to analyze screenshots and control browser via Playwright."""
    # Run the blocking Playwright code in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_agent_sync, test_id, url, focus, sio, loop)

def _run_agent_sync(test_id: str, url: str, focus: str, sio, loop) -> None:
    """Synchronous version of the agent that runs in a thread."""
    page = None
    browser = None
    
    try:
        # Get the test run from store
        test_run = store.get(test_id)
        if not test_run:
            raise ValueError(f"Test run {test_id} not found")
        
        # Initialize Playwright with sync API
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": SCREEN_WIDTH, "height": SCREEN_HEIGHT})
            page = context.new_page()
            
            # Navigate to URL
            page.goto(url, wait_until="networkidle")
            
            # Take initial screenshot after navigation
            initial_screenshot = page.screenshot(type="png")
            initial_screenshot_b64 = base64.b64encode(initial_screenshot).decode('utf-8')
            
            # Log initial navigation action
            action = Action(
                type="navigate",
                element=url,
                screenshot=initial_screenshot_b64,
                timestamp=datetime.now()
            )
            store.add_action(test_id, action)
            asyncio.run_coroutine_threadsafe(
                sio.emit('action', action.model_dump(), room=test_id),
                loop
            )
            
            # Get Gemini client
            client = genai.Client(api_key=GEMINI_API_KEY)
            
            # Agent loop - max 5 turns
            turn_limit = 50
            conversation_history = []
            test_completed = False
            
            for i in range(turn_limit):
                print(f"Turn {i+1}/{turn_limit}")
                
                # Take screenshot
                screenshot_bytes = page.screenshot(type="png")
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
                
                # Build prompt for this turn
                if i == 0:
                    prompt = f"""Task: {focus}
Current URL: {url}

Analyze the screenshot and decide the first action to take to complete this test."""
                else:
                    # Build history summary
                    history_text = "\n".join([
                        f"- {h['action']}: {h['args']}" 
                        for h in conversation_history
                    ])
                    print(f"Conversation history: {conversation_history}")
                    
                    prompt = f"""Task: {focus}
Current URL: {page.url}

Previous actions taken:
{history_text}

Analyze the screenshot and decide the next action. If the test is complete, use the 'done' action. Do not repeat actions you have already taken unless absolutely necessary."""
                
                # Send request to Gemini
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[
                        {"role": "user", "parts": [
                            {"text": SYSTEM_PROMPT},
                        ]},
                        {"role": "user", "parts": [
                            {"text": prompt},
                            {"inline_data": {"mime_type": "image/png", "data": screenshot_b64}}
                        ]}
                    ]
                )
                
                # Parse response
                response_text = response.text.strip()
                print(f"Model response: {response_text}")
                
                # Extract JSON from response
                decision = parse_json_response(response_text)
                
                if not decision:
                    print("Failed to parse model response, retrying...")
                    continue
                
                # Log observation
                observation = decision.get("observation", "")
                reasoning = decision.get("reasoning", "")
                print(f"Observation: {observation}")
                print(f"Reasoning: {reasoning}")
                
                action_name = decision.get("action", "")
                args = decision.get("args", {})
                
                # Check if done
                if action_name == "done":
                    success = args.get("success", True)
                    message = args.get("message", "Test completed")
                    print(f"Test {'passed' if success else 'failed'}: {message}")
                    
                    # Take final screenshot
                    final_screenshot = page.screenshot(type="png")
                    final_screenshot_b64 = base64.b64encode(final_screenshot).decode('utf-8')
                    
                    # Log the done action with reasoning
                    action = Action(
                        type="done",
                        element=message,
                        reasoning=reasoning,
                        screenshot=final_screenshot_b64,
                        timestamp=datetime.now()
                    )
                    store.add_action(test_id, action)
                    
                    # Emit with model_dump to ensure proper serialization
                    action_dict = action.model_dump()
                    print(f"Emitting done action: {action_dict.get('type')}, reasoning: {action_dict.get('reasoning')[:50] if action_dict.get('reasoning') else 'None'}...")
                    asyncio.run_coroutine_threadsafe(
                        sio.emit('action', action_dict, room=test_id),
                        loop
                    )
                    test_completed = True
                    break
                
                # Execute the action
                result = execute_single_action(action_name, args, page, SCREEN_WIDTH, SCREEN_HEIGHT)
                
                # Take screenshot after action
                action_screenshot = page.screenshot(type="png")
                action_screenshot_b64 = base64.b64encode(action_screenshot).decode('utf-8')
                
                # Log action
                action = Action(
                    type=action_name,
                    element=result.get('element', ''),
                    reasoning=reasoning,
                    screenshot=action_screenshot_b64,
                    timestamp=datetime.now()
                )
                store.add_action(test_id, action)
                asyncio.run_coroutine_threadsafe(
                    sio.emit('action', action.model_dump(), room=test_id),
                    loop
                )
                
                # Update conversation history
                conversation_history.append({
                    "action": action_name,
                    "args": args,
                    "observation": observation,
                    "result": result
                })
            
            # If test reached turn limit without completing, log a timeout action
            if not test_completed:
                timeout_screenshot = page.screenshot(type="png")
                timeout_screenshot_b64 = base64.b64encode(timeout_screenshot).decode('utf-8')
                
                timeout_action = Action(
                    type="done",
                    element="Test reached maximum turn limit",
                    reasoning=f"The test did not complete within {turn_limit} turns. The agent may need more steps or encountered an issue.",
                    screenshot=timeout_screenshot_b64,
                    timestamp=datetime.now()
                )
                store.add_action(test_id, timeout_action)
                
                # Emit with proper serialization
                timeout_dict = timeout_action.model_dump()
                print(f"Emitting timeout action: {timeout_dict.get('type')}")
                asyncio.run_coroutine_threadsafe(
                    sio.emit('action', timeout_dict, room=test_id),
                    loop
                )
            
            browser.close()
            time.sleep(5)
        
        # Mark test as complete
        store.update(test_id, status="complete", completed_at=datetime.now())
        asyncio.run_coroutine_threadsafe(
            sio.emit('complete', {"test_completed": True}, room=test_id),
            loop
        )
        
    except Exception as e:
        print(f"Agent error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        # Try to capture error screenshot if browser is still available
        error_screenshot_b64 = None
        if page is not None:
            try:
                error_screenshot = page.screenshot(type="png")
                error_screenshot_b64 = base64.b64encode(error_screenshot).decode('utf-8')
                print("Successfully captured error screenshot")
            except Exception as screenshot_error:
                print(f"Could not capture error screenshot: {screenshot_error}")
        else:
            print("Page is None, cannot capture screenshot")
        
        # Always log the error action, even without screenshot
        try:
            error_action = Action(
                type="done",
                element="Test failed with error",
                reasoning=f"An error occurred during test execution: {str(e)}",
                screenshot=error_screenshot_b64,
                timestamp=datetime.now()
            )
            store.add_action(test_id, error_action)
            print(f"Added error action to store for test {test_id}")
            
            # Emit the action via Socket.IO with proper serialization
            error_dict = error_action.model_dump()
            print(f"Emitting error action dict: type={error_dict.get('type')}, element={error_dict.get('element')}")
            asyncio.run_coroutine_threadsafe(
                sio.emit('action', error_dict, room=test_id),
                loop
            )
            print(f"Emitted error action via Socket.IO to room {test_id}")
        except Exception as action_error:
            print(f"Failed to create/emit error action: {action_error}")
            traceback.print_exc()
        
        # Update status to failed
        try:
            store.update(test_id, status="failed")
            print(f"Updated test {test_id} status to failed")
        except Exception as update_error:
            print(f"Failed to update status: {update_error}")
        
        # Emit error event
        try:
            asyncio.run_coroutine_threadsafe(
                sio.emit('error', {"message": str(e)}, room=test_id),
                loop
            )
            print(f"Emitted error event via Socket.IO to room {test_id}")
        except Exception as emit_error:
            print(f"Failed to emit error event: {emit_error}")

def parse_json_response(text: str) -> dict:
    """Extract and parse JSON from model response."""
    try:
        # Try direct parse
        return json.loads(text)
    except:
        pass
    
    # Try to extract from markdown code blocks
    if "```json" in text:
        try:
            json_str = text.split("```json")[1].split("```")[0].strip()
            return json.loads(json_str)
        except:
            pass
    elif "```" in text:
        try:
            json_str = text.split("```")[1].split("```")[0].strip()
            return json.loads(json_str)
        except:
            pass
    
    # Try to find JSON object in text
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        json_str = text[start:end]
        return json.loads(json_str)
    except:
        pass
    
    return None

def execute_single_action(action_name: str, args: dict, page, screen_width: int, screen_height: int) -> dict:
    """Execute a single action returned by the model."""
    action_result = {}
    print(f"  -> Executing: {action_name} with args: {args}")
    
    try:
        if action_name == "navigate":
            url = args.get("url", "")
            page.goto(url, wait_until="networkidle")
            action_result = {"element": url}
        elif action_name == "click_at":
            actual_x = denormalize_x(args["x"], screen_width)
            actual_y = denormalize_y(args["y"], screen_height)
            page.mouse.click(actual_x, actual_y)
            action_result = {"element": f"({actual_x}, {actual_y})"}
        elif action_name == "type_text_at":
            actual_x = denormalize_x(args["x"], screen_width)
            actual_y = denormalize_y(args["y"], screen_height)
            text = args["text"]
            press_enter = args.get("press_enter", False)
            clear_before_typing = args.get("clear_before_typing", True)
            
            page.mouse.click(actual_x, actual_y)
            if clear_before_typing:
                page.keyboard.press("Control+A")
                page.keyboard.press("Backspace")
            page.keyboard.type(text)
            if press_enter:
                page.keyboard.press("Enter")
            action_result = {"element": text}
        elif action_name == "scroll_document":
            direction = args["direction"]
            if direction == "down":
                page.mouse.wheel(0, 500)
            elif direction == "up":
                page.mouse.wheel(0, -500)
            elif direction == "left":
                page.mouse.wheel(-500, 0)
            elif direction == "right":
                page.mouse.wheel(500, 0)
            action_result = {"element": direction}
        elif action_name == "go_back":
            page.go_back()
            action_result = {"element": "back"}
        elif action_name == "go_forward":
            page.go_forward()
            action_result = {"element": "forward"}
        elif action_name == "wait_5_seconds":
            page.wait_for_timeout(5000)
            action_result = {"element": "wait"}
        elif action_name == "key_combination":
            keys = args["keys"]
            page.keyboard.press(keys)
            action_result = {"element": keys}
        else:
            print(f"Warning: Unknown action {action_name}")
            action_result = {"element": action_name}
        
        # Wait for page to settle
        page.wait_for_load_state("networkidle", timeout=5000)
        page.wait_for_timeout(1000)
        
    except Exception as e:
        print(f"Error executing {action_name}: {e}")
        action_result = {"error": str(e), "element": "error"}
    
    return action_result

def denormalize_x(x: int, screen_width: int) -> int:
    """Convert normalized x coordinate (0-1000) to actual pixel coordinate."""
    return int(x / 1000 * screen_width)

def denormalize_y(y: int, screen_height: int) -> int:
    """Convert normalized y coordinate (0-1000) to actual pixel coordinate."""
    return int(y / 1000 * screen_height)
