"""Backward-compatible import path for the application models."""

from app.models import DocumentStatus, Role, User

__all__ = ["DocumentStatus", "Role", "User"]
