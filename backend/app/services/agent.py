import base64
import asyncio
import time
from datetime import datetime
from nanoid import generate
from playwright.sync_api import sync_playwright
from google import genai

from app.models import Action, TestCase
from app.store import store
from app.services.llm import GEMINI_API_KEY, SYSTEM_PROMPT 
from app.services.utils import parse_json_response

# Screen dimensions
SCREEN_WIDTH = 1440
SCREEN_HEIGHT = 900

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
