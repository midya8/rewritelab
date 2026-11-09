"""Verifier reads only independently validated closures, never atlas generation."""
import json
from .model import parse, expression, size, show, cost
from .oracle import verify, universe, signature


def verify_atlas(report):
    try:
        source, cap, costs = parse(report["request"])
        levels = report["levels"]
        budgets = list(range(3, cap+1, 2))
        if type(levels) is not list or len(levels) != len(budgets):
            return False
        validated = {}
        for b, level in zip(budgets, levels):
            if type(level) is not dict or set(level) != {"budget", "report"}:
                return False
            if type(level["budget"]) is not int or level["budget"] != b:
                return False
            r = level["report"]
            if size(source) > b:
                if r is not None:
                    return False
                continue
            if r is None or r["request"] != {**report["request"], "max_nodes": b} or not verify(r):
                return False
            validated[b] = {s["expression"]: s["distance"] for s in r["states"]}
        # Independently enumerate the entire semantic candidate set, and scan
        # valid lower closures in ascending order for each candidate. No atlas,
        # forward rewrite, BFS, coefficient map or generator pool imports.
        expected_rows = []
        for t in universe(cap):
            if signature(t) != signature(source):
                continue
            name = show(t)
            fitting = next(b for b in budgets if b >= max(size(source), size(t)))
            hits = [b for b in budgets if b in validated and name in validated[b]]
            first = min(hits) if hits else None
            expected_rows.append(dict(expression=name, nodes=size(t), cost=cost(t, costs),
                first_fitting_budget=fitting, first_reachable_budget=first,
                extra_budget=None if first is None else first-fitting,
                steps=None if first is None else validated[first][name],
                status="not-reached-through-cap" if first is None else
                    "larger-bridge" if first != fitting else "reachable-at-fit"))
        expected = dict(schema="rewritelab-barriers-v1", request=report["request"],
                        source=show(source), levels=levels, candidates=expected_rows)
        return json.dumps(expected, sort_keys=True, separators=(",", ":")) == json.dumps(report, sort_keys=True, separators=(",", ":"))
    except (KeyError, ValueError, TypeError, IndexError, StopIteration, RecursionError):
        return False
