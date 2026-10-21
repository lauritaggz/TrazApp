"""Retrieval of commercial product information from external sources (HU13).

One adapter per source behind the `FuenteProducto` interface; the service knows nothing about
any particular source, so another one (HU07) plugs in without touching the rest.
"""
