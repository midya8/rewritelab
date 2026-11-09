"""Strict finite arithmetic syntax. No implicit associativity or floating point."""

from functools import lru_cache
import math
import re

LEAVES = ("0", "1", "x", "y")


@lru_cache(None)
def show(t):
    return t if isinstance(t, str) else "(" + show(t[1]) + t[0] + show(t[2]) + ")"


@lru_cache(None)
def size(t):
    return 1 if isinstance(t, str) else 1 + size(t[1]) + size(t[2])


def expression(s):
    if not isinstance(s, str) or len(s) > 200 or re.search(r"[^01xy+*() \t\r\n]", s):
        raise ValueError("use 0, 1, x, y and fully parenthesized + or *")
    tokens = re.sub(r"[ \t\r\n]", "", s)
    pos = 0

    def read(depth=0):
        nonlocal pos
        if depth > 6 or pos >= len(tokens):
            raise ValueError("invalid or too-deep expression")
        c = tokens[pos]
        pos += 1
        if c in LEAVES:
            return c
        if c != "(":
            raise ValueError("fully parenthesized expression required")
        a = read(depth + 1)
        if pos >= len(tokens) or tokens[pos] not in "+*":
            raise ValueError("binary + or * required")
        op = tokens[pos]
        pos += 1
        b = read(depth + 1)
        if pos >= len(tokens) or tokens[pos] != ")":
            raise ValueError("closing parenthesis required")
        pos += 1
        return op, a, b

    t = read()
    if pos != len(tokens) or size(t) > 7:
        raise ValueError("one expression of at most seven nodes required")
    return t


def parse(raw):
    if not isinstance(raw, dict) or set(raw) != {"expression", "max_nodes", "costs"}:
        raise ValueError("exact expression, max_nodes and costs keys required")

    def integer(v):
        if (
            isinstance(v, bool)
            or not isinstance(v, (int, float))
            or (isinstance(v, float) and (not math.isfinite(v) or not v.is_integer()))
        ):
            raise ValueError("integral JSON number required")
        return int(v)

    b = integer(raw["max_nodes"])
    if b not in [3, 5, 7]:
        raise ValueError("max_nodes must be 3, 5 or 7")
    c = raw["costs"]
    if (
        not isinstance(c, dict)
        or set(c) != {"add", "multiply", "leaf"}
        or any(not 1 <= integer(v) <= 8 for v in c.values())
    ):
        raise ValueError("add, multiply and leaf costs must be integers 1..8")
    c = {k: integer(v) for k, v in c.items()}
    t = expression(raw["expression"])
    if size(t) > b:
        raise ValueError("source exceeds intermediate node budget")
    return t, b, c


def cost(t, c):
    if isinstance(t, str):
        return c["leaf"]
    return c["add" if t[0] == "+" else "multiply"] + cost(t[1], c) + cost(t[2], c)
