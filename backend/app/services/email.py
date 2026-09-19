import logging
import httpx
from typing import Optional
from pydantic import BaseModel
from app.config import settings

logger = logging.getLogger("compliance.email")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class EmailDeliveryResult(BaseModel):
    success: bool
    mode: str  # "brevo" or "console"
    message_id: Optional[str] = None
    error: Optional[str] = None


class BrevoEmailService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        sender_email: Optional[str] = None,
        sender_name: Optional[str] = None,
        frontend_url: Optional[str] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.brevo_api_key
        self.sender_email = sender_email if sender_email is not None else settings.brevo_sender_email
        self.sender_name = sender_name or settings.brevo_sender_name or "Northstar Compliance"
        self.frontend_url = (frontend_url or settings.frontend_url or "http://localhost:3000").rstrip("/")

    def _format_role_title(self, role: str) -> str:
        role_lower = role.lower()
        if "officer" in role_lower:
            return "Compliance Officer"
        elif "advisor" in role_lower:
            return "Financial Advisor"
        return role.capitalize()

    def _generate_invitation_html(
        self,
        recipient_email: str,
        role_title: str,
        workspace_name: str,
        invite_url: str,
    ) -> str:
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to join {workspace_name}</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 24px;
      line-height: 1.6;
    }}
    .container {{
      max-width: 580px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      background: #0f172a;
      padding: 32px;
      text-align: center;
    }}
    .header h1 {{
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.025em;
    }}
    .header p {{
      color: #94a3b8;
      margin: 6px 0 0 0;
      font-size: 13px;
    }}
    .content {{
      padding: 36px 32px;
    }}
    .badge {{
      display: inline-block;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 20px;
      border: 1px solid #cbd5e1;
    }}
    .btn {{
      display: inline-block;
      background: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 8px;
      margin: 24px 0;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
    }}
    .url-fallback {{
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      word-break: break-all;
      color: #475569;
      margin-top: 16px;
    }}
    .footer {{
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{workspace_name}</h1>
      <p>Institutional Document Compliance Portal</p>
    </div>
    <div class="content">
      <h2 style="margin-top:0; font-size:18px; color:#0f172a;">You've been invited to join {workspace_name}</h2>
      <p style="color:#334155; font-size:14px; margin-top:16px;">
        You have been invited to join the <strong>{workspace_name}</strong> workspace as a <strong>{role_title}</strong>.
      </p>
      <p style="color:#334155; font-size:14px;">
        Please click the button below to accept your invitation and set up your password:
      </p>
      <div style="text-align:center;">
        <a href="{invite_url}" class="btn" target="_blank">Accept Invitation &amp; Set Password</a>
      </div>
      <p style="color:#64748b; font-size:12px; margin-top:20px;">
        <em>This single-use invitation link will expire in 7 days.</em>
      </p>
      <div class="url-fallback">
        <strong>Direct Link:</strong><br>
        <a href="{invite_url}" style="color:#2563eb;">{invite_url}</a>
      </div>
    </div>
    <div class="footer">
      {workspace_name} Document Compliance Portal.<br>
      Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
"""

    def _generate_invitation_text(
        self,
        recipient_email: str,
        role_title: str,
        workspace_name: str,
        invite_url: str,
    ) -> str:
        return (
            f"Hello,\n\n"
            f"You have been invited to join the {workspace_name} workspace as a {role_title}.\n\n"
            f"To accept your invitation and set up your password, please visit:\n"
            f"{invite_url}\n\n"
            f"This invitation link expires in 7 days.\n\n"
            f"Best regards,\n"
            f"{workspace_name}"
        )

    async def send_invitation_email(
        self,
        recipient_email: str,
        role: str,
        workspace_name: str,
        token: str,
    ) -> EmailDeliveryResult:
        invite_url = f"{self.frontend_url}/accept-invite?token={token}"
        role_title = self._format_role_title(role)
        subject = f"Invitation to join {workspace_name} Compliance Workspace"

        html_content = self._generate_invitation_html(
            recipient_email=recipient_email,
            role_title=role_title,
            workspace_name=workspace_name,
            invite_url=invite_url,
        )
        text_content = self._generate_invitation_text(
            recipient_email=recipient_email,
            role_title=role_title,
            workspace_name=workspace_name,
            invite_url=invite_url,
        )

        # 1. Fallback Mode: If Brevo credentials are not configured, log to console
        if not self.api_key or not self.sender_email:
            logger.info(
                "\n"
                "======================== [LOCAL DEV EMAIL DISPATCH] ========================\n"
                f"To:          {recipient_email}\n"
                f"From:        {self.sender_name} <{self.sender_email or 'not-configured'}>\n"
                f"Subject:     {subject}\n"
                f"Role:        {role_title}\n"
                f"Invite Link: {invite_url}\n"
                "Notice:      BREVO_API_KEY or BREVO_SENDER_EMAIL is unset. Email was not\n"
                "             sent externally. Use the invite link above to test locally.\n"
                "============================================================================"
            )
            return EmailDeliveryResult(
                success=True,
                mode="console",
                message_id="console-dev-fallback",
            )

        # 2. Live Brevo REST API Dispatch
        headers = {
            "accept": "application/json",
            "api-key": self.api_key,
            "content-type": "application/json",
        }
        payload = {
            "sender": {
                "name": self.sender_name,
                "email": self.sender_email,
            },
            "to": [
                {
                    "email": recipient_email,
                    "name": recipient_email.split("@")[0],
                }
            ],
            "subject": subject,
            "htmlContent": html_content,
            "textContent": text_content,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(BREVO_API_URL, headers=headers, json=payload)
                
                if response.status_code in (200, 201):
                    data = response.json()
                    msg_id = data.get("messageId", "sent")
                    logger.info(f"Successfully dispatched Brevo email to {recipient_email} (messageId: {msg_id})")
                    return EmailDeliveryResult(
                        success=True,
                        mode="brevo",
                        message_id=msg_id,
                    )
                else:
                    error_text = response.text
                    logger.error(f"Brevo API error ({response.status_code}): {error_text}")
                    return EmailDeliveryResult(
                        success=False,
                        mode="brevo",
                        error=f"Brevo HTTP {response.status_code}: {error_text}",
                    )
        except Exception as exc:
            logger.error(f"Failed to connect to Brevo API: {exc}")
            return EmailDeliveryResult(
                success=False,
                mode="brevo",
                error=str(exc),
            )


email_service = BrevoEmailService()
