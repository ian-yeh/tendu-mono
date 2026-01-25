from app.models import TestRun

class Store:
    def __init__(self):
        self._data: dict[str, TestRun] = {}
    
    def get(self, id: str) -> TestRun | None:
        return self._data.get(id)
    
    def set(self, id: str, run: TestRun) -> None:
        self._data[id] = run
    
    def update(self, id: str, **kwargs) -> None:
        if id in self._data:
            run = self._data[id]
            for key, value in kwargs.items():
                setattr(run, key, value)
    
    def add_action(self, id: str, action) -> None:
        if id in self._data:
            self._data[id].actions.append(action)
    
    def add_case(self, id: str, case) -> None:
        if id in self._data:
            self._data[id].cases.append(case)

store = Store()

