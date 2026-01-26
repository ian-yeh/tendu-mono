"""Browser controller service - Playwright wrapper for browser automation."""
import base64
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
from app.services.utils import denormalize_x, denormalize_y


class BrowserController:
    """Manages Playwright browser lifecycle and actions."""
    
    def __init__(self, width: int = 1440, height: int = 900, headless: bool = True):
        self.width = width
        self.height = height
        self.headless = headless
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None
    
    @property
    def page(self) -> Page:
        """Get the current page, raising error if not launched."""
        if self._page is None:
            raise RuntimeError("Browser not launched. Call launch() first.")
        return self._page
    
    @property
    def current_url(self) -> str:
        """Get the current page URL."""
        return self.page.url
    
    def launch(self) -> None:
        """Launch browser and create a new page."""
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self.headless)
        self._context = self._browser.new_context(
            viewport={"width": self.width, "height": self.height}
        )
        self._page = self._context.new_page()
    
    def goto(self, url: str) -> None:
        """Navigate to a URL."""
        self.page.goto(url, wait_until="networkidle")
    
    def screenshot(self) -> str:
        """Take a screenshot and return as base64 string."""
        screenshot_bytes = self.page.screenshot(type="png")
        return base64.b64encode(screenshot_bytes).decode('utf-8')
    
    def execute_action(self, action_name: str, args: dict) -> dict:
        """Execute a browser action and return result."""
        action_result = {}
        print(f"  -> Executing: {action_name} with args: {args}")
        
        try:
            if action_name == "navigate":
                url = args.get("url", "")
                self.page.goto(url, wait_until="networkidle")
                action_result = {"element": url}
                
            elif action_name == "click_at":
                actual_x = denormalize_x(args["x"], self.width)
                actual_y = denormalize_y(args["y"], self.height)
                self.page.mouse.click(actual_x, actual_y)
                action_result = {"element": f"({actual_x}, {actual_y})"}

            elif action_name == "type_text_at":
                actual_x = denormalize_x(args["x"], self.width)
                actual_y = denormalize_y(args["y"], self.height)
                text = args["text"]
                press_enter = args.get("press_enter", False)
                clear_before_typing = args.get("clear_before_typing", True)
                
                self.page.mouse.click(actual_x, actual_y)
                if clear_before_typing:
                    self.page.keyboard.press("Control+A")
                    self.page.keyboard.press("Backspace")
                self.page.keyboard.type(text)
                if press_enter:
                    self.page.keyboard.press("Enter")
                action_result = {"element": text}

            elif action_name == "scroll_document":
                direction = args["direction"]
                scroll_map = {
                    "down": (0, 500),
                    "up": (0, -500),
                    "left": (-500, 0),
                    "right": (500, 0)
                }
                dx, dy = scroll_map.get(direction, (0, 0))
                self.page.mouse.wheel(dx, dy)
                action_result = {"element": direction}

            elif action_name == "go_back":
                self.page.go_back()
                action_result = {"element": "back"}

            elif action_name == "go_forward":
                self.page.go_forward()
                action_result = {"element": "forward"}

            elif action_name == "wait_5_seconds":
                self.page.wait_for_timeout(5000)
                action_result = {"element": "wait"}

            elif action_name == "key_combination":
                keys = args["keys"]
                self.page.keyboard.press(keys)
                action_result = {"element": keys}

            else:
                print(f"Warning: Unknown action {action_name}")
                action_result = {"element": action_name}
            
            # Wait for page to settle
            self.page.wait_for_load_state("networkidle", timeout=5000)
            self.page.wait_for_timeout(1000)
            
        except Exception as e:
            print(f"Error executing {action_name}: {e}")
            action_result = {"error": str(e), "element": "error"}
        
        return action_result
    
    def close(self) -> None:
        """Close browser and cleanup resources."""
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()
        self._page = None
        self._context = None
        self._browser = None
        self._playwright = None