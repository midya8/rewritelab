import { optimize, expression, show, size } from "./engine.js";
const $ = (id) => document.getElementById(id),
  controls = await (await fetch("controls.json")).json();
let report = null,
  by = new Map();
window.rewriteReport = null;
window.rewriteSelected = null;
window.rewriteProof = null;
function text(tag, s) {
  const e = document.createElement(tag);
  e.textContent = s;
  return e;
}
for (let i = 0; i < controls.length; i++) {
  const o = text("option", controls[i].label);
  o.value = i;
  $("control").append(o);
}
function stale() {
  report = null;
  window.rewriteReport = null;
  window.rewriteSelected = null;
  window.rewriteProof = null;
  $("output").hidden = true;
  $("download").disabled = true;
  $("error").textContent = "";
  $("proof").replaceChildren();
  $("state").replaceChildren();
  $("semantic").replaceChildren();
}
function svgElement(svg, tag, attrs, s) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (s !== undefined) e.textContent = s;
  svg.append(e);
  return e;
}
function tree(t) {
  const svg = $("tree");
  svg.replaceChildren();
  let index = 0;
  const nodes = [],
    links = [];
  function visit(t, depth) {
    let x;
    const id = nodes.length;
    nodes.push(null);
    if (typeof t === "string") x = 65 + index++ * 150;
    else {
      const a = visit(t[1], depth + 1),
        b = visit(t[2], depth + 1);
      x = (a + b) / 2;
      links.push(
        [x, 45 + depth * 75, a, 45 + (depth + 1) * 75],
        [x, 45 + depth * 75, b, 45 + (depth + 1) * 75],
      );
    }
    nodes[id] = {
      x,
      y: 45 + depth * 75,
      label: typeof t === "string" ? t : t[0],
    };
    return x;
  }
  visit(t, 0);
  const width = (index - 1) * 150 + 130,
    offset = (760 - width) / 2;
  for (const [x, y, a, b] of links)
    svgElement(svg, "line", {
      x1: x + offset,
      y1: y,
      x2: a + offset,
      y2: b,
      stroke: "#abbcc8",
      "stroke-width": 2,
    });
  for (const n of nodes) {
    svgElement(svg, "circle", {
      cx: n.x + offset,
      cy: n.y,
      r: 24,
      fill: n.label === "+" || n.label === "*" ? "#245f84" : "#fff",
      stroke: "#245f84",
      "stroke-width": 2,
    });
    svgElement(
      svg,
      "text",
      {
        x: n.x + offset,
        y: n.y + 6,
        "text-anchor": "middle",
        "font-size": 20,
        "font-family": "ui-monospace,monospace",
        fill: n.label === "+" || n.label === "*" ? "#fff" : "#172e40",
      },
      n.label,
    );
  }
}
function chart() {
  const counts = new Map();
  for (const s of report.states)
    counts.set(s.distance, (counts.get(s.distance) ?? 0) + 1);
  const maxD = Math.max(...counts.keys()),
    maxC = Math.max(...counts.values()),
    svg = $("plot");
  svg.replaceChildren();
  const L = 65,
    R = 25,
    T = 25,
    B = 50,
    W = 760,
    H = 290,
    slot = (W - L - R) / (maxD + 1);
  const tickCount = Math.min(4, maxC);
  for (let i = 0; i <= tickCount; i++) {
    const v = Math.round((maxC * i) / tickCount),
      y = H - B - (v / maxC) * (H - T - B);
    svgElement(svg, "line", {
      x1: L,
      x2: W - R,
      y1: y,
      y2: y,
      stroke: "#d8dfe3",
    });
    svgElement(
      svg,
      "text",
      {
        x: L - 8,
        y: y + 4,
        "text-anchor": "end",
        "font-size": 12,
        fill: "#566570",
      },
      Math.round(v),
    );
  }
  for (const [d, c] of [...counts].sort((a, b) => a[0] - b[0])) {
    const x = L + d * slot + slot * 0.15,
      h = (c / maxC) * (H - T - B);
    svgElement(svg, "rect", {
      x,
      y: H - B - h,
      width: slot * 0.7,
      height: h,
      fill: "#245f84",
      "data-distance": d,
      "data-count": c,
    });
    svgElement(
      svg,
      "text",
      {
        x: x + slot * 0.35,
        y: H - B + 22,
        "text-anchor": "middle",
        "font-size": 13,
        fill: "#566570",
      },
      d,
    );
  }
  svgElement(
    svg,
    "text",
    {
      x: W - R,
      y: H - 7,
      "text-anchor": "end",
      "font-size": 13,
      fill: "#566570",
    },
    "minimum rewrite steps",
  );
  $("shells").replaceChildren();
  for (const [d, c] of [...counts].sort((a, b) => a[0] - b[0]))
    $("shells").append(text("span", `${d} step(s): ${c} term(s)`));
}
function selectTerm(name) {
  if (!report) return;
  window.rewriteSelected = name;
  const row = by.get(name),
    candidate = report.semantic_terms.find((s) => s.expression === name);
  $("tree-title").textContent = row
    ? "A reachable expression tree"
    : "An algebraically equal, blocked tree";
  tree(expression(name));
  $("detail").replaceChildren();
  $("detail").append(text("h3", name));
  $("proof").replaceChildren();
  if (!row) {
    window.rewriteProof = null;
    $("detail").append(
      text(
        "p",
        `Cost ${candidate.cost}. This term belongs to the complete semantic census but has no rewrite path inside this budget.`,
      ),
    );
    $("proof-title").textContent = "No bounded rewrite proof exists";
    $("proof-caption").textContent =
      "The complete reachable closure excludes this expression. This is not a timeout or a missing display row.";
    return;
  }
  $("state").value = name;
  if (candidate) $("semantic").value = name;
  $("detail").append(
    text(
      "p",
      `Cost ${row.cost}; ${size(expression(name))} syntax nodes; shortest distance ${row.distance}.`,
    ),
  );
  const proof = [];
  let current = row;
  while (current) {
    proof.push(current);
    current = current.parent === null ? null : by.get(current.parent);
  }
  proof.reverse();
  window.rewriteProof = proof;
  $("proof-title").textContent =
    `A shortest proof: ${row.distance} rewrite step(s)`;
  $("proof-caption").textContent =
    "Every step changes one recorded subtree. Root means the whole expression; L and R follow left and right children. Larger intermediate steps are kept if they fit the node budget.";
  for (let i = 0; i < proof.length; i++) {
    const s = proof[i],
      e = document.createElement("article");
    e.dataset.expression = s.expression;
    e.append(
      text("p", i === 0 ? "SOURCE" : `STEP ${i}`),
      text("code", s.expression),
      text("p", `Cost ${s.cost} · ${size(expression(s.expression))} nodes`),
    );
    if (i) e.append(text("p", `${s.rule} at ${s.path || "root"}`));
    $("proof").append(e);
  }
}
function run() {
  stale();
  try {
    const raw = {
      expression: $("expression").value,
      max_nodes: Number($("budget").value),
      costs: {
        add: Number($("add").value),
        multiply: Number($("multiply").value),
        leaf: Number($("leaf").value),
      },
    };
    report = optimize(raw);
    window.rewriteReport = report;
    by = new Map(report.states.map((s) => [s.expression, s]));
    $("output").hidden = false;
    $("download").disabled = false;
    $("verdict").textContent = report.objective_gap
      ? `A real shortcut is blocked. Cost gap: ${report.objective_gap}.`
      : "The bounded search reaches the finite semantic optimum.";
    $("explanation").textContent = report.objective_gap
      ? "An algebraically equal, cheaper expression fits the grammar budget, but no sequence of these rewrites reaches it without leaving that budget. Both sets are complete."
      : "The minimum costs agree for this request. This does not mean every equivalent term is reachable, nor that the result is optimal outside this finite grammar.";
    $("metrics").replaceChildren();
    for (const [label, v] of [
      ["Grammar terms", report.universe_size],
      ["Reachable terms", report.reachable_count],
      ["Semantic equivalents", report.semantic_equivalent_count],
      ["Source cost", report.source_cost],
    ]) {
      const e = document.createElement("div");
      e.className = "metric";
      e.append(text("strong", v.toLocaleString("en-US")), text("small", label));
      $("metrics").append(e);
    }
    $("reachable-best").textContent = report.best_reachable.expression;
    $("semantic-best").textContent = report.best_semantic.expression;
    $("reachable-caption").textContent =
      `Cost ${report.best_reachable.cost}; ${report.best_reachable.ties.length} optimal tie(s) in the complete closure.`;
    $("semantic-caption").textContent =
      `Cost ${report.best_semantic.cost}; ${report.best_semantic.ties.length} optimal tie(s) across every equivalent grammar term.`;
    chart();
    for (const s of report.states) {
      const o = text("option", `${s.cost} · ${s.distance} · ${s.expression}`);
      o.value = s.expression;
      $("state").append(o);
    }
    for (const s of report.semantic_terms) {
      const o = text(
        "option",
        `${s.cost} · ${s.reachable ? "reachable" : "blocked"} · ${s.expression}`,
      );
      o.value = s.expression;
      $("semantic").append(o);
    }
    selectTerm(report.best_reachable.expression);
  } catch (e) {
    stale();
    $("error").textContent = e.message;
  }
}
function control() {
  const raw = controls[Number($("control").value)].input;
  $("expression").value = raw.expression;
  $("budget").value = raw.max_nodes;
  for (const k of ["add", "multiply", "leaf"]) $(k).value = raw.costs[k];
  run();
}
$("control").addEventListener("change", control);
for (const k of ["expression", "add", "multiply", "leaf"])
  $(k).addEventListener("input", stale);
$("budget").addEventListener("change", run);
$("run").addEventListener("click", run);
$("state").addEventListener("change", () => selectTerm($("state").value));
$("semantic").addEventListener("change", () => selectTerm($("semantic").value));
$("pick-reachable").addEventListener("click", () =>
  selectTerm(report.best_reachable.expression),
);
$("pick-semantic").addEventListener("click", () =>
  selectTerm(report.best_semantic.expression),
);
$("download").addEventListener("click", () => {
  if (!report) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "rewritelab-evidence.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
control();
