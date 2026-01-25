import socketio

# Create Socket.io server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

