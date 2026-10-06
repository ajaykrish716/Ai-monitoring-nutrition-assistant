"""
Meal Evidence API routes.

All endpoints require JWT authentication via the existing get_current_user dependency.
Users may only access their own evidence records.

Routes
------
POST   /meal-evidence/upload              — Upload a photo as evidence for a planned meal
GET    /meal-evidence/{date}              — Get all evidence for a date (YYYY-MM-DD)
GET    /meal-evidence/{date}/{meal_type}  — Get evidence for a specific date + meal type
GET    /meal-evidence/{date}/summary      — Get evidence analytics summary for a date
DELETE /meal-evidence/{evidence_id}       — Delete an evidence record by its ID
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.models.user import UserInDB
from app.schemas.meal_evidence import (
    MealEvidenceItem,
    MealEvidenceListResponse,
    MealEvidenceSummary,
)
from app.services.auth_service import get_current_user
from app.services.meal_evidence_service import (
    delete_evidence,
    get_evidence_for_date,
    get_evidence_for_date_meal,
    get_evidence_summary,
    upload_meal_evidence,
)

router = APIRouter(prefix="/meal-evidence", tags=["Meal Evidence"])


# ---------------------------------------------------------------------------
# POST /meal-evidence/upload
# ---------------------------------------------------------------------------

@router.post(
    "/upload",
    response_model=MealEvidenceItem,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a meal photo as evidence for a planned meal",
)
async def upload_evidence(
    # Multipart form fields
    date: str = Form(..., description="YYYY-MM-DD"),
    meal_type: str = Form(..., description="Breakfast | Lunch | Dinner"),
    planned_meal_name: str = Form(default="", description="Meal name from the plan"),
    notes: str = Form(default="", description="Optional personal note"),
    image: UploadFile = File(..., description="Photo of the prepared meal"),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Accept a multipart/form-data upload containing the meal photo and metadata.

    - Validates MIME type (jpeg, png, webp, gif) and size (≤ 5 MB).
    - Stores image as a base64 data URI inside the `meal_evidence` collection.
    - One slot per (user, date, meal_type) — re-uploading replaces previous.
    - The photo is personal evidence only; no AI recognition is performed.
    """
    image_data = await image.read()
    content_type = image.content_type or "application/octet-stream"
    filename = image.filename or "upload"

    try:
        result = await upload_meal_evidence(
            user_id=current_user.id,
            date=date,
            meal_type=meal_type,
            planned_meal_name=planned_meal_name,
            notes=notes,
            image_filename=filename,
            image_mime_type=content_type,
            image_data=image_data,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /meal-evidence/{date}
# ---------------------------------------------------------------------------

@router.get(
    "/{date}",
    response_model=MealEvidenceListResponse,
    summary="Get all meal evidence records for a given date",
)
async def list_evidence_for_date(
    date: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Return every evidence record the authenticated user uploaded for the given
    date (YYYY-MM-DD).  Returns an empty list if none exist.
    """
    try:
        return await get_evidence_for_date(current_user.id, date)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /meal-evidence/{date}/summary
# NOTE: This route MUST be registered before /{date}/{meal_type} so that
#       FastAPI does not mistake "summary" for a meal_type path segment.
# ---------------------------------------------------------------------------

@router.get(
    "/{date}/summary",
    response_model=MealEvidenceSummary,
    summary="Get evidence analytics summary for a date",
)
async def evidence_summary(
    date: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Return an analytics summary:
    - total suggested meals (always 3)
    - meals with evidence uploaded
    - evidence completion percentage
    - per-meal breakdown (Breakfast / Lunch / Dinner)
    """
    try:
        return await get_evidence_summary(current_user.id, date)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# GET /meal-evidence/{date}/{meal_type}
# ---------------------------------------------------------------------------

@router.get(
    "/{date}/{meal_type}",
    response_model=MealEvidenceItem,
    summary="Get evidence for a specific date and meal type",
)
async def get_evidence_by_meal(
    date: str,
    meal_type: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Return the single evidence record for (date, meal_type), or 404 if none.
    """
    try:
        record = await get_evidence_for_date_meal(current_user.id, date, meal_type)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No evidence found for {meal_type} on {date}.",
            )
        return record
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# DELETE /meal-evidence/{evidence_id}
# ---------------------------------------------------------------------------

@router.delete(
    "/{evidence_id}",
    summary="Delete a meal evidence record by ID",
)
async def remove_evidence(
    evidence_id: str,
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Permanently delete an evidence record.
    Users can only delete their own records (enforced in the service).
    """
    try:
        deleted = await delete_evidence(current_user.id, evidence_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evidence record not found.",
            )
        return {"message": "Evidence deleted successfully."}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
