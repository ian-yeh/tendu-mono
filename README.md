# Testpilot: Autonomous E2E Testing Agent

A AI-powered visual testing tool for web apps. Users describe tests in plain English, Playwright runs the actions and captures screenshots, and Gemini evaluates whether the flow worked correctly.

### Tech stack.
Frontend: Next.js, TypeScript
Backend: Python, FastAPI
Browser Automation: Playwright (Python)
Real-Time Streaming: Socket.io
AI/LLM: Google Gemini Vision API

This project was built at Hack Western 2025. 

### How it works.

1. User inputs a URL and a test prompt.
2. Backend starts a Playwright browser instance and navigates to the URL.
3. Backend starts an agent loop that:
    a. Captures a screenshot of the current page.
    b. Sends the screenshot, URL, and test prompt to Gemini Vision API.
    c. Gemini returns an action (e.g., "click", "type", "scroll") and arguments.
    d. Backend executes the action using Playwright.
    e. Backend sends the new screenshot and action details to the frontend.
4. This loop continues until Gemini decides the test is complete or a timeout is reached.
5. Frontend displays the test session in a split-view with the live browser and action history.

### How to run.

1. Run `npm install` in the `frontend` directory.
2. Run `pip install -r requirements.txt` in the `backend` directory.
3. Run `npm run dev` in the `frontend` directory.
4. Run `uvicorn app.main:socket_app --reload --port 8000` in the `backend` directory.
