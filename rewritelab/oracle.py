"""Independent generic-pattern closure checker and finite polynomial identity oracle."""

from functools import lru_cache
import json
from .model import parse, expression, show, size, cost

# Explicit patterns, not the forward matcher's cases. Uppercase symbols bind
# arbitrary syntax trees. Both directions of every equality are checked.
EQUATIONS = [
    ("add-commute", ("+", "A", "B"), ("+", "B", "A")),
    ("mul-commute", ("*", "A", "B"), ("*", "B", "A")),
    ("add-associate-right", ("+", ("+", "A", "B"), "C"), ("+", "A", ("+", "B", "C"))),
    ("mul-associate-right", ("*", ("*", "A", "B"), "C"), ("*", "A", ("*", "B", "C"))),
    ("add-zero-right-drop", ("+", "A", "0"), "A"),
    ("add-zero-left-drop", ("+", "0", "A"), "A"),
    ("mul-one-right-drop", ("*", "A", "1"), "A"),
    ("mul-one-left-drop", ("*", "1", "A"), "A"),
    ("mul-zero-right-drop", ("*", "A", "0"), "0"),
    ("mul-zero-left-drop", ("*", "0", "A"), "0"),
    (
        "distribute-left",
        ("*", "A", ("+", "B", "C")),
        ("+", ("*", "A", "B"), ("*", "A", "C")),
    ),
    (
        "distribute-right",
        ("*", ("+", "A", "B"), "C"),
        ("+", ("*", "A", "C"), ("*", "B", "C")),
    ),
]
REVERSE = {
    "add-associate-right": "add-associate-left",
    "mul-associate-right": "mul-associate-left",
    "distribute-left": "factor-left",
    "distribute-right": "factor-right",
}
PATTERNS = []
for name, a, b in EQUATIONS:
    PATTERNS.append((name, a, b))
    if name not in ["add-commute", "mul-commute"]:
        PATTERNS.append((REVERSE.get(name, name.replace("-drop", "-insert")), b, a))


@lru_cache(None)
def universe(bound):
    levels = {1: ["0", "1", "x", "y"]}
    for n in range(3, bound + 1, 2):
        level = []
        for a in range(1, n - 1, 2):
            for left in levels[a]:
                for right in levels[n - 1 - a]:
                    level.extend([("+", left, right), ("*", left, right)])
        levels[n] = level
    return (
        tuple(sorted((t for level in levels.values() for t in level), key=show))
        if bound >= 1
        else ()
    )


def match(p, t, env):
    if isinstance(p, str) and p in "ABC":
        if p in env:
            return env[p] == t
        env[p] = t
        return True
    if isinstance(p, str):
        return p == t
    return (
        not isinstance(t, str)
        and p[0] == t[0]
        and match(p[1], t[1], env)
        and match(p[2], t[2], env)
    )


def instantiate(p, env):
    if isinstance(p, str):
        return env[p] if p in "ABC" else p
    return p[0], instantiate(p[1], env), instantiate(p[2], env)


@lru_cache(None)
def edges(t, bound):
    out = []
    for name, a, b in PATTERNS:
        env = {}
        if not match(a, t, env):
            continue
        # Only reverse annihilation has an unbound variable, A.
        environments = (
            [env]
            if not (b != a and "A" not in env and name.startswith("mul-zero-"))
            else [{**env, "A": u} for u in universe(bound - 2)]
        )
        for mapping in environments:
            v = instantiate(b, mapping)
            if v != t and size(v) <= bound:
                out.append((v, name, ""))
    if not isinstance(t, str):
        op, a, b = t
        for v, name, path in edges(a, bound - 1 - size(b)):
            out.append(((op, v, b), name, "L" + path))
        for v, name, path in edges(b, bound - 1 - size(a)):
            out.append(((op, a, v), name, "R" + path))
    return tuple(out)


def evaluate(t, x, y):
    if isinstance(t, str):
        return {"0": 0, "1": 1, "x": x, "y": y}[t]
    a, b = evaluate(t[1], x, y), evaluate(t[2], x, y)
    return a + b if t[0] == "+" else a * b


@lru_cache(None)
def signature(t):
    # Degree in either variable is <=4 (at most four leaves). Agreement on
    # 5x5 distinct integer points proves equality over Q, not merely a sample.
    return tuple(evaluate(t, x, y) for x in range(5) for y in range(5))


def verify(report):
    try:
        source, bound, c = parse(report["request"])
        rows = report["states"]
        trees = {}
        by = {}
        if not isinstance(rows, list) or not rows:
            return False
        for row in rows:
            if not isinstance(row, dict) or set(row) != {
                "expression",
                "cost",
                "distance",
                "parent",
                "rule",
                "path",
            }:
                return False
            t = expression(row["expression"])
            if (
                size(t) > bound
                or show(t) != row["expression"]
                or row["expression"] in by
            ):
                return False
            if (
                type(row["cost"]) is not int
                or row["cost"] != cost(t, c)
                or type(row["distance"]) is not int
                or row["distance"] < 0
            ):
                return False
            trees[row["expression"]] = t
            by[row["expression"]] = row
        if [r["expression"] for r in rows] != sorted(by):
            return False
        for name, row in by.items():
            if row["distance"] == 0:
                if name != show(source) or any(
                    row[k] is not None for k in ["parent", "rule", "path"]
                ):
                    return False
            else:
                if (
                    any(type(row[k]) is not str for k in ["parent", "rule", "path"])
                    or row["parent"] not in by
                ):
                    return False
                parent = by[row["parent"]]
                if parent["distance"] + 1 != row["distance"] or not any(
                    show(v) == name and rule == row["rule"] and path == row["path"]
                    for v, rule, path in edges(trees[row["parent"]], bound)
                ):
                    return False
            # Every legal outgoing term must be in the claimed closure. Distance
            # inequalities plus parent paths prove the exact shortest distances.
            for v, _, _ in edges(trees[name], bound):
                n = show(v)
                if n not in by or by[n]["distance"] > row["distance"] + 1:
                    return False
        if show(source) not in by:
            return False
        terms = universe(bound)
        sig = signature(source)
        semantic = [
            dict(expression=show(t), cost=cost(t, c), reachable=show(t) in by)
            for t in terms
            if signature(t) == sig
        ]

        def best(rs):
            m = min(r["cost"] for r in rs)
            ties = [r["expression"] for r in rs if r["cost"] == m]
            return dict(cost=m, expression=ties[0], ties=ties)

        br, bs = best(rows), best(semantic)
        expected = dict(
            schema="rewritelab-v1",
            request=report["request"],
            source=show(source),
            universe_size=len(terms),
            reachable_count=len(rows),
            semantic_equivalent_count=len(semantic),
            source_cost=cost(source, c),
            best_reachable=br,
            best_semantic=bs,
            objective_gap=br["cost"] - bs["cost"],
            states=rows,
            semantic_terms=semantic,
        )
        return json.dumps(
            expected, sort_keys=True, separators=(",", ":")
        ) == json.dumps(report, sort_keys=True, separators=(",", ":"))
    except (ValueError, TypeError, KeyError, RecursionError, IndexError):
        return False
