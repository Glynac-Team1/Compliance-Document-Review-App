from worker.celery_app import celery_app
from app.core.email import send_email


@celery_app.task(name="app.core.tasks.process_support_request")
def process_support_request(request_id: str, advisor_email: str, admin_email: str | None, subject: str):
    import asyncio
    asyncio.run(_process_support_request_async(request_id, advisor_email, admin_email, subject))


async def _process_support_request_async(request_id: str, advisor_email: str, admin_email: str | None, subject: str):
    await send_email(
        to_email=advisor_email,
        subject="We received your support request",
        html_content=f"<p>Thanks — we've received your request (#{request_id}): <b>{subject}</b>. We'll get back to you soon.</p>",
    )
    if admin_email:
        await send_email(
            to_email=admin_email,
            subject=f"New support request: {subject}",
            html_content=f"<p>A new support request (#{request_id}) was submitted: <b>{subject}</b>. Please review it in the admin panel.</p>",
        )