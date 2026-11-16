"""Tolerate small device/server clock differences in client-supplied timestamps."""
from datetime import datetime, timedelta

# A phone whose clock runs slightly ahead of the server sends "now" as a future instant.
CLOCK_SKEW_TOLERANCE = timedelta(seconds=60)


def not_future(value: datetime, now: datetime) -> datetime:
    """Treat an instant at most CLOCK_SKEW_TOLERANCE ahead of the server as now.

    Later instants are returned unchanged so callers still reject them as future.
    """
    return now if now < value <= now + CLOCK_SKEW_TOLERANCE else value
