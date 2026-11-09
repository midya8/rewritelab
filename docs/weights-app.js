import { weights } from "./weights-engine.js";
const $ = (id) => document.getElementById(id),
  controls = await (await fetch("weights-controls.json")).json();
let report = null,
  selected = null;
window.weightReport = null;
window.weightSelected = null;
function text(tag, s) {
  const e = document.createElement(tag);
  e.textContent = s;
  return e;
}
controls.forEach((c, i) => {
  const o = text("option", c.label);
  o.value = i;
  $("control").append(o);
});
function stale() {
  report = null;
  selected = null;
  window.weightReport = null;
  window.weightSelected = null;
  $("output").hidden = true;
  $("download").disabled = true;
  $("error").textContent = "";
  for (const id of [
    "grid",
    "groups",
    "reachable",
    "semantic",
    "detail",
    "metrics",
  ])
    $(id).replaceChildren();
}
function select(a, m, l) {
  if (!report) return;
  for (const v of [a, m, l])
    if (!Number.isInteger(v) || v < 1 || v > 8) {
      selected = null;
      window.weightSelected = null;
      $("output").hidden = true;
      $("download").disabled = true;
      $("error").textContent = "Selected weights must be integral 1..8";
      return;
    }
  $("output").hidden = false;
  $("download").disabled = false;
  $("error").textContent = "";
  $("add").value = a;
  $("multiply").value = m;
  $("leaf").value = l;
  selected = report.outcomes.find(
    (o) => o.costs.add === a && o.costs.multiply === m && o.costs.leaf === l,
  );
  window.weightSelected = selected;
  $("detail").replaceChildren(
    text("h3", `+ ${a} · * ${m} · leaf ${l}`),
    text(
      "p",
      `Reachable optimum ${selected.reachable_cost}; semantic optimum ${selected.semantic_cost}; exact gap ${selected.gap}.`,
    ),
  );
  for (const kind of ["reachable", "semantic"]) {
    const names = selected[kind + "_groups"]
      .flatMap(
        (i) =>
          report.groups[i][kind === "reachable" ? "reachable_terms" : "terms"],
      )
      .sort();
    $(kind).replaceChildren();
    for (const name of names) {
      const o = text("option", name);
      o.value = name;
      $(kind).append(o);
    }
    $(kind + "-count").textContent =
      `${names.length} exact expression tie(s) in ${selected[kind + "_groups"].length} count-vector group(s).`;
  }
  $("grid").replaceChildren();
  for (let mm = 1; mm <= 8; mm++)
    for (let aa = 1; aa <= 8; aa++) {
      const o = report.outcomes.find(
          (o) =>
            o.costs.add === aa && o.costs.multiply === mm && o.costs.leaf === l,
        ),
        b = text("button", o.gap);
      b.type = "button";
      b.dataset.add = aa;
      b.dataset.multiply = mm;
      b.dataset.gap = o.gap;
      b.setAttribute(
        "aria-label",
        `Addition ${aa}, multiplication ${mm}, leaf ${l}: gap ${o.gap}`,
      );
      b.setAttribute("aria-pressed", String(aa === a && mm === m));
      b.addEventListener("click", () => select(aa, mm, l));
      $("grid").append(b);
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
    report = weights(raw);
    window.weightReport = report;
    const gaps = report.outcomes.filter((o) => o.gap > 0).length;
    $("verdict").textContent =
      `${gaps} of 512 weight triples have a real bounded gap.`;
    for (const [label, value] of [
      ["Weight triples", 512],
      ["Count-vector groups", report.groups.length],
      ["Positive gaps", gaps],
      ["Largest gap", Math.max(...report.outcomes.map((o) => o.gap))],
    ]) {
      const d = text("div", "");
      d.className = "metric";
      d.append(text("strong", value), text("small", label));
      $("metrics").append(d);
    }
    for (const g of report.groups) {
      const d = text("article", "");
      d.dataset.group = g.id;
      d.append(
        text("h3", `Group ${g.id}: (${g.vector.join(", ")})`),
        text(
          "p",
          `${g.terms.length} semantic expression(s); ${g.reachable_terms.length} reachable. Semantic wins ${g.semantic_wins}/512; reachable wins ${g.reachable_wins}/512.`,
        ),
        text(
          "p",
          g.dominated_by.length
            ? `Strictly dominated at every positive weight by group(s) ${g.dominated_by.join(", ")}.`
            : g.semantic_wins
              ? "Nondominated and optimal somewhere in this finite box."
              : "Nondominated, but not optimal anywhere in this finite box. No claim outside the box.",
        ),
      );
      for (const kind of ["terms", "reachable_terms"]) {
        const label = text(
            "label",
            kind === "terms"
              ? "Every semantic member"
              : "Every reachable member",
          ),
          s = document.createElement("select");
        s.dataset.members = kind;
        s.setAttribute("aria-label", `${kind} group ${g.id}`);
        if (!g[kind].length) {
          s.disabled = true;
          s.append(text("option", "No reachable members"));
        } else
          for (const name of g[kind]) {
            const o = text("option", name);
            o.value = name;
            s.append(o);
          }
        d.append(label, s);
      }
      $("groups").append(d);
    }
    select(raw.costs.add, raw.costs.multiply, raw.costs.leaf);
  } catch (e) {
    stale();
    $("error").textContent = e.message;
  }
}
function control() {
  const r = controls[Number($("control").value)].input;
  $("expression").value = r.expression;
  $("budget").value = r.max_nodes;
  for (const k of ["add", "multiply", "leaf"]) $(k).value = r.costs[k];
  run();
}
$("control").addEventListener("change", control);
$("expression").addEventListener("input", stale);
$("budget").addEventListener("change", run);
$("run").addEventListener("click", run);
for (const k of ["add", "multiply", "leaf"])
  $(k).addEventListener("input", () =>
    select(
      Number($("add").value),
      Number($("multiply").value),
      Number($("leaf").value),
    ),
  );
$("download").addEventListener("click", () => {
  if (!report || !selected) return;
  const r = {
      ...report,
      request: { ...report.request, costs: selected.costs },
    },
    url = URL.createObjectURL(
      new Blob([JSON.stringify(r, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "rewritelab-weights-evidence.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
control();
