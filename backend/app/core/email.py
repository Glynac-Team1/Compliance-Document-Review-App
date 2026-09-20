import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


async def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not settings.brevo_api_key:
        logger.info(f"[email fallback] to={to_email} subject={subject!r} (Brevo not configured)")
        return False

    payload = {
        "sender": {"email": settings.brevo_sender_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content,
    }
    headers = {
        "accept": "application/json",
        "api-key": settings.brevo_api_key,
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(BREVO_API_URL, json=payload, headers=headers)
            response.raise_for_status()
        return True
    except httpx.HTTPError as e:
        logger.error(f"Brevo send failed: to={to_email} subject={subject!r} error={e}")
        return False