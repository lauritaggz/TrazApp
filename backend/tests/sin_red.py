"""Error raised by the guard that keeps automated tests off the real network (see conftest.py)."""


class RedRealBloqueadaError(AssertionError):
    """A test tried to reach a real HTTP server."""
