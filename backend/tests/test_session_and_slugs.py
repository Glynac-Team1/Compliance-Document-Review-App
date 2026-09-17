from datetime import timedelta
import pytest
from app.core.security import create_session_token, decode_session_token
from app.api.auth import generate_user_slug
from models import Role
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

def test_slug_generation():
    assert generate_user_slug("Daniel Ojo") == "daniel-ojo"
    assert generate_user_slug("Ojo Oluwafemi") == "ojo-oluwafemi"
    assert generate_user_slug("Jordan Davis, CFA") == "jordan-davis-cfa"
    assert generate_user_slug("New User", "ojodaniel@example.com") == "ojodaniel"
    assert generate_user_slug("", "test.user@company.com") == "test-user"
    assert generate_user_slug(None, None) == "workspace"

def test_slug_generation_with_workspace():
    # Verify slug bears both workspace and advisor/officer name
    assert generate_user_slug("Daniel Ojo", workspace_slug="northstar") == "northstar-daniel-ojo"
    assert generate_user_slug("Jordan Davis, CFA", workspace_slug="northstar") == "northstar-jordan-davis-cfa"
    assert generate_user_slug("Sarah Connor", workspace_slug="apex-capital") == "apex-capital-sarah-connor"
    assert generate_user_slug("New User", "alex.officer@firm.com", workspace_slug="northstar") == "northstar-alex-officer"
    assert generate_user_slug(None, None, workspace_slug="northstar") == "northstar-member"

def test_valid_session_token_decoding():
    token = create_session_token("test-user-id", Role.advisor)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    payload = decode_session_token(creds)
    assert payload["sub"] == "test-user-id"
    assert payload["role"] == "advisor"
    assert "exp" in payload
    assert "iat" in payload

def test_expired_session_token_rejection():
    expired_token = create_session_token(
        "test-user-id",
        Role.advisor,
        expires_delta=timedelta(seconds=-10)
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
    with pytest.raises(HTTPException) as exc_info:
        decode_session_token(creds)
    assert exc_info.value.status_code == 401
    assert "Session expired" in exc_info.value.detail
