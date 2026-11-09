# Budget-barrier atlas contract

`atlas(request)` and `rewritelab atlas request.json` accept exactly the base
request contract. `max_nodes` is the largest allowed intermediate budget to
consider. All budgets in {3,5,7} up to it are included, even when the source
cannot fit. The cap must fit the source. No budget is skipped for cost reasons.

## Complete evidence

`rewritelab-barriers-v1` has exactly schema, request, source, levels, candidates.
Each level has budget and report: null only when the source exceeds that budget;
otherwise it contains a complete `rewritelab-v1` evidence report for precisely
the same expression and costs at that budget. Candidate rows enumerate every
semantic equivalent in the entire cap grammar, in canonical expression order.
Each has exactly expression, nodes, cost, first_fitting_budget,
first_reachable_budget, extra_budget, steps and status.

First fitting budget is max(3, source nodes, target nodes). First reachable
budget is the first allowed level whose complete closure contains the target,
or null if none does. Extra budget is first reachable minus first fitting, or
null if not reached. Steps is the shortest distance in the first reachable
level, or null. Status is reachable-at-fit, larger-bridge or
not-reached-through-cap. These are exhaustive and mutually exclusive.

## What minimal means

All ordered binary trees here have odd node counts. For an expression needing
at least three nodes, the allowed 3/5/7 filtration contains every possible
peak-node threshold through the cap. A one-node path still has first *allowed*
budget 3. We report the least allowed budget, not necessarily its actual peak.
The displayed proof is shortest within that budget, not shortest across all
larger budgets. It need not be the only proof or lowest-cost-intermediate proof.

A candidate excluded by every fitting lower closure cannot have a legal rewrite
path under any of those budgets. The first successful level provides a witness.
This gives both the upper witness and lower obstruction for the least allowed
budget. A target that does not fit is not called blocked. Source-too-large,
target-too-large, blocked, first-reachable and already-reachable are distinct
level-display states. No reachability claim is made above the chosen cap.

Reachable sets are nested when the source fits both levels, so the reachable
cost optimum cannot increase. The semantic candidate universe also grows; its
optimum cannot increase either. The cost gap is a difference of two changing
optima and need not be monotone. Changing cost weights can change optima and
selection, but not the reachable sets, node barriers or shortest distances.

## Independent verification

`verify_atlas` / `rewritelab verify-atlas evidence.json` imports neither the
atlas generator nor its search, rule matcher, term pool or coefficient maps.
It uses the base independent generic-pattern checker to validate every nested
closure, parent edge, shortest distance and finite semantic census. It then
independently enumerates cap terms and degree-bounded 25-point signatures,
scans independently validated levels, and checks every row/key/type/order/null
and computed status. Alternative valid shortest witness trees are accepted.
It shares the base syntax, size and cost contract, and the base independent
checker, so those are not independently implemented again.

A test-only heap traversal through the independent rule-template graph minimizes
the peak-node label directly, independently of generator BFS and level scanning.
It compares every semantic candidate for six different sources, including zero,
leaf, bridge, weighted-still-blocked, factoring and associativity controls.
All 36 three-node sources are exhaustively atlas-checked; weighted/cap, forged
nested proof/level/candidate/type and generator-disabled checks are included.

## Resources and limits

At most three closures over at most 10,788 grammar terms are retained. The
finite universe and edges are exponentially growing under a generalized cap;
seven is a hard contract, not a scaling claim. Report size includes all complete
nested proof sets and all cap semantic rows. The generator uses explicit BFS
at every fitting level, not a new minimax algorithm or e-graph representation.
The heap is only a test oracle. Arithmetic weights are not compiler latency.
The base rational-algebra, degree-bound and floating-point nonclaims still
apply. No neural, tensor execution, learned-policy, benchmark, globally minimal
compiler-resource, unbounded equivalence or new-algorithm claim.

## Reproduce

```
python -m unittest discover -s tests -v
npm test
bash tools/check_wheel.sh
rewritelab atlas request.json > evidence.json
rewritelab verify-atlas evidence.json
```

The installed-wheel script runs every base and atlas control through both
module and console outside the source checkout, and rejects forged evidence.
The interactive browser report is independently checked only after Python
accepts its downloaded JSON. Established motivation and attribution remain in
SOURCES.md; the finite filtration guarantees above follow directly from the
stated complete-closure contract, not from a cited system's performance claims.
