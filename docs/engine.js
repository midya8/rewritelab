const leaves = ["0", "1", "x", "y"],
  show = (t) =>
    typeof t === "string" ? t : `(${show(t[1])}${t[0]}${show(t[2])})`,
  size = (t) => (typeof t === "string" ? 1 : 1 + size(t[1]) + size(t[2])),
  equal = (a, b) => show(a) === show(b),
  lex = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export { show, size };
export function expression(s) {
  if (typeof s !== "string" || s.length > 200 || /[^01xy+*() \t\r\n]/.test(s))
    throw Error("Use 0, 1, x, y and fully parenthesized + or *");
  const tokens = s.replace(/[ \t\r\n]/g, "");
  let pos = 0;
  function read(depth = 0) {
    if (depth > 6 || pos >= tokens.length)
      throw Error("Invalid or too-deep expression");
    const c = tokens[pos++];
    if (leaves.includes(c)) return c;
    if (c !== "(") throw Error("Fully parenthesized expression required");
    const a = read(depth + 1);
    if (!["+", "*"].includes(tokens[pos]))
      throw Error("Binary + or * required");
    const op = tokens[pos++],
      b = read(depth + 1);
    if (tokens[pos++] !== ")") throw Error("Closing parenthesis required");
    return [op, a, b];
  }
  const t = read();
  if (pos !== tokens.length || size(t) > 7)
    throw Error("One expression of at most seven nodes required");
  return t;
}
function parse(raw) {
  if (
    !raw ||
    Array.isArray(raw) ||
    typeof raw !== "object" ||
    Object.keys(raw).sort().join(",") !== "costs,expression,max_nodes"
  )
    throw Error("Exact expression, max_nodes and costs keys required");
  const b = raw.max_nodes,
    c = raw.costs;
  if (!Number.isInteger(b) || ![3, 5, 7].includes(b))
    throw Error("max_nodes must be 3, 5 or 7");
  if (
    !c ||
    Array.isArray(c) ||
    typeof c !== "object" ||
    Object.keys(c).sort().join(",") !== "add,leaf,multiply" ||
    Object.values(c).some((v) => !Number.isInteger(v) || v < 1 || v > 8)
  )
    throw Error("Add, multiply and leaf costs must be integers 1..8");
  const t = expression(raw.expression);
  if (size(t) > b) throw Error("Source exceeds intermediate node budget");
  return [t, b, c];
}
const poolCache = new Map(),
  edgeCache = new Map(),
  polyCache = new Map();
