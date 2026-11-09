import { atlas } from "./barriers-engine.js";
import { expression, size } from "./engine.js";
const $ = (id) => document.getElementById(id),
  controls = await (await fetch("barriers-controls.json")).json();
let report = null;
window.barrierReport = null;
window.barrierSelected = null;
window.barrierProof = null;
function text(tag, value) {
  const e = document.createElement(tag);
  e.textContent = value;
  return e;
}
controls.forEach((c, i) => {
  const o = text("option", c.label);
  o.value = i;
  $("control").append(o);
});
function stale() {
  report = null;
  window.barrierReport = null;
  window.barrierSelected = null;
  window.barrierProof = null;
  $("output").hidden = true;
  $("download").disabled = true;
  $("error").textContent = "";
  for (const id of [
    "candidate",
    "detail",
    "levels",
    "proof",
    "frontier",
    "metrics",
  ])
    $(id).replaceChildren();
}
function select(name) {
  if (!report) return;
  const candidate = report.candidates.find((c) => c.expression === name);
  window.barrierSelected = name;
  $("candidate").value = name;
  $("detail").replaceChildren(
    text("h3", name),
    text(
      "p",
      `Cost ${candidate.cost}; ${candidate.nodes} syntax nodes. First fitting budget ${candidate.first_fitting_budget}. ${candidate.first_reachable_budget === null ? "No rewrite path reached through this cap." : `First reachable budget ${candidate.first_reachable_budget}; extra budget ${candidate.extra_budget}; shortest distance at that level ${candidate.steps}.`}`,
    ),
  );
  $("levels").replaceChildren();
  for (const l of report.levels) {
    const status = !l.report
      ? "source-too-large"
      : candidate.nodes > l.budget
        ? "target-too-large"
        : !l.report.states.some((s) => s.expression === name)
          ? "blocked"
          : l.budget === candidate.first_reachable_budget
            ? "first-reachable"
            : "already-reachable";
    const a = text("article", "");
    a.dataset.budget = l.budget;
    a.dataset.status = status;
    a.append(
      text("h3", `${l.budget} nodes`),
      text("p", status),
      text(
        "p",
        status === "source-too-large"
          ? "The source does not fit. No closure is claimed."
          : status === "target-too-large"
            ? "The candidate does not fit. This is not a rewrite barrier."
            : status === "blocked"
              ? `Excluded by all ${l.report.reachable_count} reachable terms in this complete closure.`
              : `Shortest distance ${l.report.states.find((s) => s.expression === name).distance} at this budget.`,
      ),
    );
    $("levels").append(a);
  }
  $("proof").replaceChildren();
  if (candidate.first_reachable_budget === null) {
    window.barrierProof = null;
    $("proof-title").textContent = "No proof reached through the chosen cap";
    $("proof-caption").textContent =
      "Every fitting level excludes this target. Larger budgets remain unexamined.";
    return;
  }
  const level = report.levels.find(
      (l) => l.budget === candidate.first_reachable_budget,
    ),
    by = new Map(level.report.states.map((s) => [s.expression, s]));
  let s = by.get(name);
  const proof = [];
  while (s) {
    proof.push(s);
    s = s.parent === null ? null : by.get(s.parent);
  }
  proof.reverse();
  window.barrierProof = proof;
  $("proof-title").textContent =
    `A shortest proof at the first allowed budget: ${candidate.steps} step(s)`;
  $("proof-caption").textContent =
    `All intermediates fit ${candidate.first_reachable_budget} nodes. Peak nodes in this displayed path: ${Math.max(...proof.map((s) => size(expression(s.expression))))}. This does not claim the shortest distance across larger budgets.`;
  proof.forEach((s, i) => {
    const a = text("article", "");
    a.dataset.expression = s.expression;
    a.append(
      text("p", i === 0 ? "SOURCE" : `STEP ${i}`),
      text("code", s.expression),
      text("p", `${size(expression(s.expression))} nodes · cost ${s.cost}`),
    );
    if (i) a.append(text("p", `${s.rule} at ${s.path || "root"}`));
    $("proof").append(a);
  });
}
function run() {
  stale();
  try {
    report = atlas({
      expression: $("expression").value,
      max_nodes: Number($("budget").value),
      costs: {
        add: Number($("add").value),
        multiply: Number($("multiply").value),
        leaf: Number($("leaf").value),
      },
    });
    window.barrierReport = report;
    $("output").hidden = false;
    $("download").disabled = false;
    const counts = Object.fromEntries(
      ["reachable-at-fit", "larger-bridge", "not-reached-through-cap"].map(
        (status) => [
          status,
          report.candidates.filter((t) => t.status === status).length,
        ],
      ),
    );
    $("verdict").textContent =
      `${counts["larger-bridge"]} candidate(s) need a larger bridge.`;
    for (const [label, value] of [
      ["Equivalent candidates", report.candidates.length],
      ["Reachable at fit", counts["reachable-at-fit"]],
      ["Larger bridge", counts["larger-bridge"]],
      ["Not reached through cap", counts["not-reached-through-cap"]],
    ]) {
      const d = text("div", "");
      d.className = "metric";
      d.append(text("strong", value), text("small", label));
      $("metrics").append(d);
    }
    for (const l of report.levels) {
      const a = text("article", "");
      a.dataset.budget = l.budget;
      a.append(text("h3", `${l.budget} nodes`));
      if (!l.report) a.append(text("p", "Source does not fit."));
      else {
        const r = l.report;
        a.append(
          text("code", r.best_reachable.expression),
          text(
            "p",
            `Reachable optimum ${r.best_reachable.cost} · semantic optimum ${r.best_semantic.cost} · gap ${r.objective_gap}`,
          ),
          text(
            "p",
            `${r.reachable_count} reachable / ${r.semantic_equivalent_count} semantic / ${r.universe_size} grammar terms`,
          ),
        );
      }
      $("frontier").append(a);
    }
    for (const c of report.candidates) {
      const o = text(
        "option",
        `${c.cost} · ${c.first_reachable_budget === null ? "not reached" : `budget ${c.first_reachable_budget}`} · ${c.expression}`,
      );
      o.value = c.expression;
      $("candidate").append(o);
    }
    const top = report.levels.at(-1).report;
    select(top.best_semantic.expression);
  } catch (e) {
    stale();
    $("error").textContent = e.message;
  }
}
function control() {
  const c = controls[Number($("control").value)].input;
  $("expression").value = c.expression;
  $("budget").value = c.max_nodes;
  for (const k of ["add", "multiply", "leaf"]) $(k).value = c.costs[k];
  run();
}
$("control").addEventListener("change", control);
$("budget").addEventListener("change", run);
for (const k of ["expression", "add", "multiply", "leaf"])
  $(k).addEventListener("input", stale);
$("run").addEventListener("click", run);
$("candidate").addEventListener("change", () => select($("candidate").value));
$("download").addEventListener("click", () => {
  if (!report) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "rewritelab-barriers-evidence.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
control();
