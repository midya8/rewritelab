"""Complete allowed-budget filtration, with underlying closure certificates."""
from .model import parse, size, expression
from .search import optimize


def atlas(raw):
    source, cap, costs = parse(raw)
    levels = []
    for b in [3, 5, 7]:
        if b > cap:
            break
        report = None if size(source) > b else optimize({**raw, "max_nodes": b})
        levels.append({"budget": b, "report": report})
    top = levels[-1]["report"]
    maps = {l["budget"]: {s["expression"]: s for s in l["report"]["states"]}
            for l in levels if l["report"] is not None}
    candidates = []
    for term in top["semantic_terms"]:
        name = term["expression"]
        n = size(expression(name))
        fitting = max(3, size(source), n)
        first = next((b for b, states in maps.items() if name in states), None)
        candidates.append(dict(expression=name, nodes=n, cost=term["cost"],
            first_fitting_budget=fitting, first_reachable_budget=first,
            extra_budget=None if first is None else first-fitting,
            steps=None if first is None else maps[first][name]["distance"],
            status="not-reached-through-cap" if first is None else
                "larger-bridge" if first > fitting else "reachable-at-fit"))
    return dict(schema="rewritelab-barriers-v1", request=raw,
                source=top["source"], levels=levels, candidates=candidates)
