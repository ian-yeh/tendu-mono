from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime

class TestRequest(BaseModel):
    url: str
    focus: str

class TestResponse(BaseModel):
    id: str
    status: str

class Action(BaseModel):
    type: Literal["navigate", "click_at", "type_text_at", "scroll_document", "go_back", "go_forward", "wait_5_seconds", "key_combination", "click", "input", "screenshot", "done"]
    element: Optional[str] = None
    value: Optional[str] = None
    reasoning: Optional[str] = None
    screenshot: Optional[str] = None
    timestamp: datetime

class TestCase(BaseModel):
    id: str
    title: str
    steps: list[str]
    expected: str
    actual: Optional[str] = None
    status: Literal["pass", "fail", "pending"]
    screenshot: Optional[str] = None

class TestRun(BaseModel):
    id: str
    url: str
    focus: str
    status: Literal["running", "complete", "failed"]
    actions: list[Action] = []
    cases: list[TestCase] = []
    created_at: datetime
    completed_at: Optional[datetime] = None

