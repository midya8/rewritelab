"""Exact bounded arithmetic rewrite search and independent finite checking."""

__version__ = "0.1.0"
from .search import optimize
from .oracle import verify

from .barriers import atlas
from .barrier_oracle import verify_atlas

from .weights import weights
from .weight_oracle import verify_weights
