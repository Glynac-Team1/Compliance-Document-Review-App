import asyncio
import json
import uuid
from typing import Dict, Set, Optional

import redis.asyncio as aioredis

from app.config import settings

REDIS_CHANNEL = "sse_events"


class EventManager:
    """
    Manages active SSE connections and broadcasts live updates & notifications
    across multiple Uvicorn workers / container replicas via Redis Pub/Sub.

    A live SSE connection only exists in the memory of the single process that
    accepted it, so each process still keeps its own local map of connected
    clients. What changes here is that events are no longer delivered directly
    to local queues, instead, they're published to a shared Redis channel.
    Every process (including the one that published) subscribes to that
    channel and delivers incoming events to whichever local connections it
    happens to be holding. This means a broadcast triggered on one worker
    reaches clients connected to any other worker.
    """

    def __init__(self):
        self.user_connections: Dict[uuid.UUID, Set[asyncio.Queue]] = {}
        self._redis: Optional[aioredis.Redis] = None
        self._pubsub_task: Optional[asyncio.Task] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    @property
    def redis(self) -> aioredis.Redis:
        current_loop = None
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            pass
        if self._redis is None or (current_loop is not None and self._loop != current_loop):
            self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
            self._loop = current_loop
        return self._redis

    async def start(self):
        """Start the background Redis subscriber. Call once on app startup."""
        if self._pubsub_task is not None:
            return
        self._pubsub_task = asyncio.create_task(self._subscribe_loop())

    async def stop(self):
        """Stop the subscriber cleanly. Call on app shutdown."""
        if self._pubsub_task is not None:
            self._pubsub_task.cancel()
            self._pubsub_task = None
        if self._redis is not None:
            await self._redis.close()
            self._redis = None

    async def _subscribe_loop(self):
        while True:
            try:
                pubsub = self.redis.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                async for message in pubsub.listen():
                    if message["type"] != "message":
                        continue
                    try:
                        envelope = json.loads(message["data"])
                    except (json.JSONDecodeError, TypeError):
                        continue
                    await self._deliver_locally(envelope)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                await asyncio.sleep(5)

    async def _deliver_locally(self, envelope: dict):
        target = envelope.get("target")
        payload = envelope.get("payload")

        if target == "user":
            await self._push_local(uuid.UUID(envelope["user_id"]), payload)
        elif target == "users":
            for uid_str in envelope.get("user_ids", []):
                await self._push_local(uuid.UUID(uid_str), payload)
        elif target == "all":
            for uid in list(self.user_connections.keys()):
                await self._push_local(uid, payload)

    async def _push_local(self, user_id: uuid.UUID, payload: dict):
        if user_id in self.user_connections:
            for q in list(self.user_connections[user_id]):
                await q.put(payload)

    def register(self, user_id: uuid.UUID) -> asyncio.Queue:
        q = asyncio.Queue()
        self.user_connections.setdefault(user_id, set()).add(q)
        return q

    def unregister(self, user_id: uuid.UUID, q: asyncio.Queue):
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(q)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_to_user(self, user_id: uuid.UUID, payload: dict):
        """Publish an event for a specific user. Delivered to that user's
        connections on whichever process they're connected to."""
        envelope = {
            "target": "user",
            "user_id": str(user_id),
            "payload": payload,
        }
        try:
            await self.redis.publish(REDIS_CHANNEL, json.dumps(envelope))
        except Exception:
            await self._deliver_locally(envelope)

    async def broadcast_to_users(self, user_ids: list[uuid.UUID], payload: dict):
        """Publish an event for multiple specific users."""
        envelope = {
            "target": "users",
            "user_ids": [str(uid) for uid in user_ids],
            "payload": payload,
        }
        try:
            await self.redis.publish(REDIS_CHANNEL, json.dumps(envelope))
        except Exception:
            await self._deliver_locally(envelope)

    async def broadcast_all(self, payload: dict):
        """Publish a synchronization signal to every connected client,
        across all processes."""
        envelope = {
            "target": "all",
            "payload": payload,
        }
        try:
            await self.redis.publish(REDIS_CHANNEL, json.dumps(envelope))
        except Exception:
            await self._deliver_locally(envelope)


event_manager = EventManager()