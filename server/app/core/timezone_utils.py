"""
Centralized timezone utilities supporting both standard IANA zoneinfo and
cross-platform fallback offsets (e.g. Windows without tzdata).
"""

import re
from datetime import datetime, timezone, timedelta

COMMON_TZ_OFFSETS: dict[str, timedelta] = {
    "UTC": timedelta(hours=0),
    "GMT": timedelta(hours=0),
    "Asia/Kolkata": timedelta(hours=5, minutes=30),
    "Asia/Calcutta": timedelta(hours=5, minutes=30),
    "Asia/Tokyo": timedelta(hours=9),
    "Asia/Singapore": timedelta(hours=8),
    "Asia/Dubai": timedelta(hours=4),
    "Asia/Shanghai": timedelta(hours=8),
    "Asia/Hong_Kong": timedelta(hours=8),
    "America/New_York": timedelta(hours=-5),
    "America/Chicago": timedelta(hours=-6),
    "America/Denver": timedelta(hours=-7),
    "America/Los_Angeles": timedelta(hours=-8),
    "America/Phoenix": timedelta(hours=-7),
    "America/Anchorage": timedelta(hours=-9),
    "Pacific/Honolulu": timedelta(hours=-10),
    "America/Toronto": timedelta(hours=-5),
    "America/Vancouver": timedelta(hours=-8),
    "Europe/London": timedelta(hours=0),
    "Europe/Dublin": timedelta(hours=0),
    "Europe/Paris": timedelta(hours=1),
    "Europe/Berlin": timedelta(hours=1),
    "Europe/Rome": timedelta(hours=1),
    "Europe/Madrid": timedelta(hours=1),
    "Europe/Amsterdam": timedelta(hours=1),
    "Australia/Sydney": timedelta(hours=10),
    "Australia/Melbourne": timedelta(hours=10),
    "Australia/Brisbane": timedelta(hours=10),
    "Australia/Perth": timedelta(hours=8),
    "Pacific/Auckland": timedelta(hours=12),
}


def get_timezone_obj(tz_name: str | None) -> timezone:
    """
    Return a tzinfo object for the given timezone name.
    Tries zoneinfo.ZoneInfo first; falls back to offset dictionary if tzdata is absent.
    """
    if not tz_name or not isinstance(tz_name, str):
        return timezone.utc

    name_clean = tz_name.strip()

    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(name_clean)
    except Exception:
        # Fallback for platforms where tzdata is not installed
        if name_clean in COMMON_TZ_OFFSETS:
            return timezone(COMMON_TZ_OFFSETS[name_clean])

        # Parse UTC/GMT +/- H:MM or +/- H
        match = re.match(r"^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$", name_clean, re.IGNORECASE)
        if match:
            sign = 1 if match.group(1) == "+" else -1
            hrs = int(match.group(2))
            mins = int(match.group(3) or 0)
            return timezone(sign * timedelta(hours=hrs, minutes=mins))

        return timezone.utc


def validate_timezone_name(tz_name: str) -> bool:
    """
    Check whether a timezone string is recognized.
    """
    if not tz_name or not isinstance(tz_name, str):
        return False

    name_clean = tz_name.strip()

    try:
        from zoneinfo import ZoneInfo
        ZoneInfo(name_clean)
        return True
    except Exception:
        if name_clean in COMMON_TZ_OFFSETS:
            return True
        if re.match(r"^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$", name_clean, re.IGNORECASE):
            return True
        if "/" in name_clean and len(name_clean.split("/")) >= 2:
            return True
        return False


def get_user_now(tz_name: str | None) -> datetime:
    """Return the current datetime in the user's timezone."""
    tz_obj = get_timezone_obj(tz_name)
    return datetime.now(tz_obj)
