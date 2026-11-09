import { optimize, expression } from "./engine.js";
// All geometry is rational BigInt arithmetic. Number is used only after the
// reduced vertex components have been proved safe to serialize as integers.
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
};
const Q = (a, b = 1n) => {
  a = BigInt(a);
  b = BigInt(b);
  if (!b) throw Error("zero denominator");
  if (b < 0n) {
    a = -a;
    b = -b;
  }
  const g = gcd(a, b);
  return [a / g, b / g];
};
const add = (a, b) => Q(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const neg = (a) => [-a[0], a[1]];
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => Q(a[0] * b[0], a[1] * b[1]);
const div = (a, b) => Q(a[0] * b[1], a[1] * b[0]);
const cmp = (a, b) => {
  const d = a[0] * b[1] - b[0] * a[1];
  return d < 0n ? -1 : d > 0n ? 1 : 0;
};
const equal = (p, q) => p.every((x, k) => cmp(x, q[k]) === 0);
const zero = Q(0),
  one = Q(1);
function clip(poly, line) {
  const value = (p) =>
    add(add(mul(Q(line[0]), p[0]), mul(Q(line[1]), p[1])), Q(line[2]));
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      vp = value(p),
      vq = value(q);
    if (cmp(vp, zero) <= 0) out.push(p);
    if (cmp(vp, zero) * cmp(vq, zero) < 0) {
      const t = div(vp, sub(vp, vq));
      out.push(p.map((x, k) => add(x, mul(t, sub(q[k], x)))));
    }
  }
  let unique = [];
  for (const p of out) if (!unique.some((q) => equal(p, q))) unique.push(p);
  let changed = true;
  while (unique.length > 2 && changed) {
    changed = false;
    for (let i = 0; i < unique.length; i++) {
      const p = unique[i],
        u = unique[(i + unique.length - 1) % unique.length],
        v = unique[(i + 1) % unique.length];
      const cross = sub(
        mul(sub(p[0], u[0]), sub(v[1], p[1])),
        mul(sub(p[1], u[1]), sub(v[0], p[0])),
      );
      if (cmp(cross, zero) === 0 && !equal(p, u) && !equal(p, v)) {
        unique.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return unique;
}
function region(v, others) {
  let poly = [
    [zero, zero],
    [one, zero],
    [zero, one],
  ];
  for (const u of others) {
    const d = v.map((x, k) => x - u[k]);
    poly = clip(poly, [d[0] - d[2], d[1] - d[2], d[2]]);
  }
  const ps = poly
    .map(([a, m]) => [a, m, sub(sub(one, a), m)])
    .sort((p, q) => cmp(p[0], q[0]) || cmp(p[1], q[1]) || cmp(p[2], q[2]));
  const positive =
    !!ps.length && [0, 1, 2].every((k) => ps.some((p) => cmp(p[k], zero) > 0));
  const safe = (n) => {
    const v = Number(n);
    if (!Number.isSafeInteger(v))
      throw Error("rational component exceeds exact JSON integer");
    return v;
  };
  return {
    vertices: ps.map((p) => p.map((q) => q.map(safe))),
    positive,
    dimension:
      ps.length === 0 ? -1 : ps.length === 1 ? 0 : ps.length === 2 ? 1 : 2,
  };
}
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
export function regions(raw) {
  optimize(raw);
  const closure = optimize({ ...raw, costs: { add: 1, multiply: 1, leaf: 1 } }),
    grouped = new Map();
  for (const row of closure.semantic_terms) {
    const v = counts(expression(row.expression)),
      key = v.join(",");
    if (!grouped.has(key))
      grouped.set(key, { vector: v, terms: [], reachable_terms: [] });
    const g = grouped.get(key);
    g.terms.push(row.expression);
    if (row.reachable) g.reachable_terms.push(row.expression);
  }
  const gs = [...grouped.values()].sort(
      (a, b) =>
        a.vector[0] - b.vector[0] ||
        a.vector[1] - b.vector[1] ||
        a.vector[2] - b.vector[2],
    ),
    vs = gs.map((g) => g.vector),
    rs = gs.filter((g) => g.reachable_terms.length).map((g) => g.vector);
  return {
    schema: "rewritelab-regions-v1",
    request: raw,
    source: closure.source,
    closure,
    groups: gs.map((g, id) => ({
      id,
      ...g,
      semantic: region(g.vector, vs),
      reachable: g.reachable_terms.length
        ? region(g.vector, rs)
        : { vertices: [], positive: false, dimension: -1 },
    })),
  };
}
