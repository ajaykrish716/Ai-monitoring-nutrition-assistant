"""
Meal Evidence Service — business logic for the Meal Evidence Upload feature.

Design decisions:
- Images are stored as base64-encoded data URIs inside the `meal_evidence`
  MongoDB document.  This avoids the need for a separate file-storage service
  (S3, local disk, etc.) while keeping the `users` collection untouched.
- Maximum accepted image size: 5 MB (after MIME validation, before base64).
- Accepted MIME types: image/jpeg, image/png, image/webp, image/gif.
- No AI image recognition is performed; evidence is a personal photo record only.
"""

import base64
import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException, status

from app.db.mongodb import get_database

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ALLOWED_MIME_TYPES: set[str] = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_BYTES: int = 5 * 1024 * 1024  # 5 MB
MEAL_TYPES: set[str] = {"Breakfast", "Lunch", "Dinner"}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_image(content_type: str, data: bytes) -> None:
    """
    Raise HTTPException if the uploaded file is not an accepted image or is
    too large.
    """
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported image type '{content_type}'. "
                f"Accepted: {', '.join(sorted(ALLOWED_MIME_TYPES))}."
            ),
        )
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image file exceeds the maximum allowed size of {MAX_IMAGE_BYTES // (1024 * 1024)} MB.",
        )


def _to_data_uri(mime_type: str, data: bytes) -> str:
    """Encode raw bytes as a base64 data URI."""
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime_type};base64,{b64}"


def _doc_to_dict(doc: dict) -> dict:
    """Convert a MongoDB document to a clean dict for schema serialisation."""
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "date": doc["date"],
        "meal_type": doc["meal_type"],
        "planned_meal_name": doc.get("planned_meal_name", ""),
        "notes": doc.get("notes", ""),
        "image_data_uri": doc.get("image_data_uri", ""),
        "image_filename": doc.get("image_filename", ""),
        "image_mime_type": doc.get("image_mime_type", ""),
        "image_size_bytes": doc.get("image_size_bytes", 0),
        "uploaded_at": doc["uploaded_at"],
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def upload_meal_evidence(
    user_id: str,
    date: str,
    meal_type: str,
    planned_meal_name: str,
    notes: str,
    image_filename: str,
    image_mime_type: str,
    image_data: bytes,
) -> dict:
    """
    Validate and store a meal evidence photo.

    One evidence record per user/date/meal_type is enforced — uploading again
    for the same slot replaces the previous record (upsert).

    Returns the saved evidence document as a dict.
    """
    # Normalise meal_type casing
    meal_type_clean = meal_type.strip().capitalize()
    if meal_type_clean not in MEAL_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"meal_type must be one of: {', '.join(sorted(MEAL_TYPES))}.",
        )

    _validate_image(image_mime_type, image_data)

    data_uri = _to_data_uri(image_mime_type, image_data)
    now = datetime.now(timezone.utc)

    db = get_database()

    # Upsert: one evidence slot per (user, date, meal_type)
    filter_q = {
        "user_id": user_id,
        "date": date,
        "meal_type": meal_type_clean,
    }
    update_doc = {
        "$set": {
            "user_id": user_id,
            "date": date,
            "meal_type": meal_type_clean,
            "planned_meal_name": planned_meal_name.strip(),
            "notes": notes.strip(),
            "image_data_uri": data_uri,
            "image_filename": image_filename,
            "image_mime_type": image_mime_type,
            "image_size_bytes": len(image_data),
            "uploaded_at": now,
        }
    }

    result = await db.meal_evidence.find_one_and_update(
        filter_q,
        update_doc,
        upsert=True,
        return_document=True,
    )

    logger.info(
        "Meal evidence stored [user=%s, date=%s, meal=%s, size=%d bytes]",
        user_id,
        date,
        meal_type_clean,
        len(image_data),
    )

    return _doc_to_dict(result)


async def get_evidence_for_date(user_id: str, date: str) -> dict:
    """
    Return all evidence records for the authenticated user on a given date.

    Returns a MealEvidenceListResponse-compatible dict.
    """
    db = get_database()
    cursor = db.meal_evidence.find({"user_id": user_id, "date": date})
    docs = await cursor.to_list(length=100)
    items = [_doc_to_dict(d) for d in docs]
    return {
        "date": date,
        "evidence": items,
        "total": len(items),
    }


async def get_evidence_for_date_meal(
    user_id: str, date: str, meal_type: str
) -> dict | None:
    """
    Return the evidence record for a specific date + meal_type, or None.
    """
    meal_type_clean = meal_type.strip().capitalize()
    db = get_database()
    doc = await db.meal_evidence.find_one(
        {
            "user_id": user_id,
            "date": date,
            "meal_type": meal_type_clean,
        }
    )
    if doc is None:
        return None
    return _doc_to_dict(doc)


async def delete_evidence(user_id: str, evidence_id: str) -> bool:
    """
    Delete an evidence record by ID.  Returns True if deleted, False if not found.
    Users can only delete their own records.
    """
    db = get_database()
    try:
        result = await db.meal_evidence.delete_one(
            {"_id": ObjectId(evidence_id), "user_id": user_id}
        )
    except Exception:
        return False
    return result.deleted_count > 0


async def get_evidence_summary(user_id: str, date: str) -> dict:
    """
    Return a progress/analytics summary of meal evidence for a given date.

    Always counts Breakfast, Lunch, Dinner as the 3 possible meal slots.
    """
    db = get_database()
    cursor = db.meal_evidence.find({"user_id": user_id, "date": date})
    docs = await cursor.to_list(length=10)

    covered = {d["meal_type"].capitalize() for d in docs}
    breakdown = {mt: (mt in covered) for mt in ["Breakfast", "Lunch", "Dinner"]}
    meals_with_evidence = sum(1 for v in breakdown.values() if v)
    pct = round((meals_with_evidence / 3) * 100, 1)

    return {
        "date": date,
        "total_suggested_meals": 3,
        "meals_with_evidence": meals_with_evidence,
        "evidence_completion_pct": pct,
        "meal_breakdown": breakdown,
    }
