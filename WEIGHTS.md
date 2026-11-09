# Exact cost-weight atlas contract

`weights(request)` / `rewritelab weights request.json` accepts the exact base
request contract. Its expression/node budget determine one fixed graph. Its
weights select an initial UI outcome, but the report includes every triple in
{1,...,8} cubed regardless of that initial choice. All original values validate
before weights are normalized to units for the nested closure certificate.

`rewritelab-weights-v1` has exactly schema, request, source, closure, groups and
outcomes. Closure is a complete unit-cost `rewritelab-v1` report for the same
expression and bound. Every candidate is grouped by its exact count vector
(additions,multiplications,leaves), vectors sorted lexicographically. Group ids
are zero-based sorted indices. Each group retains every semantic expression,
its complete reachable subset (both canonically sorted), dominated_by group
ids, semantic_wins and reachable_wins. All memberships remain explicit; this
is a report compression by equal scores, not omitted equivalent expressions.

Each of512outcomes is ordered by addition, multiplication, leaf, increasing1..8.
It contains exactly costs, semantic_cost, reachable_cost, gap, semantic_groups,
reachable_groups. All group ties are complete sorted ids. A reachable optimum
considers only reachable memberships; its expressions are that subset, never
the entire semantic group. A semantic optimum includes all members of its tied
groups. Costs are vector dot products with exact small integers. Rewrites and
shortest distances are independent of weights; supplied costs do not prune BFS.

A vector is dominated when another distinct vector is no larger coordinatewise
and strictly smaller somewhere. Strictly positive weights then make the other
vector strictly cheaper at every positive weight. Dominated vectors cannot
win semantically, but their reachable members could win if the dominator is
blocked. We do not equate nondominance with winning, absence of box wins with
global impossibility, or a box win count with a probability or volume in a
continuous parameter domain. Ties credit each group separately, so total wins
may exceed512. These are objective weights, not measured runtime latency.

## Concrete controls

Constant-four product has vector(2,1,4), addition-only terms(3,0,4). Within
seven nodes, only the product is reachable. At add=multiply the two semantic
groups tie. At multiply>add, an addition-only candidate is cheaper but blocked.
Of512triples,224have a positive gap,288do not, and64tie. Each semantic group
wins288times since ties count for both. This follows from all512explicit rows,
not interpolation or a sample. The bridge x*(1+1) at five nodes has a gap at
every triple: its source vector(1,1,3) is strictly dominated by x+x(1,0,2).
At seven nodes the closure reaches x+x, removing every gap. No richer tradeoff
is invented for a control whose vector is simply dominated.

## Independent verification

`verify_weights` / `rewritelab verify-weights evidence.json` imports no cost
atlas generator/count traversal or forward search. It independently validates
the complete nested closure with the base generic rule-template checker and
exact degree-bounded25point semantic census. It counts operators and leaves
from canonical spellings rather than the generator's recursive tree traversal,
rebuilds every group/subset, scores every triple and recomputes all ties,
gaps/dominators/wins/schema/types/order/nulls. Shared base parsing, cost/size
contract and independent closure checker are explicit dependencies, not an
independent third implementation of the grammar. Browser output is checked
only after Python accepts the download.

Tests compare every512outcomes including full expanded expression ties with
fresh ordinary optimize reports for both the dominated five-node bridge and
the seven-node constant crossover. Every36three-node source, all8controls,
forged closure/group/vector/membership/cost/tie/win/dominance/type and disabled
atlas/search generator checks are included. Installed module/console reproduce
all three families outside checkout with forged evidence rejected.

## UI behavior

Leaf cost selects an8by8slice; rows multiplication1..8, columns addition1..8.
Each cell is an accessible button with all weights and exact gap in its label.
Keyboard focus and the selected outline retain meaning without color. Both
complete optimum expression tie sets and every group membership/subset are
selectable. Changing weights selects a precomputed outcome, without another
search. Invalid selected weights hide results and disable export; a valid
selection restores them. Editing expression clears all old evidence; budget
changes rebuild the complete fixed-graph report. Export records current selected
weights in request while retaining the unit closure and all512outcomes.

## Limits

The same seven-node finite grammar, rules, rational-arithmetic identity proof
and positive1..8weight contract apply. There is no unbounded reachability,
IEEE-floating-point equivalence, tensor engine, learned policy, new algorithm,
continuous normal fan, hardware latency, speed or scaling claim. The512box is
exhaustive only for these integral weights; generalized grammar growth remains
exponential. Established primary source context and nonclaims remain unchanged
in SOURCES.md. See CONTRACT.md and BARRIERS.md for the retained other families.
