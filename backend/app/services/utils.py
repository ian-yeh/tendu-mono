# for utility functions
import json

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

def denormalize_x(x: int, screen_width: int) -> int:
    """Convert normalized x coordinate (0-1000) to actual pixel coordinate."""
    return int(x / 1000 * screen_width)

def denormalize_y(y: int, screen_height: int) -> int:
    """Convert normalized y coordinate (0-1000) to actual pixel coordinate."""
    return int(y / 1000 * screen_height)
