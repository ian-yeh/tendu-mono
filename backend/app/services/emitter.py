"""Event emitter service - Socket.IO abstraction for real-time communication."""
import asyncio
from datetime import datetime
from app.models import Action
from app.store import store


class EventEmitter:
    """Manages Socket.IO event emission from sync context to async event loop."""
    
    def __init__(self, sio, loop, room_id: str):
        self.sio = sio
        self.loop = loop
        self.room_id = room_id
    
    def _emit(self, event: str, data: dict) -> None:
        """Internal method to emit event via Socket.IO."""
        asyncio.run_coroutine_threadsafe(
            self.sio.emit(event, data, room=self.room_id),
            self.loop
        )
    
    def emit_action(self, action: Action) -> None:
        """Emit an action event and store it."""
        store.add_action(self.room_id, action)
        action_dict = action.model_dump()
        self._emit('action', action_dict)
        print(f"Emitted action: {action_dict.get('type')}")
    
    def emit_complete(self) -> None:
        """Emit test completion event."""
        store.update(self.room_id, status="complete", completed_at=datetime.now())
        self._emit('complete', {"test_completed": True})
        print(f"Emitted complete event to room {self.room_id}")
    
    def emit_error(self, message: str) -> None:
        """Emit error event and update status."""
        store.update(self.room_id, status="failed")
        self._emit('error', {"message": message})
        print(f"Emitted error event to room {self.room_id}: {message}")