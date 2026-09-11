import asyncio
import json
import uuid
from typing import Dict, Set


class EventManager:
    """Manages active SSE connections and broadcasts live updates & notifications."""

    def __init__(self):
        # Maps user_id -> Set of asyncio.Queue for connected user clients
        self.user_connections: Dict[uuid.UUID, Set[asyncio.Queue]] = {}

    def register(self, user_id: uuid.UUID) -> asyncio.Queue:
        q = asyncio.Queue()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(q)
        return q

    def unregister(self, user_id: uuid.UUID, q: asyncio.Queue):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(q)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_to_user(self, user_id: uuid.UUID, payload: dict):
        """Send a real-time event to a specific user's connected clients."""
        if user_id in self.user_connections:
            for q in list(self.user_connections[user_id]):
                await q.put(payload)

    async def broadcast_to_users(self, user_ids: list[uuid.UUID], payload: dict):
        """Send a real-time event to multiple users."""
        for uid in user_ids:
            await self.send_to_user(uid, payload)

    async def broadcast_all(self, payload: dict):
        """Broadcast a synchronization signal to all connected clients."""
        for queues in list(self.user_connections.values()):
            for q in list(queues):
                await q.put(payload)


event_manager = EventManager()
