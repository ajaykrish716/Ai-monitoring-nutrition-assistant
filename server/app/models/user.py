"""
Internal user model — represents a user document as stored in MongoDB.

Profile data is stored as a dynamic dict populated during AI onboarding.
No hard-coded nutrition/fitness fields.
"""

from datetime import datetime


class UserInDB:
    """
    Lightweight wrapper around a raw MongoDB user document.

    Not a Pydantic model — used only when reading from the database so that
    service code can work with attribute access instead of raw dicts.
    """

    def __init__(self, doc: dict) -> None:
        self.id: str = str(doc["_id"])
        self.email: str = doc["email"]
        self.password_hash: str = doc["password_hash"]
        self.name: str = doc.get("name", "")
        self.onboarding_complete: bool = doc.get("onboarding_complete", False)
        self.profile: dict = doc.get("profile", {})
        self.conversation_history: list[dict] = doc.get("conversation_history", [])
        self.created_at: datetime = doc.get("created_at", datetime.min)
