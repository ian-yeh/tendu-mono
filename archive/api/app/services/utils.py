# for utility functions
import json
from datetime import datetime


class Logger:
    """Color-coded console logger for different log levels."""
    
    # ANSI color codes
    COLORS = {
        "RESET": "\033[0m",
        "BOLD": "\033[1m",
        "DIM": "\033[2m",
        # Foreground colors
        "RED": "\033[91m",
        "GREEN": "\033[92m",
        "YELLOW": "\033[93m",
        "BLUE": "\033[94m",
        "MAGENTA": "\033[95m",
        "CYAN": "\033[96m",
        "WHITE": "\033[97m",
        "GRAY": "\033[90m",
    }
    
    def __init__(self, name: str = "Agent"):
        self.name = name
    
    def _timestamp(self) -> str:
        return datetime.now().strftime("%H:%M:%S")
    
    def _format(self, level: str, color: str, message: str) -> str:
        c = self.COLORS
        return f"{c['GRAY']}{self._timestamp()}{c['RESET']} {color}{c['BOLD']}[{level}]{c['RESET']} {c['DIM']}{self.name}:{c['RESET']} {message}"
    
    def info(self, message: str) -> None:
        """Log informational message (cyan)."""
        print(self._format("INFO", self.COLORS["CYAN"], message))
    
    def error(self, message: str) -> None:
        """Log error message (red)."""
        print(self._format("ERROR", self.COLORS["RED"], message))
    
    def note(self, message: str) -> None:
        """Log note/warning message (yellow)."""
        print(self._format("NOTE", self.COLORS["YELLOW"], message))
    
    def data(self, message: str) -> None:
        """Log data/debug message (magenta)."""
        print(self._format("DATA", self.COLORS["MAGENTA"], message))
    
    def success(self, message: str) -> None:
        """Log success message (green)."""
        print(self._format("OK", self.COLORS["GREEN"], message))
    
    def action(self, action_type: str, details: str = "") -> None:
        """Log action execution (blue)."""
        msg = f"{action_type}" + (f" → {details}" if details else "")
        print(self._format("ACTION", self.COLORS["BLUE"], msg))


# Default logger instance
log = Logger()

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
