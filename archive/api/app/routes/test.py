"""Test routes - API endpoints for test creation and retrieval."""
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException
from nanoid import generate
from datetime import datetime

from app.models import TestRequest, TestResponse, TestRun
from app.store import store
from app.services.agent import Agent
from app.socketio import sio

router = APIRouter()


async def run_agent(test_id: str, url: str, focus: str) -> None:
    """Run the agent in a thread pool to avoid blocking the event loop."""
    loop = asyncio.get_event_loop()
    agent = Agent()
    await loop.run_in_executor(None, agent.run, test_id, url, focus, sio, loop)


@router.post("/", response_model=TestResponse)
async def create_test(request: TestRequest, background_tasks: BackgroundTasks):
    """Start a new test run."""
    test_id = f"test_{generate(size=10)}"
    
    test_run = TestRun(
        id=test_id,
        url=request.url,
        focus=request.focus,
        status="running",
        actions=[],
        cases=[],
        created_at=datetime.now()
    )
    
    store.set(test_id, test_run)
    
    # Run agent in background
    background_tasks.add_task(run_agent, test_id, request.url, request.focus)
    
    return TestResponse(id=test_id, status="running")


@router.get("/{test_id}")
async def get_test(test_id: str):
    """Get test run status and results."""
    test_run = store.get(test_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test not found")
    return test_run


@router.get("/{test_id}/cases")
async def get_test_cases(test_id: str):
    """Get generated test cases."""
    test_run = store.get(test_id)
    if not test_run:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"test_id": test_id, "cases": test_run.cases}
