"""
Short-lived, single-use tickets for authenticating SSE connections.

The browser's native EventSource API cannot send custom headers, so the
raw JWT can't be passed as a normal Authorization header on the SSE
request. Putting the long-lived JWT directly in the query string leaks it
into access logs, browser history, and referrer headers.

Instead: the client exchanges its JWT for a short-lived, single-use
ticket via an authenticated POST, then opens the SSE connection with
that ticket in the query string. The ticket is useless after one
redemption and expires quickly even if unused.
"""
import secrets
import time
import uuid

TICKET_TTL_SECONDS = 30

_tickets: dict[str, tuple[uuid.UUID, float]] = {}


def issue_ticket(user_id: uuid.UUID) -> str:
    ticket = secrets.token_urlsafe(32)
    _tickets[ticket] = (user_id, time.time() + TICKET_TTL_SECONDS)
    return ticket


def redeem_ticket(ticket: str) -> uuid.UUID | None:
    entry = _tickets.pop(ticket, None)
    if entry is None:
        return None
    user_id, expires_at = entry
    if time.time() > expires_at:
        return None
    return user_id