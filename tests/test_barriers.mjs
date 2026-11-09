import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { atlas } from "../docs/barriers-engine.js";
const controls = JSON.parse(
  fs.readFileSync(new URL("../docs/barriers-controls.json", import.meta.url)),
);
test("full cross-language budget filtrations independently verified", () => {
  const inputs = controls.map((c) => c.input);
  for (const expression of ["x", "0", "(x+0)", "(x+x)", "(x*(1+1))"])
    for (const max_nodes of [3, 5, 7]) {
      if (expression.replace(/[()]/g, "").length > max_nodes) continue;
      for (const multiply of [1, 8])
        inputs.push({
          expression,
          max_nodes,
          costs: { add: 1, multiply, leaf: 1 },
        });
    }
  const actual = inputs.map(atlas),
    expected = JSON.parse(
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import json,sys;from rewritelab import atlas;print(json.dumps([atlas(r) for r in json.load(sys.stdin)]))",
        ],
        { input: JSON.stringify(inputs), maxBuffer: 128 << 20 },
      ),
    );
  assert.deepEqual(actual, expected);
  execFileSync(
    process.env.PYTHON || "python",
    [
      "-c",
      "import json,sys;from rewritelab import verify_atlas;assert all(verify_atlas(r) for r in json.load(sys.stdin))",
    ],
    { input: JSON.stringify(actual), maxBuffer: 128 << 20 },
  );
  console.log(
    JSON.stringify({
      atlasReports: actual.length,
      candidateRows: actual.reduce((s, r) => s + r.candidates.length, 0),
      nestedProofRows: actual.reduce(
        (s, r) =>
          s + r.levels.reduce((n, l) => n + (l.report?.states.length ?? 0), 0),
        0,
      ),
    }),
  );
});
test("atlas validation shares exact base contract", () => {
  for (const input of [
    null,
    {},
    [],
    {
      expression: "x",
      max_nodes: true,
      costs: { add: 1, multiply: 1, leaf: 1 },
    },
    {
      expression: "(x*(1+1))",
      max_nodes: 3,
      costs: { add: 1, multiply: 1, leaf: 1 },
    },
  ])
    assert.throws(() => atlas(input));
});
