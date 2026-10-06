"""
Progress Report API routes — generate and download the personalized PDF progress report.
"""

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
import io

from app.models.user import UserInDB
from app.services.auth_service import get_current_user
from app.services.progress_report_service import (
    generate_progress_report,
    build_report_filename,
)
from app.db.mongodb import get_database
from bson import ObjectId

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/progress",
    summary="Generate and stream the user's personalized PDF progress report",
    response_class=Response,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "PDF progress report",
        },
        400: {"description": "No active plan found"},
        404: {"description": "User not found"},
        500: {"description": "PDF generation error"},
    },
)
async def get_progress_report(
    download: bool = Query(
        default=False,
        description="If true, set Content-Disposition to attachment (force download). "
                    "If false (default), set to inline (open in browser).",
    ),
    current_user: UserInDB = Depends(get_current_user),
):
    """
    Generate the authenticated user's personalized PDF nutrition progress report.

    Security:
    - Requires valid JWT (get_current_user dependency).
    - Always uses the JWT-authenticated user's ID — never an arbitrary user_id from the request.
    - The user can only access their own report.

    Query params:
    - download=false (default): returns PDF inline (opens in browser tab).
    - download=true: returns PDF as attachment (triggers browser download).
    """
    user_id = current_user.id

    try:
        pdf_bytes = await generate_progress_report(user_id)
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "PDF generation library (reportlab) is not installed on the server. "
                "Run: pip install reportlab"
            ),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate progress report: {exc}",
        )

    # Build filename from actual user data
    db = get_database()
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    user_name = (user_doc or {}).get("name", "User")
    meta = (user_doc or {}).get("plan_progress_meta", {})
    start_date = meta.get("start_date", "")
    end_date = meta.get("end_date", "")

    filename = build_report_filename(user_name, start_date, end_date)
    disposition = "attachment" if download else "inline"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
