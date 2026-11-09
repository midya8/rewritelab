import { regions } from "./regions-engine.js";
const $ = (id) => document.getElementById(id),
  controls = await (await fetch("weights-controls.json")).json();
let report = null,
  point = null;
window.regionReport = null;
window.regionSelected = null;
const text = (tag, s) => {
  const e = document.createElement(tag);
  e.textContent = s;
  return e;
};
const frac = (p) => (p[1] === 1 ? String(p[0]) : p.join("/"));
const coordinate = (p) => [30 + 360 * (p[1] + p[2] / 2), 340 - 300 * p[2]];
const svgElement = (name, attrs) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
function diagram(r, kind, id) {
  const svg = svgElement("svg", {
    viewBox: "0 0 420 380",
    role: "img",
    "aria-label": `${kind} region group ${id}: dimension ${r.dimension}; ${r.positive ? "has" : "has no"} positive point`,
  });
  svg.append(
    svgElement("polygon", {
      points: "30,340 390,340 210,40",
      fill: "#f4f7f8",
      stroke: "#526c7d",
      "stroke-width": 1,
    }),
  );
  const ps = r.vertices.map((v) => v.map((q) => q[0] / q[1]));
  if (ps.length) {
    const center = [0, 1, 2].map(
      (k) => ps.reduce((s, p) => s + p[k], 0) / ps.length,
    );
    ps.sort(
      (a, b) =>
        Math.atan2(a[1] - center[1], a[0] - center[0]) -
        Math.atan2(b[1] - center[1], b[0] - center[0]),
    );
    const coords = ps.map(coordinate);
    if (ps.length === 1)
      svg.append(
        svgElement("circle", {
          cx: coords[0][0],
          cy: coords[0][1],
          r: 5,
          fill: "#286b78",
        }),
      );
    else
      svg.append(
        svgElement(ps.length === 2 ? "polyline" : "polygon", {
          points: coords.map((p) => p.join(",")).join(" "),
          fill: ps.length === 2 ? "none" : "#91c5c9",
          stroke: "#286b78",
          "stroke-width": 3,
        }),
      );
  }
  for (const [x, y, label] of [
    [30, 365, "addition"],
    [337, 365, "multiplication"],
    [195, 24, "leaf"],
  ]) {
    const t = svgElement("text", { x, y, "font-size": 12, fill: "#172e40" });
    t.textContent = label;
    svg.append(t);
  }
  const marker = svgElement("circle", {
    r: 5,
    fill: "#fff",
    stroke: "#9d542b",
    "stroke-width": 3,
    "data-point": "",
  });
  svg.append(marker);
  return svg;
}
function stale() {
  report = null;
  point = null;
  window.regionReport = null;
  window.regionSelected = null;
  $("output").hidden = true;
  $("download").disabled = true;
  $("error").textContent = "";
  $("point-error").textContent = "";
  for (const id of ["groups", "metrics", "detail", "semantic", "reachable"])
    $(id).replaceChildren();
}
function select() {
  if (!report) return;
  const w = ["add", "multiply", "leaf"].map((k) => Number($(k).value));
  if (w.some((n) => !Number.isInteger(n) || n < 1 || n > 1000000)) {
    point = null;
    window.regionSelected = null;
    $("point-error").textContent =
      "Selected weights must be integers 1..1,000,000. Geometry is retained; point details and export are unavailable.";
    $("detail").replaceChildren();
    $("semantic").replaceChildren();
    $("reachable").replaceChildren();
    $("semantic-count").textContent = "";
    $("reachable-count").textContent = "";
    $("download").disabled = true;
    for (const e of document.querySelectorAll("[data-point]"))
      e.setAttribute("visibility", "hidden");
    return;
  }
  $("point-error").textContent = "";
  $("download").disabled = false;
  const score = (g) => g.vector.reduce((s, v, k) => s + v * w[k], 0),
    s = Math.min(...report.groups.map(score)),
    r = Math.min(
      ...report.groups.filter((g) => g.reachable_terms.length).map(score),
    );
  point = {
    weights: w,
    semantic_cost: s,
    reachable_cost: r,
    gap: r - s,
    semantic_groups: [],
    reachable_groups: [],
  };
  for (const kind of ["semantic", "reachable"]) {
    const gs = report.groups.filter(
      (g) =>
        (kind === "semantic" || g.reachable_terms.length) &&
        score(g) === (kind === "semantic" ? s : r),
    );
    point[kind + "_groups"] = gs.map((g) => g.id);
    const names = gs
      .flatMap((g) => g[kind === "semantic" ? "terms" : "reachable_terms"])
      .sort();
    $(kind).replaceChildren(
      ...names.map((n) => {
        const o = text("option", n);
        o.value = n;
        return o;
      }),
    );
    $(kind + "-count").textContent =
      `${names.length} exact expression tie(s) in ${gs.length} group(s).`;
  }
  $("detail").replaceChildren(
    text("h3", `+ ${w[0]} · * ${w[1]} · leaf ${w[2]}`),
    text(
      "p",
      `Semantic optimum ${s}; reachable optimum ${r}; exact gap ${r - s}.`,
    ),
  );
  window.regionSelected = point;
  const p = w.map((n) => n / w.reduce((a, b) => a + b)),
    [x, y] = coordinate(p);
  for (const e of document.querySelectorAll("[data-point]")) {
    e.setAttribute("cx", x);
    e.setAttribute("cy", y);
    e.setAttribute("visibility", "visible");
  }
}
function run() {
  stale();
  try {
    report = regions({
      expression: $("expression").value,
      max_nodes: Number($("budget").value),
      costs: { add: 1, multiply: 1, leaf: 1 },
    });
    window.regionReport = report;
    $("output").hidden = false;
    const feasible = report.groups.filter((g) => g.semantic.positive).length;
    $("verdict").textContent =
      `${feasible} groups win somewhere at strictly positive prices.`;
    for (const [label, value] of [
      ["Count-vector groups", report.groups.length],
      ["Positive semantic regions", feasible],
      [
        "Boundary-only semantic regions",
        report.groups.filter(
          (g) => g.semantic.vertices.length && !g.semantic.positive,
        ).length,
      ],
    ]) {
      const e = text("div", "");
      e.className = "metric";
      e.append(text("strong", value), text("small", label));
      $("metrics").append(e);
    }
    for (const g of report.groups) {
      const article = text("article", "");
      article.dataset.group = g.id;
      article.append(
        text("h3", `Group ${g.id}: (${g.vector.join(", ")})`),
        text(
          "p",
          `${g.terms.length} semantic member(s); ${g.reachable_terms.length} reachable.`,
        ),
      );
      const pair = text("div", "");
      pair.className = "region-pair";
      for (const kind of ["semantic", "reachable"]) {
        const r = g[kind],
          e = text("div", "");
        e.append(
          text(
            "h3",
            kind === "semantic"
              ? "Semantic optimum region"
              : "Reachable optimum region",
          ),
          text(
            "p",
            `Dimension ${r.dimension}. ${r.positive ? "Has strictly positive prices." : r.vertices.length ? "Boundary only: no strictly positive prices." : "Empty region."}`,
          ),
          diagram(r, kind, g.id),
        );
        const p = text(
          "p",
          r.vertices.length
            ? r.vertices
                .map((v) => "(" + v.map(frac).join(", ") + ")")
                .join("; ")
            : "No vertices.",
        );
        p.className = "vertices";
        e.append(p);
        pair.append(e);
      }
      article.append(pair);
      for (const kind of ["terms", "reachable_terms"]) {
        const label = text(
            "label",
            kind === "terms"
              ? "Every semantic member"
              : "Every reachable member",
          ),
          s = text("select", "");
        s.dataset.members = kind;
        s.setAttribute("aria-label", `${kind} group ${g.id}`);
        s.disabled = !g[kind].length;
        for (const n of g[kind].length ? g[kind] : ["No reachable members"]) {
          const o = text("option", n);
          o.value = n;
          s.append(o);
        }
        article.append(label, s);
      }
      $("groups").append(article);
    }
    select();
  } catch (e) {
    stale();
    $("error").textContent = e.message;
  }
}
controls.forEach((c, i) => {
  const o = text("option", c.label);
  o.value = i;
  $("control").append(o);
});
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
  $(k).addEventListener("input", select);
$("download").addEventListener("click", () => {
  if (!report || !point) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "rewritelab-regions-evidence.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
control();
