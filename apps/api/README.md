# Backend Setup

## Local Development

### Prerequisites
- Python 3.8 or higher
- pip

### Installation

1. **Navigate to the backend directory:**
```bash
cd backend
```

2. **Create a virtual environment (recommended):**
```bash
python -m venv venv
source venv/Scripts/activate  # On Windows with Git Bash
# or
source venv/bin/activate  # On macOS/Linux
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Install Playwright browsers:**
```bash
playwright install chromium
```

5. **Configure environment variables:**
The `.env` file should already be present with the Gemini API key. If not, create a `.env` file:
```bash
GEMINI_API_KEY=your_api_key_here
```

### Running the Server

Start the development server:
```bash
uvicorn app.main:socket_app --reload --port 8000
```

The API will be available at `http://localhost:8000`

### API Endpoints

- `GET /` - API information
- `POST /api/test/` - Create a new test run
- `GET /api/test/{test_id}` - Get test run status
- `GET /api/test/{test_id}/cases` - Get test cases

### WebSocket

Connect to Socket.IO at the root endpoint with query parameter `testId` to receive real-time updates during test execution.
