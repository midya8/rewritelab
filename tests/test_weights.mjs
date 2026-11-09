import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { weights } from "../docs/weights-engine.js";
test("complete weight-box Python/JS comparison and independent verification", () => {
  const cs = JSON.parse(
    fs.readFileSync(new URL("../docs/weights-controls.json", import.meta.url)),
  ).map((c) => c.input);
  for (const expression of ["x", "0", "(x+0)"])
    for (const max_nodes of [3, 5, 7])
      cs.push({
        expression,
        max_nodes,
        costs: { add: 8, multiply: 2, leaf: 3 },
      });
  const rs = cs.map(weights),
    native = JSON.parse(
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import json,sys;from rewritelab import weights;print(json.dumps([weights(r) for r in json.load(sys.stdin)]))",
        ],
        { input: JSON.stringify(cs), maxBuffer: 128 << 20 },
      ),
    );
  assert.deepEqual(rs, native);
  execFileSync(
    process.env.PYTHON || "python",
    [
      "-c",
      "import json,sys;from rewritelab import verify_weights;assert all(verify_weights(r) for r in json.load(sys.stdin))",
    ],
    { input: JSON.stringify(rs), maxBuffer: 128 << 20 },
  );
  console.log(
    JSON.stringify({
      weightReports: rs.length,
      outcomes: rs.length * 512,
      groups: rs.reduce((s, r) => s + r.groups.length, 0),
    }),
  );
});
test("selected request weights validate before unit-cost normalization", () => {
  for (const costs of [
    { add: 0, multiply: 1, leaf: 1 },
    { add: true, multiply: 1, leaf: 1 },
    { add: 1.5, multiply: 1, leaf: 1 },
    null,
  ])
    assert.throws(() => weights({ expression: "x", max_nodes: 7, costs }));
});
