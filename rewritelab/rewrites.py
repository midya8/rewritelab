"""Direct algebraic rewrite implementation over the complete finite grammar."""

from functools import lru_cache
from .model import LEAVES, size, show


@lru_cache(None)
def pool(bound):
    @lru_cache(None)
    def exact(n):
        if n == 1:
            return LEAVES
        return tuple(
            (op, a, b)
            for na in range(1, n - 1, 2)
            for a in exact(na)
            for b in exact(n - 1 - na)
            for op in ["+", "*"]
        )

    return tuple(
        sorted((t for n in range(1, bound + 1, 2) for t in exact(n)), key=show)
    )


@lru_cache(None)
def roots(t, bound):
    result = []

    def emit(rule, new):
        if new != t and size(new) <= bound:
            result.append((new, rule, ""))

    emit("add-zero-right-insert", ("+", t, "0"))
    emit("add-zero-left-insert", ("+", "0", t))
    emit("mul-one-right-insert", ("*", t, "1"))
    emit("mul-one-left-insert", ("*", "1", t))
    if t == "0":
        for a in pool(bound - 2):
            emit("mul-zero-right-insert", ("*", a, "0"))
            emit("mul-zero-left-insert", ("*", "0", a))
    if not isinstance(t, str):
        op, a, b = t
        prefix = "add" if op == "+" else "mul"
        emit(prefix + "-commute", (op, b, a))
        if not isinstance(a, str) and a[0] == op:
            emit(prefix + "-associate-right", (op, a[1], (op, a[2], b)))
        if not isinstance(b, str) and b[0] == op:
            emit(prefix + "-associate-left", (op, (op, a, b[1]), b[2]))
        if op == "+":
            if b == "0":
                emit("add-zero-right-drop", a)
            if a == "0":
                emit("add-zero-left-drop", b)
            if (
                not isinstance(a, str)
                and not isinstance(b, str)
                and a[0] == b[0] == "*"
            ):
                if a[1] == b[1]:
                    emit("factor-left", ("*", a[1], ("+", a[2], b[2])))
                if a[2] == b[2]:
                    emit("factor-right", ("*", ("+", a[1], b[1]), a[2]))
        else:
            if b == "1":
                emit("mul-one-right-drop", a)
            if a == "1":
                emit("mul-one-left-drop", b)
            if b == "0":
                emit("mul-zero-right-drop", "0")
            if a == "0":
                emit("mul-zero-left-drop", "0")
            if not isinstance(b, str) and b[0] == "+":
                emit("distribute-left", ("+", ("*", a, b[1]), ("*", a, b[2])))
            if not isinstance(a, str) and a[0] == "+":
                emit("distribute-right", ("+", ("*", a[1], b), ("*", a[2], b)))
    return tuple(result)


@lru_cache(None)
def neighbours(t, bound):
    rows = list(roots(t, bound))
    if not isinstance(t, str):
        op, a, b = t
        rows += [
            ((op, u, b), rule, "L" + path)
            for u, rule, path in neighbours(a, bound - 1 - size(b))
        ]
        rows += [
            ((op, a, u), rule, "R" + path)
            for u, rule, path in neighbours(b, bound - 1 - size(a))
        ]
    # A term can have multiple proofs of the same edge. Keep the lexical one.
    unique = {}
    for u, rule, path in sorted(rows, key=lambda x: (show(x[0]), x[1], x[2])):
        unique.setdefault(u, (u, rule, path))
    return tuple(unique.values())
