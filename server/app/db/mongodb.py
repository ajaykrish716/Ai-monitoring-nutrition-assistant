"""
Async MongoDB connection management using Motor.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

# ---------------------------------------------------------------------------
# Module-level client reference
# ---------------------------------------------------------------------------
_client: AsyncIOMotorClient | None = None
_database: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Create the Motor client and select the configured database."""
    global _client, _database
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_url)
    _database = _client[settings.database_name]

    # Create a unique index on email to enforce uniqueness at the DB level
    await _database.users.create_index("email", unique=True)
    await _database.users.create_index("onboarding_complete")


async def close_db() -> None:
    """Close the Motor client connection."""
    global _client, _database
    if _client is not None:
        _client.close()
        _client = None
        _database = None


def get_database() -> AsyncIOMotorDatabase:
    """
    Return the current database handle.

    Raises
    ------
    RuntimeError
        If called before ``connect_db()``.
    """
    if _database is None:
        raise RuntimeError("Database not initialised — call connect_db() first.")
    return _database
