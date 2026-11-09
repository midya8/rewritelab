import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { optimize, pool, show } from "../docs/engine.js";
const controls = JSON.parse(
  readFileSync(new URL("../docs/controls.json", import.meta.url)),
);
test("72 complete cross-language proof/closure/semantic reports", () => {
  const inputs = controls.map((c) => c.input);
  let seed = 7077;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let i = 0; i < 64; i++) {
    const t = pool(7)[rand(10788)];
    inputs.push({
      expression: show(t),
      max_nodes: 7,
      costs: { add: 1 + rand(8), multiply: 1 + rand(8), leaf: 1 + rand(8) },
    });
  }
  const reports = inputs.map(optimize),
    native = JSON.parse(
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import sys,json;from rewritelab import optimize;print(json.dumps([optimize(r) for r in json.load(sys.stdin)]))",
        ],
        { input: JSON.stringify(inputs), maxBuffer: 64 << 20 },
      ),
    );
  assert.deepEqual(reports, native);
  execFileSync(
    process.env.PYTHON || "python",
    [
      "-c",
      "import sys,json;from rewritelab import verify;assert all(verify(r) for r in json.load(sys.stdin))",
    ],
    { input: JSON.stringify(reports), maxBuffer: 64 << 20 },
  );
  console.log(
    JSON.stringify({
      completeReports: reports.length,
      reachableProofRows: reports.reduce((n, r) => n + r.states.length, 0),
      semanticRows: reports.reduce((n, r) => n + r.semantic_terms.length, 0),
    }),
  );
});
test("strict input and the intermediate-growth witness", () => {
  const a = optimize(controls[0].input),
    b = optimize(controls[1].input);
  assert.equal(a.objective_gap, 2);
  assert.equal(b.objective_gap, 0);
  assert.equal(b.states.find((s) => s.expression === "(x+x)").distance, 3);
  for (const raw of [
    {},
    { ...controls[0].input, max_nodes: 4 },
    { ...controls[0].input, expression: "x+y" },
    { ...controls[0].input, costs: { add: true, multiply: 1, leaf: 1 } },
  ])
    assert.throws(() => optimize(raw));
});
