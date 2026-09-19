
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import (
    create_session_token,
    decode_session_token,
    generate_secure_token,
    validate_password_strength,
)
from models import Role


class TestPasswordStrengthValidation:
    """Verifies NIST-compliant password strength rules."""

    def test_rejects_too_short(self):
        with pytest.raises(HTTPException) as exc:
            validate_password_strength("Aa1!xyz")  # 7 chars
        assert exc.value.status_code == 400
        assert "at least 8 characters" in exc.value.detail

    def test_rejects_missing_uppercase(self):
        with pytest.raises(HTTPException) as exc:
            validate_password_strength("securevault123!#")
        assert exc.value.status_code == 400
        assert "uppercase" in exc.value.detail

    def test_rejects_missing_lowercase(self):
        with pytest.raises(HTTPException) as exc:
            validate_password_strength("SECUREVAULT123!#")
        assert exc.value.status_code == 400
        assert "lowercase" in exc.value.detail

    def test_rejects_missing_digit(self):
        with pytest.raises(HTTPException) as exc:
            validate_password_strength("SecureVault!#xyz")
        assert exc.value.status_code == 400
        assert "number" in exc.value.detail

    def test_rejects_missing_special_char(self):
        with pytest.raises(HTTPException) as exc:
            validate_password_strength("SecureVault12345")
        assert exc.value.status_code == 400
        assert "special symbol" in exc.value.detail or "special character" in exc.value.detail

    def test_rejects_dictionary_weak_passwords(self):
        weak_passwords = [
            "Password123!",
            "Admin12345!",
            "Welcome123!",
            "Qwerty12345!",
        ]
        for weak in weak_passwords:
            with pytest.raises(HTTPException) as exc:
                validate_password_strength(weak)
            assert exc.value.status_code == 400
            assert "common or easily guessable" in exc.value.detail

    def test_accepts_strong_passwords(self):
        strong_passwords = [
            "NorthstarCompliance#2026",
            "S3cure!Shield_Audit",
            "Advisor@Portf0lio.99",
            "C0mplianc3-0fficer!x",
        ]
        for strong in strong_passwords:
            # Should not raise any HTTPException
            validate_password_strength(strong)


class TestSecureTokenGeneration:
    """Verifies cryptographically secure invite tokens."""

    def test_generates_unique_tokens(self):
        token1 = generate_secure_token(32)
        token2 = generate_secure_token(32)
        assert token1 != token2
        assert len(token1) >= 40  # urlsafe base64 of 32 bytes is ~43 chars

    def test_custom_byte_lengths(self):
        token_16 = generate_secure_token(16)
        token_32 = generate_secure_token(32)
        assert len(token_32) > len(token_16)


class TestWorkspaceSessionTokens:
    """Verifies that session tokens contain workspace identification."""

    def test_session_token_includes_workspace_id(self):
        ws_id = "11111111-2222-3333-4444-555555555555"
        token = create_session_token(
            user_id="user-123",
            role=Role.officer,
            workspace_id=ws_id,
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        payload = decode_session_token(creds)

        assert payload["sub"] == "user-123"
        assert payload["role"] == "officer"
        assert payload["workspace_id"] == ws_id

    def test_session_token_without_workspace_id_defaults_cleanly(self):
        token = create_session_token(
            user_id="user-456",
            role=Role.advisor,
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        payload = decode_session_token(creds)

        assert payload["sub"] == "user-456"
        assert payload["role"] == "advisor"
        assert payload["workspace_id"] is None


from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
class TestInvitationEndpoints:
    """Verifies API endpoints for invitation and workspace flows."""

    async def test_verify_nonexistent_invitation_token(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/invitations/verify/invalid-fake-token-99999")
            assert resp.status_code == 404
            data = resp.json()
            assert "Invalid or unrecognized invitation" in data["detail"]

    async def test_public_officer_signup_blocked_without_token(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/signup",
                json={
                    "name": "Rogue Officer",
                    "email": "rogue@example.com",
                    "password": "StrongPassword!2026",
                    "role": "officer",
                },
            )
            assert resp.status_code == 403
            data = resp.json()
            assert "Self-registration is disabled" in data["detail"]

    async def test_public_advisor_signup_blocked_without_token(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/signup",
                json={
                    "name": "Rogue Advisor",
                    "email": "rogue.advisor@example.com",
                    "password": "StrongPassword!2026",
                    "role": "advisor",
                },
            )
            assert resp.status_code == 403
            data = resp.json()
            assert "Self-registration is disabled" in data["detail"]

    async def test_lookup_workspaces_empty(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/lookup-workspaces",
                json={"email": "nonexistent.user.test@example.com"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["found"] is False
            assert "No active account or workspace invitation" in data["message"]

