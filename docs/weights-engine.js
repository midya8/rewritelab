import { optimize, expression } from "./engine.js";
function counts(t) {
  if (typeof t === "string") return [0, 0, 1];
  const a = counts(t[1]),
    b = counts(t[2]);
  return [
    a[0] + b[0] + (t[0] === "+"),
    a[1] + b[1] + (t[0] === "*"),
    a[2] + b[2],
  ];
}
export function weights(raw) {
  // Validate original weights too, even though certificate weights are units.
  optimize(raw);
  const closure = optimize({ ...raw, costs: { add: 1, multiply: 1, leaf: 1 } }),
    groups = new Map();
  for (const row of closure.semantic_terms) {
    const vector = counts(expression(row.expression)),
      key = vector.join(",");
    if (!groups.has(key))
      groups.set(key, { vector, terms: [], reachable_terms: [] });
    const g = groups.get(key);
    g.terms.push(row.expression);
    if (row.reachable) g.reachable_terms.push(row.expression);
  }
  const rows = [...groups.values()]
      .sort(
        (a, b) =>
          a.vector[0] - b.vector[0] ||
          a.vector[1] - b.vector[1] ||
          a.vector[2] - b.vector[2],
      )
      .map((r, id) => ({ id, ...r })),
    outcomes = [],
    wins = rows.map(() => ({ semantic: 0, reachable: 0 }));
  for (let a = 1; a <= 8; a++)
    for (let m = 1; m <= 8; m++)
      for (let l = 1; l <= 8; l++) {
        const values = rows.map(
            (r) => r.vector[0] * a + r.vector[1] * m + r.vector[2] * l,
          ),
          semantic = Math.min(...values),
          reachable = Math.min(
            ...values.filter((_, i) => rows[i].reachable_terms.length),
          ),
          st = rows.filter((_, i) => values[i] === semantic).map((r) => r.id),
          rt = rows
            .filter(
              (r, i) => values[i] === reachable && r.reachable_terms.length,
            )
            .map((r) => r.id);
        st.forEach((i) => wins[i].semantic++);
        rt.forEach((i) => wins[i].reachable++);
        outcomes.push({
          costs: { add: a, multiply: m, leaf: l },
          semantic_cost: semantic,
          reachable_cost: reachable,
          gap: reachable - semantic,
          semantic_groups: st,
          reachable_groups: rt,
        });
      }
  for (const row of rows) {
    row.dominated_by = rows
      .filter(
        (r) => r.id !== row.id && r.vector.every((v, i) => v <= row.vector[i]),
      )
      .map((r) => r.id);
    row.semantic_wins = wins[row.id].semantic;
    row.reachable_wins = wins[row.id].reachable;
  }
  return {
    schema: "rewritelab-weights-v1",
    request: raw,
    source: closure.source,
    closure,
    groups: rows,
    outcomes,
  };
}
