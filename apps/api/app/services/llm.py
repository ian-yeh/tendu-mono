"""LLM client service - Gemini API wrapper for vision-based decisions."""
import os
from dotenv import load_dotenv
from google import genai
from app.services.utils import parse_json_response

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

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
- done: Mark test as complete. Args: {"success": bool, "message": "string", "evidence": "string"}

Respond with JSON only:
{
  "observation": "What you see in the screenshot and current state",
  "reasoning": "Why you're taking this action",
  "action": "action_name",
  "args": {action arguments}
}

Coordinates are normalized 0-999 for both x and y regardless of actual screen size.

VERIFICATION - When deciding if a test is complete, you MUST check:
1. Did the expected outcome actually happen?
2. Are there any error messages visible?
3. Did the URL change as expected?
4. Is the expected content/element visible?

For the 'done' action:
- success: true ONLY if you verified the expected outcome
- message: Specific description of what you verified
- evidence: What on screen proves success/failure

IMPORTANT:
- If you've clicked the same element 2+ times with no change, try a different approach
- If you're stuck, describe what's preventing progress in your reasoning
- Never repeat the exact same action more than twice

Do NOT:
- Claim success without visual confirmation
- Assume an action worked—always check the result in the next screenshot
- Call done just because you ran out of ideas
"""


class LLMClient:
    """Manages Gemini API interactions for vision-based decision making."""
    
    def __init__(self, model: str = "gemini-2.5-flash"):
        self.model = model
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.system_prompt = SYSTEM_PROMPT
    
    def decide(self, screenshot_b64: str, task: str, current_url: str, history: list[dict]) -> dict | None:
        """
        Analyze screenshot and decide next action.
        
        Args:
            screenshot_b64: Base64 encoded screenshot
            task: The test focus/objective
            current_url: Current page URL
            history: List of previous actions taken
            
        Returns:
            Decision dict with observation, reasoning, action, args - or None if parsing fails
        """
        # Build prompt
        if not history:
            prompt = f"""Task: {task}
Current URL: {current_url}

Analyze the screenshot and decide the first action to take to complete this test."""
        else:
            history_text = "\n".join([
                f"- {h['action']}: {h['args']}" 
                for h in history
            ])
            prompt = f"""Task: {task}
Current URL: {current_url}

Previous actions taken:
{history_text}

Analyze the screenshot and decide the next action. If the test is complete, use the 'done' action. Do not repeat actions you have already taken unless absolutely necessary."""
        
        # Send request to Gemini
        response = self.client.models.generate_content(
            model=self.model,
            contents=[
                {"role": "user", "parts": [
                    {"text": self.system_prompt},
                ]},
                {"role": "user", "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": "image/png", "data": screenshot_b64}}
                ]}
            ]
        )
        
        response_text = response.text.strip()
        print(f"Model response: {response_text}")
        
        # Parse and return decision
        decision = parse_json_response(response_text)
        
        if decision:
            print(f"Observation: {decision.get('observation', '')}")
            print(f"Reasoning: {decision.get('reasoning', '')}")
        else:
            print("Failed to parse model response")
            
        return decision
