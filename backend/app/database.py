# backend/app/database.py
import asyncio
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


_engine_cache: dict[int, AsyncEngine] = {}
_session_factory_cache: dict[int, async_sessionmaker[AsyncSession]] = {}


def _get_engine() -> AsyncEngine:
    loop = asyncio.get_running_loop()
    loop_id = id(loop)
    engine = _engine_cache.get(loop_id)
    if engine is None:
        engine = create_async_engine(settings.database_url, pool_size=10, max_overflow=5, pool_pre_ping=True)
        _engine_cache[loop_id] = engine
    return engine


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    loop = asyncio.get_running_loop()
    loop_id = id(loop)
    session_factory = _session_factory_cache.get(loop_id)
    if session_factory is None:
        session_factory = async_sessionmaker(bind=_get_engine(), expire_on_commit=False)
        _session_factory_cache[loop_id] = session_factory
    return session_factory


class _AsyncSessionLocal:
    def __call__(self) -> AsyncSession:
        return _get_session_factory()()


AsyncSessionLocal = _AsyncSessionLocal()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """A FastAPI dependency: yields one session per request, always closes it."""
    async with AsyncSessionLocal() as session:
        yield session
