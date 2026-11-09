# RewriteLab

A shortcut can need a larger detour. An algebraically cheaper expression may fit
inside a size budget, yet remain unreachable without a bigger intermediate step.

[Live inspector](https://midya8.github.io/rewritelab/) · [Exact contract](CONTRACT.md) · [Search](rewritelab/search.py) · [Independent checker](rewritelab/oracle.py)

## A concrete failure, not an optimizer-success flag

With a five-node intermediate budget, `x*(1+1)` reaches only itself and
`(1+1)*x`. Both cost 5 with unit node costs. The semantic census finds `x+x`
at cost 3 inside the same finite grammar, but distribution needs the seven-node
bridge `(x*1)+(x*1)`. At budget 7, the shortcut is reached in exactly three
rewrites. The meaning, source and costs did not change; the bridge budget did.

Even the maximum budget need not close the gap. With multiplication cost 8,
`(1+1)*(1+1)` costs 14 and has just one reachable term under budget 7, while an
addition-only equivalent costs 7. The report does not confuse a complete bounded
closure with algebraic completeness.

## Implementation and evidence

- Explicit finite term-rewrite graph with complete breadth-first closure, every
  shortest distance and a replayable parent/rule/subtree-path proof per term.
  Rewrites include identities, zero annihilation, commutativity, associativity
  and distribution/factoring in both directions. No greedy size/cost pruning.
- Full ordered-tree grammar over `0,1,x,y,+,*`: 36 / 548 / 10,788 terms for
  budgets 3 / 5 / 7. Cost is a positive integral weight per tree-node occurrence.
- Generator semantics use exact polynomial coefficient maps. The independent
  checker enumerates grammar terms separately, matches rewrite templates with
  generic bindings, checks complete outgoing closure and shortest-distance
  inequalities, and compares exact 25-point signatures. Degree at most four in
  each variable makes that grid a universal rational polynomial-identity test,
  not an empirical sampling claim. Shared parsing/costing are explicit.
- 11 Python tests include every legal edge in all three full grammars, all 548
  five-node sources, 80 seeded seven-node requests, weighted ties, forged
  closure/proofs/types, and verification with the generator disabled.
- 72 complete Python/JavaScript reports compare 111,316 reachable proof rows and
  111,342 semantic rows. Actual Chrome checks 26 complete reports, every one of
  3,612 reachable proof selections and 3,630 semantic selections for the eight
  controls, 320/390/1280 layouts, blocked/detour/weighted/three-node states,
  export, invalid inputs and stale clearing.
- Installed module and console reproduce all eight controls outside the checkout
  and reject forged reports. Python 3.10-3.13 and Node/Chrome CI.

## Reproduce

Python 3.10+, Node 22+ and Chrome for browser tests. No runtime dependencies.

```sh
python -m unittest discover -s tests -v
npm test
bash tools/check_wheel.sh
printf '%s\n' '{"expression":"(x*(1+1))","max_nodes":7,"costs":{"add":1,"multiply":1,"leaf":1}}' > request.json
python -m rewritelab optimize request.json > evidence.json
python -m rewritelab verify evidence.json
python -m http.server --directory docs 8000
# Open http://localhost:8000
```

Installed commands: `rewritelab optimize` and `rewritelab verify`.
A browser download becomes independently checked only after Python accepts it.

## Limits and attribution

This is a deliberately small explicit rewrite graph, not an e-graph or an
implementation of egg, TENSAT, TASO, Herbie or Alive2. Those systems provide
prior compiler, AI graph-optimization and validation context. No new algorithm,
neural model, tensor execution, learned policy, runtime-speedup or production
compiler-equivalence claim. Exact rational identities are not IEEE floating-point
rewrite licenses. Semantic optimality is only within this finite grammar, and
node costs are supplied arithmetic weights, not measured latency. Full report
size and search resources are exponential in a generalized node budget; the
hard seven-node cap is part of the contract, not a scaling result.
See [SOURCES.md](SOURCES.md).
