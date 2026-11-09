import { optimize, expression, size } from "./engine.js";
export function atlas(raw) {
  // Base validation must run before any parsing or filtration decisions.
  const top = optimize(raw),
    sourceSize = size(expression(raw.expression));
  const levels = [3, 5, 7]
    .filter((b) => b <= raw.max_nodes)
    .map((b) => ({
      budget: b,
      report:
        sourceSize > b
          ? null
          : b === raw.max_nodes
            ? top
            : optimize({ ...raw, max_nodes: b }),
    }));
  const maps = new Map(
    levels
      .filter((l) => l.report !== null)
      .map((l) => [
        l.budget,
        new Map(l.report.states.map((s) => [s.expression, s])),
      ]),
  );
  const candidates = top.semantic_terms.map((t) => {
    const nodes = size(expression(t.expression)),
      fitting = Math.max(3, sourceSize, nodes);
    const first =
      [...maps.keys()].find((b) => maps.get(b).has(t.expression)) ?? null;
    return {
      expression: t.expression,
      nodes,
      cost: t.cost,
      first_fitting_budget: fitting,
      first_reachable_budget: first,
      extra_budget: first === null ? null : first - fitting,
      steps: first === null ? null : maps.get(first).get(t.expression).distance,
      status:
        first === null
          ? "not-reached-through-cap"
          : first > fitting
            ? "larger-bridge"
            : "reachable-at-fit",
    };
  });
  return {
    schema: "rewritelab-barriers-v1",
    request: raw,
    source: top.source,
    levels,
    candidates,
  };
}
