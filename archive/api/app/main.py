from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
from app.socketio import sio

# Create FastAPI app
app = FastAPI(title="TestPilot API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Socket.io
socket_app = socketio.ASGIApp(sio, app)

# Root endpoint
@app.get("/")
async def root():
    # return {"message": "Welcome to the TestPilot API"} # DEBUG
    return {
        "message": "TestPilot API",
        "version": "1.0.0",
        "endpoints": {
            "create_test": "POST /api/test/",
            "get_test": "GET /api/test/{test_id}",
            "get_test_cases": "GET /api/test/{test_id}/cases"
        }
    }

# Include routes
from app.routes import test
app.include_router(test.router, prefix="/api/test", tags=["test"])

# Socket.io events
@sio.event
async def connect(sid, environ):
    query = environ.get('QUERY_STRING', '')
    # Parse test_id from query string and join room
    if 'testId=' in query:
        test_id = query.split('testId=')[1].split('&')[0]
        await sio.enter_room(sid, test_id)

@sio.event
async def disconnect(sid):
    pass

