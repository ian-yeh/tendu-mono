from app.services.utils import denormalize_x, denormalize_y

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