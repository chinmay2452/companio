"""
SRS Engine — SM-2 spaced-repetition algorithm.

Implements the SuperMemo-2 scheduling algorithm used to determine
optimal review intervals for flashcards.
"""

from __future__ import annotations

from datetime import date, timedelta


def sm2(
    ease_factor: float,
    interval: int,
    score: int,
) -> tuple[float, int]:
    """Compute the next ease factor and interval using the SM-2 algorithm.

    Args:
        ease_factor: Current ease factor (≥ 1.3).
        interval: Current interval in days.
        score: Self-reported recall quality (0-5).

    Returns:
        A tuple of ``(new_ease_factor, new_interval)``.

    Algorithm
    ---------
    * **score 0-2** (fail): reset interval to 1 day, keep the current
      ease factor unchanged.
    * **score 3-5** (pass):
        - ``new_ef = ef + 0.1 - (5 - score) * (0.08 + (5 - score) * 0.02)``
        - ``new_ef`` is floored at **1.3**.
        - If previous interval was 1 → new interval = 6.
        - If previous interval was 6 → new interval = round(6 × ef).
        - Otherwise → new interval = round(interval × ef).
    """
    if score < 3:
        # Failed recall — reset interval, keep ease factor
        return ease_factor, 1

    # Successful recall — update ease factor
    new_ef: float = (
        ease_factor
        + 0.1
        - (5 - score) * (0.08 + (5 - score) * 0.02)
    )
    new_ef = max(new_ef, 1.3)

    # Compute next interval
    if interval == 1:
        new_interval = 6
    elif interval == 6:
        new_interval = round(6 * new_ef)
    else:
        new_interval = round(interval * new_ef)

    return new_ef, new_interval


def next_review_date(interval_days: int) -> str:
    """Return the next review date as an ISO-8601 string.

    Args:
        interval_days: Number of days until the next review.

    Returns:
        An ISO date string (``YYYY-MM-DD``) representing the review date.
    """
    return (date.today() + timedelta(days=interval_days)).isoformat()
