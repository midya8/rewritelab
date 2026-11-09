import copy, json, random, unittest
from pathlib import Path
from unittest.mock import patch
from rewritelab.model import parse, expression, show, size, cost
from rewritelab.rewrites import pool, neighbours
from rewritelab.search import optimize, polynomial
from rewritelab.oracle import verify, universe, edges, signature

C = json.loads(Path("docs/controls.json").read_text())


class CoreTests(unittest.TestCase):
    def test_full_grammar_and_all_edges(self):
        for bound, count in [(3, 36), (5, 548), (7, 10788)]:
            self.assertEqual(len(pool(bound)), count)
            self.assertEqual(pool(bound), universe(bound))
            for t in pool(bound):
                forward = {
                    (show(u), rule, path) for u, rule, path in neighbours(t, bound)
                }
                independent = {}
                for u, rule, path in sorted(
                    edges(t, bound), key=lambda r: (show(r[0]), r[1], r[2])
                ):
                    independent.setdefault(show(u), (show(u), rule, path))
                self.assertEqual(forward, set(independent.values()), (show(t), bound))
                for u, _, _ in neighbours(t, bound):
                    self.assertEqual(polynomial(t), polynomial(u))

    def test_every_five_node_source(self):
        for t in pool(5):
            r = optimize(
                dict(
                    expression=show(t),
                    max_nodes=5,
                    costs=dict(add=1, multiply=2, leaf=1),
                )
            )
            self.assertTrue(verify(r), show(t))

    def test_all_controls(self):
        for c in C:
            self.assertTrue(verify(optimize(c["input"])), c["label"])

    def test_size_detour_and_shortest_path(self):
        a, b = (optimize(C[i]["input"]) for i in [0, 1])
        self.assertEqual(a["objective_gap"], 2)
        self.assertEqual(a["reachable_count"], 2)
        self.assertEqual(a["best_semantic"]["expression"], "(x+x)")
        self.assertEqual(b["objective_gap"], 0)
        rows = {r["expression"]: r for r in b["states"]}
        path = []
        r = rows[b["best_reachable"]["expression"]]
        self.assertEqual(r["distance"], 3)
        while r["parent"] is not None:
            path.append(size(expression(r["expression"])))
            r = rows[r["parent"]]
        path.append(size(expression(r["expression"])))
        self.assertEqual(max(path), 7)

    def test_gap_at_maximum_budget(self):
        r = optimize(C[6]["input"])
        self.assertEqual(r["reachable_count"], 1)
        self.assertEqual(r["source_cost"], 14)
        self.assertEqual(r["best_semantic"]["cost"], 7)
        self.assertEqual(r["objective_gap"], 7)

    def test_zero_and_cycle_closure(self):
        r = optimize(C[2]["input"])
        self.assertEqual(r["best_reachable"]["expression"], "0")
        self.assertEqual(r["best_reachable"]["cost"], 1)
        self.assertEqual(r["reachable_count"], r["semantic_equivalent_count"])
        self.assertGreater(r["reachable_count"], 2000)
        r = optimize(C[7]["input"])
        self.assertEqual(r["best_reachable"]["expression"], "x")
        self.assertEqual(r["best_reachable"]["cost"], 1)
        self.assertTrue(verify(r))

    def test_costs_and_ties(self):
        for costs in [
            dict(add=a, multiply=m, leaf=l)
            for a in [1, 3]
            for m in [1, 8]
            for l in [1, 2]
        ]:
            for c in C:
                r = optimize({**c["input"], "costs": costs})
                self.assertTrue(verify(r))
                self.assertEqual(
                    r["best_reachable"]["ties"], sorted(r["best_reachable"]["ties"])
                )
                self.assertGreaterEqual(r["objective_gap"], 0)

    def test_forged_fields_and_types(self):
        r = optimize(C[1]["input"])
        for key in r:
            if key == "request":
                continue
            b = copy.deepcopy(r)
            b[key] = "forged"
            self.assertFalse(verify(b), key)
        for key, val in [
            ("distance", True),
            ("distance", 999),
            ("cost", 0),
            ("parent", "0"),
            ("rule", "forged"),
            ("path", "LLR"),
        ]:
            b = copy.deepcopy(r)
            i = next(i for i, s in enumerate(b["states"]) if s["parent"] is not None)
            b["states"][i][key] = val
            self.assertFalse(verify(b), key)
        b = copy.deepcopy(r)
        b["states"] = b["states"][1:]
        self.assertFalse(verify(b))
        b = copy.deepcopy(r)
        b["states"].append(copy.deepcopy(b["states"][0]))
        self.assertFalse(verify(b))
        b = copy.deepcopy(r)
        b["semantic_terms"][0]["reachable"] = 1
        self.assertFalse(verify(b))
        b = copy.deepcopy(r)
        b["extra"] = 1
        self.assertFalse(verify(b))
        b = copy.deepcopy(r)
        b["states"][0]["extra"] = 1
        self.assertFalse(verify(b))

    def test_generator_disabled(self):
        r = optimize(C[1]["input"])
        with patch("rewritelab.search.optimize", side_effect=RuntimeError), patch(
            "rewritelab.search.polynomial", side_effect=RuntimeError
        ), patch("rewritelab.rewrites.neighbours", side_effect=RuntimeError), patch(
            "rewritelab.rewrites.pool", side_effect=RuntimeError
        ):
            self.assertTrue(verify(r))

    def test_seeded_sources(self):
        rng = random.Random(7077)
        for _ in range(80):
            t = rng.choice(pool(7))
            raw = dict(
                expression=show(t),
                max_nodes=7,
                costs={k: rng.randint(1, 8) for k in ["add", "multiply", "leaf"]},
            )
            r = optimize(raw)
            self.assertTrue(verify(r), raw)

    def test_strict_contract(self):
        raw = C[0]["input"]
        for e in [
            "",
            "x+y",
            "(x)",
            "(x-y)",
            "(x/1)",
            "2",
            "10",
            "(x+y)junk",
            "(x+у)",
            "(x+x)+(x+x)",
            "(((x+x)+x)+x)",
        ]:
            with self.assertRaises(ValueError):
                optimize({**raw, "expression": e})
        self.assertEqual(show(expression(" ( x * ( 1 + 1 ) ) ")), "(x*(1+1))")
        self.assertTrue(
            verify(
                optimize(
                    {
                        **raw,
                        "max_nodes": 5.0,
                        "costs": dict(add=1.0, multiply=2.0, leaf=1.0),
                    }
                )
            )
        )
        for bound in [True, 1, 4, 9, 5.5, 10**400]:
            with self.assertRaises(ValueError):
                optimize({**raw, "max_nodes": bound})
        for c in [
            dict(add=True, multiply=1, leaf=1),
            dict(add=0, multiply=1, leaf=1),
            dict(add=1, multiply=9, leaf=1),
            dict(add=1, multiply=1, leaf=1, extra=1),
        ]:
            with self.assertRaises(ValueError):
                optimize({**raw, "costs": c})
        for bad in [{}, {**raw, "extra": 1}, {**raw, "expression": "((x+y)*(x+y))"}]:
            with self.assertRaises(ValueError):
                optimize(bad)