export function pool(bound) {
  if (poolCache.has(bound)) return poolCache.get(bound);
  const exact = new Map([[1, leaves]]);
  for (let n = 3; n <= bound; n += 2) {
    const out = [];
    for (let a = 1; a < n - 1; a += 2)
      for (const l of exact.get(a))
        for (const r of exact.get(n - 1 - a))
          for (const op of ["+", "*"]) out.push([op, l, r]);
    exact.set(n, out);
  }
  const terms =
    bound < 1
      ? []
      : [...exact.values()].flat().sort((a, b) => lex(show(a), show(b)));
  poolCache.set(bound, terms);
  return terms;
}
function roots(t, bound) {
  const out = [],
    emit = (rule, u) => {
      if (!equal(u, t) && size(u) <= bound) out.push([u, rule, ""]);
    };
  emit("add-zero-right-insert", ["+", t, "0"]);
  emit("add-zero-left-insert", ["+", "0", t]);
  emit("mul-one-right-insert", ["*", t, "1"]);
  emit("mul-one-left-insert", ["*", "1", t]);
  if (t === "0")
    for (const a of pool(bound - 2)) {
      emit("mul-zero-right-insert", ["*", a, "0"]);
      emit("mul-zero-left-insert", ["*", "0", a]);
    }
  if (typeof t !== "string") {
    const [op, a, b] = t,
      prefix = op === "+" ? "add" : "mul";
    emit(prefix + "-commute", [op, b, a]);
    if (typeof a !== "string" && a[0] === op)
      emit(prefix + "-associate-right", [op, a[1], [op, a[2], b]]);
    if (typeof b !== "string" && b[0] === op)
      emit(prefix + "-associate-left", [op, [op, a, b[1]], b[2]]);
    if (op === "+") {
      if (b === "0") emit("add-zero-right-drop", a);
      if (a === "0") emit("add-zero-left-drop", b);
      if (
        typeof a !== "string" &&
        typeof b !== "string" &&
        a[0] === "*" &&
        b[0] === "*"
      ) {
        if (equal(a[1], b[1]))
          emit("factor-left", ["*", a[1], ["+", a[2], b[2]]]);
        if (equal(a[2], b[2]))
          emit("factor-right", ["*", ["+", a[1], b[1]], a[2]]);
      }
    } else {
      if (b === "1") emit("mul-one-right-drop", a);
      if (a === "1") emit("mul-one-left-drop", b);
      if (b === "0") emit("mul-zero-right-drop", "0");
      if (a === "0") emit("mul-zero-left-drop", "0");
      if (typeof b !== "string" && b[0] === "+")
        emit("distribute-left", ["+", ["*", a, b[1]], ["*", a, b[2]]]);
      if (typeof a !== "string" && a[0] === "+")
        emit("distribute-right", ["+", ["*", a[1], b], ["*", a[2], b]]);
    }
  }
  return out;
}
function neighbours(t, bound) {
  const key = bound + ":" + show(t);
  if (edgeCache.has(key)) return edgeCache.get(key);
  const out = roots(t, bound);
  if (typeof t !== "string") {
    const [op, a, b] = t;
    for (const [u, rule, path] of neighbours(a, bound - 1 - size(b)))
      out.push([[op, u, b], rule, "L" + path]);
    for (const [u, rule, path] of neighbours(b, bound - 1 - size(a)))
      out.push([[op, a, u], rule, "R" + path]);
  }
  out.sort(
    (a, b) => lex(show(a[0]), show(b[0])) || lex(a[1], b[1]) || lex(a[2], b[2]),
  );
  const unique = new Map();
  for (const row of out)
    if (!unique.has(show(row[0]))) unique.set(show(row[0]), row);
  const result = [...unique.values()];
  edgeCache.set(key, result);
  return result;
}
function cost(t, c) {
  return typeof t === "string"
    ? c.leaf
    : (t[0] === "+" ? c.add : c.multiply) + cost(t[1], c) + cost(t[2], c);
}
function poly(t) {
  const key = show(t);
  if (polyCache.has(key)) return polyCache.get(key);
  let out = {};
  if (typeof t === "string")
    out = { 0: {}, 1: { "0,0": 1 }, x: { "1,0": 1 }, y: { "0,1": 1 } }[t];
  else {
    const a = poly(t[1]),
      b = poly(t[2]);
    if (t[0] === "+") {
      for (const [k, v] of [...Object.entries(a), ...Object.entries(b)])
        out[k] = (out[k] ?? 0) + v;
    } else
      for (const [k, v] of Object.entries(a))
        for (const [l, w] of Object.entries(b)) {
          const [i, j] = k.split(",").map(Number),
            [m, n] = l.split(",").map(Number),
            p = `${i + m},${j + n}`;
          out[p] = (out[p] ?? 0) + v * w;
        }
  }
  polyCache.set(key, out);
  return out;
}
const semanticKey = (t) =>
  JSON.stringify(Object.entries(poly(t)).sort((a, b) => lex(a[0], b[0])));
export function optimize(raw) {
  const [source, bound, c] = parse(raw),
    initial = show(source),
    seen = new Map([
      [
        initial,
        {
          expression: initial,
          cost: cost(source, c),
          distance: 0,
          parent: null,
          rule: null,
          path: null,
        },
      ],
    ]),
    queue = [source];
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i];
    for (const [u, rule, path] of neighbours(t, bound)) {
      const name = show(u);
      if (seen.has(name)) continue;
      seen.set(name, {
        expression: name,
        cost: cost(u, c),
        distance: seen.get(show(t)).distance + 1,
        parent: show(t),
        rule,
        path,
      });
      queue.push(u);
    }
  }
  const terms = pool(bound),
    key = semanticKey(source),
    semantic = terms
      .filter((t) => semanticKey(t) === key)
      .map((t) => ({
        expression: show(t),
        cost: cost(t, c),
        reachable: seen.has(show(t)),
      })),
    states = [...seen.values()].sort((a, b) => lex(a.expression, b.expression));
  function best(rows) {
    const m = Math.min(...rows.map((r) => r.cost)),
      ties = rows.filter((r) => r.cost === m).map((r) => r.expression);
    return { cost: m, expression: ties[0], ties };
  }
  const br = best(states),
    bs = best(semantic);
  return {
    schema: "rewritelab-v1",
    request: raw,
    source: initial,
    universe_size: terms.length,
    reachable_count: states.length,
    semantic_equivalent_count: semantic.length,
    source_cost: cost(source, c),
    best_reachable: br,
    best_semantic: bs,
    objective_gap: br.cost - bs.cost,
    states,
    semantic_terms: semantic,
  };
}
