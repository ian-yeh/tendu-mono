# TestPilot ✈️

TestPilot is an AI-powered visual testing tool for web apps. Users describe tests in plain English, Playwright runs the actions and captures screenshots, and Gemini evaluates whether the flow worked correctly.

## Core Features

*   **Visual Understanding:** Playwright captures initial UI screenshots to give Gemini full context before test execution begins.
*   **Continuous Screenshot Pipeline:** Each interaction generates a new screenshot, creating a complete visual trace of the test.
*   **AI-Powered Evaluation:** Gemini analyzes the screenshot sequence and determines whether the expected behavior occurred, providing natural-language reasoning.
*   **Natural-Language Test Cases:** Users describe tests in everyday English — no scripts, JSON, or selectors required.
*   **Real-Time Feedback:** Users describe tests in everyday English, no scripts, JSON, or selectors required.

## Tech Stack

*   **Frontend:** Next.js, TypeScript
*   **Backend:** Python, FastAPI
*   **Browser Automation:** Playwright (Python)
*   **Real-Time Streaming:** Socket.io
*   **AI/LLM:** Google Gemini Vision API


## Getting Started

To get a local copy up and running, follow these steps.

### Prerequisites

*   Node.js and npm
*   Python 3
*   Gemini API key

### Installation

1.  **Clone the repo:**
    ```sh
    git clone https://github.com/ian-yeh/hack-western.git
    ```
2.  **Install frontend dependencies:**
    ```sh
    cd frontend
    npm install
    ```
3.  **Install backend dependencies:**
    ```sh
    cd ../backend
    # Assuming a requirements.txt file exists
    pip install -r requirements.txt
    playwright install
    ```

## Usage

1.  **Start the frontend development server:**
    ```sh
    cd frontend
    npm run dev
    ```
2.  **Start the backend server:**
    ```sh
    cd ../backend
    uvicorn app.main:app --reload
    ```

Once both servers are running:

1. Open the TestPilot UI
2. Paste your website link
3. Describe your test in natural language
4. Watch the real-time screenshot stream
5. Review Gemini's evaluation and results

## Future Development

*   **Natural-Language Debugging:** Allow users to ask “Why did this break?” and receive an AI-generated explanation with recommended fixes.
*   **Autonomous Exploration Mode:** Enable TestPilot to automatically navigate a website, discover user flows, map pages, and identify key interactions without manual input.
*   **State-Diff Comparison:** Provide visual and structural before-and-after diffs so users can clearly see what changed between test steps.
## Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/YourFeature`)
3.  Commit your Changes (`git commit -m 'Add YourFeature`)
4.  Push to the Branch (`git push origin feature/YourFeature`)
