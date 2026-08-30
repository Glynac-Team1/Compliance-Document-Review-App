import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security import create_session_token
from models import Role


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as value:
        yield value


@pytest.fixture
def advisor_token():
    return create_session_token("advisor-id", Role.advisor)


@pytest.fixture
def officer_token():
    return create_session_token("officer-id", Role.officer)
