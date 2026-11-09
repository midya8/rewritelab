import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { regions } from "../docs/regions-engine.js";
test("complete continuous rational regions Python/JS and independent geometry checker", () => {
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
  const reports = cs.map(regions),
    native = JSON.parse(
      execFileSync(
        process.env.PYTHON || "python",
        [
          "-c",
          "import json,sys;from rewritelab import regions;print(json.dumps([regions(r) for r in json.load(sys.stdin)]))",
        ],
        { input: JSON.stringify(cs), maxBuffer: 128 << 20 },
      ),
    );
  assert.deepEqual(reports, native);
  execFileSync(
    process.env.PYTHON || "python",
    [
      "-c",
      "import json,sys;from rewritelab import verify_regions;assert all(verify_regions(r) for r in json.load(sys.stdin))",
    ],
    { input: JSON.stringify(reports), maxBuffer: 128 << 20 },
  );
  console.log(
    JSON.stringify({
      regionReports: reports.length,
      groups: reports.reduce((s, r) => s + r.groups.length, 0),
      vertices: reports.reduce(
        (s, r) =>
          s +
          r.groups.reduce(
            (t, g) =>
              t + g.semantic.vertices.length + g.reachable.vertices.length,
            0,
          ),
        0,
      ),
    }),
  );
});
test("original weights validate before normalized closure", () => {
  assert.throws(() =>
    regions({
      expression: "x",
      max_nodes: 3,
      costs: { add: true, multiply: 1, leaf: 1 },
    }),
  );
});
