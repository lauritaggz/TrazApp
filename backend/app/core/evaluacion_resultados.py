"""Percentage of positive answers (HU11, T11-03): integer, rounded half up, in integer arithmetic."""


def porcentaje_positivas(positivas: int, total: int) -> int | None:
    """`(200 * positivas + total) // (2 * total)`; `None` without answers (never 0 %).

    Not `round()`: Python rounds halves to the even number (12.5 -> 12), and 1 of 8 must be 13.
    """
    if total <= 0:
        return None
    return (200 * positivas + total) // (2 * total)
