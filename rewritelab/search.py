"""Breadth-first bounded rewrite closure, separate from polynomial semantics."""

from collections import deque
from .model import parse, show, cost
from .rewrites import pool, neighbours


def polynomial(t):
    if isinstance(t, str):
        return {"0": {}, "1": {(0, 0): 1}, "x": {(1, 0): 1}, "y": {(0, 1): 1}}[t]
    a, b = polynomial(t[1]), polynomial(t[2])
    out = {}
    if t[0] == "+":
        for p, v in list(a.items()) + list(b.items()):
            out[p] = out.get(p, 0) + v
    else:
        for (i, j), v in a.items():
            for (k, l), w in b.items():
                out[i + k, j + l] = out.get((i + k, j + l), 0) + v * w
    return out


def optimize(raw):
    source, bound, c = parse(raw)
    seen = {
        source: dict(
            expression=show(source),
            cost=cost(source, c),
            distance=0,
            parent=None,
            rule=None,
            path=None,
        )
    }
    queue = deque([source])
    while queue:
        t = queue.popleft()
        for u, rule, path in neighbours(t, bound):
            if u in seen:
                continue
            seen[u] = dict(
                expression=show(u),
                cost=cost(u, c),
                distance=seen[t]["distance"] + 1,
                parent=show(t),
                rule=rule,
                path=path,
            )
            queue.append(u)
    terms = pool(bound)
    poly = polynomial(source)
    semantic = [
        dict(expression=show(t), cost=cost(t, c), reachable=t in seen)
        for t in terms
        if polynomial(t) == poly
    ]
    states = sorted(seen.values(), key=lambda r: r["expression"])

    def best(rows):
        m = min(r["cost"] for r in rows)
        ties = [r["expression"] for r in rows if r["cost"] == m]
        return dict(cost=m, expression=ties[0], ties=ties)

    br, bs = best(states), best(semantic)
    return dict(
        schema="rewritelab-v1",
        request=raw,
        source=show(source),
        universe_size=len(terms),
        reachable_count=len(states),
        semantic_equivalent_count=len(semantic),
        source_cost=cost(source, c),
        best_reachable=br,
        best_semantic=bs,
        objective_gap=br["cost"] - bs["cost"],
        states=states,
        semantic_terms=semantic,
    )
