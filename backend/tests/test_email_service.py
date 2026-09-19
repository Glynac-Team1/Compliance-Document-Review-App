import pytest
import uuid
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta, timezone

from httpx import Response, ASGITransport, AsyncClient
from app.main import app
from app.services.email import BrevoEmailService, EmailDeliveryResult
from app.core.security import create_session_token, hash_password
from models import User, Role, Workspace, WorkspaceInvitation, InvitationStatus
from app.database import AsyncSessionLocal


@pytest.mark.asyncio
async def test_email_service_fallback_mode():
    """Verify graceful fallback when Brevo credentials are not provided."""
    service = BrevoEmailService(api_key=None, sender_email=None)
    result = await service.send_invitation_email(
        recipient_email="advisor@example.com",
        role="advisor",
        workspace_name="Northstar Compliance",
        token="test-token-12345",
    )
    assert result.success is True
    assert result.mode == "console"
    assert result.message_id == "console-dev-fallback"


@pytest.mark.asyncio
async def test_email_service_brevo_dispatch_success():
    """Verify correct REST API payload and header formatting when sending via Brevo."""
    service = BrevoEmailService(
        api_key="xkeysib-mock-api-key",
        sender_email="noreply@northstar.com",
        sender_name="Northstar Compliance",
        frontend_url="http://localhost:3000",
    )

    mock_resp = Response(201, json={"messageId": "<brevo-test-msg-id-789>"})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await service.send_invitation_email(
            recipient_email="officer@example.com",
            role="officer",
            workspace_name="Northstar Compliance",
            token="secure-token-abc",
        )

        assert result.success is True
        assert result.mode == "brevo"
        assert result.message_id == "<brevo-test-msg-id-789>"

        # Verify Brevo API contract
        mock_post.assert_called_once()
        url = mock_post.call_args[0][0]
        kwargs = mock_post.call_args[1]

        assert url == "https://api.brevo.com/v3/smtp/email"
        assert kwargs["headers"]["api-key"] == "xkeysib-mock-api-key"
        assert kwargs["json"]["sender"]["email"] == "noreply@northstar.com"
        assert kwargs["json"]["to"][0]["email"] == "officer@example.com"
        assert "officer" in kwargs["json"]["subject"].lower() or "compliance" in kwargs["json"]["subject"].lower()
        assert "http://localhost:3000/accept-invite?token=secure-token-abc" in kwargs["json"]["htmlContent"]


@pytest.mark.asyncio
async def test_email_service_brevo_dispatch_error():
    """Verify that Brevo API errors are caught cleanly without crashing the service."""
    service = BrevoEmailService(
        api_key="invalid-key",
        sender_email="unverified@northstar.com",
    )

    mock_resp = Response(401, json={"code": "unauthorized", "message": "Key not found"})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await service.send_invitation_email(
            recipient_email="advisor@example.com",
            role="advisor",
            workspace_name="Northstar Compliance",
            token="token-xyz",
        )

        assert result.success is False
        assert result.mode == "brevo"
        assert "401" in result.error


@pytest.mark.asyncio
async def test_resend_invitation_endpoint(client):
    """Verify that an admin can re-trigger Brevo email dispatch for an existing invitation."""
    admin_id = uuid.uuid4()
    workspace_id = uuid.uuid4()
    inv_id = uuid.uuid4()

    async with AsyncSessionLocal() as db:
        workspace = Workspace(
            id=workspace_id,
            name="Test Resend Workspace",
            slug=f"test-resend-{workspace_id.hex[:6]}",
        )
        db.add(workspace)
        await db.commit()

        admin = User(
            id=admin_id,
            name="Admin User",
            email=f"admin-{admin_id.hex[:6]}@example.com",
            password_hash=hash_password("password123"),
            role=Role.officer,
            is_admin=True,
            workspace_id=workspace_id,
        )
        db.add(admin)

        inv = WorkspaceInvitation(
            id=inv_id,
            workspace_id=workspace_id,
            email=f"invitee-{inv_id.hex[:6]}@example.com",
            role=Role.advisor,
            token=f"resend-token-{inv_id.hex}",
            status=InvitationStatus.pending,
            expires_at=datetime.now(timezone.utc) + timedelta(days=2),
        )
        db.add(inv)
        await db.commit()

    admin_token = create_session_token(str(admin_id), Role.officer, is_admin=True, workspace_id=str(workspace_id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            f"/admin/invitations/{inv_id}/resend",
            headers={"Authorization": f"Bearer {admin_token}"},
        )

        assert res.status_code == 200
        data = res.json()
        assert data["email"] == f"invitee-{inv_id.hex[:6]}@example.com"
        assert data["email_dispatched"] is True
        assert "resent" in data["message"].lower()
