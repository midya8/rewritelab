# Exact finite rewrite contract

## Request and semantics

Exactly `expression`, `max_nodes`, `costs`. Expressions are fully parenthesized
ordered binary trees using leaves `0`, `1`, `x`, `y` and operations `+`, `*`.
ASCII whitespace is ignored. Maximum input length 200 characters; maximum tree
size seven nodes. One leaf is one node; each binary operator is another node.
The budget is 3, 5 or 7, and the source must fit. Costs have exactly `add`,
`multiply`, `leaf`, each an integral JSON number from 1 to 8. Booleans and
nonintegral numbers are rejected. Integral forms such as 1.0 have the same
meaning as 1. Variables range over all rationals, without floating-point or
machine-integer overflow semantics. Cost counts repeated tree occurrences:
this is not DAG common-subexpression costing.

The complete grammar sizes follow T(1)=4 and
T(n)=2*sum(T(i)*T(n-1-i)) over positive odd i. Exact-size counts are 4, 32, 512
and 10,240; cumulative counts are 36, 548 and 10,788 for allowed budgets.

## Exactly one subtree rewrite per step

Both directions of these equalities are allowed, at every subtree:

- A+B = B+A and A*B = B*A.
- (A+B)+C = A+(B+C), and likewise for *.
- A+0 = A, 0+A = A, A*1 = A, 1*A = A.
- A*0 = 0, 0*A = 0.
- A*(B+C) = A*B+A*C and (A+B)*C = A*C+B*C.

For reverse zero annihilation, the previously absent A may be any tree that
fits the remaining node budget. This is not restricted to variables already
present in the source. Intermediate size is checked on the whole expression.
Identical self-rewrites are omitted. Multiple edges to the same target use the
lexicographically first (rule,path) witness. L/R paths address left/right
children; the empty path addresses the root. No rewrite is rejected merely
because it increases cost or size while still fitting the node budget.

## Report

`rewritelab-v1` includes original request, canonical source, universe_size,
reachable_count, semantic_equivalent_count, source_cost, best_reachable,
best_semantic, objective_gap, states and semantic_terms. Every state contains
canonical expression, integral cost, integral shortest distance, and parent,
rule and path strings. The source alone has distance 0 and null proof fields.
States are sorted by canonical ASCII expression. BFS neighbors are processed
in canonical expression/rule/path order. Each best record contains cost, the
lexically first expression at that cost, and the complete sorted ties list.
Semantic rows contain expression, cost and a boolean reachable flag and are
likewise complete and sorted. objective_gap is reachable minimum minus semantic
minimum. A zero gap does not mean all semantic equivalents are reachable.

The complete bounded graph has no timeout/iteration truncation. Grammar, rules
and budget define its scope. This is not arbitrary-expression global optimality.

## Independent checker

The generator is a direct root/subtree rewriter and BFS. It computes semantic
identity by multiplying/adding coefficient maps in Q[x,y] (coefficients happen
to be nonnegative integers under this grammar). The independent checker imports
none of search.py, rewrites.py or their polynomial, BFS or pool routines. It
shares the strict parser, canonical serializer, size and node-cost functions.
It independently builds the complete grammar bottom-up and uses generic rule
pattern matching and substitution, not the direct forward cases.

For every supplied state, the checker checks its cost and canonical syntax.
For every non-source state it checks a legal parent edge at the exact rule/path
and distance one above its parent. Descending nonnegative distances force every
parent chain to reach the source, proving there are no spurious states. Every
legal outgoing rewrite must stay in the supplied state set. Induction on path
length then proves it contains the entire bounded reachable closure. For each
edge u->v it checks d(v)<=d(u)+1. Combined with a parent path of length d(v),
these inequalities prove all supplied distances are the true shortest distances.
Any valid shortest parent proof is accepted; the generator's deterministic BFS
choice is not itself a semantic requirement.

For semantic comparison, the checker evaluates each full-grammar term exactly
at all (x,y) in {0,1,2,3,4}². A seven-node tree has at most four leaves and
hence degree at most four in each variable. If two such terms agree on that
5x5 Cartesian grid, fix each of the five y values: their difference, a univariate
polynomial of degree at most four in x, has five roots and must vanish. Then
fix arbitrary rational x and use the same five-root argument in y. They are
therefore identical over Q². This is a degree-bounded identity proof, not a
random/grid-sampling confidence assertion. The checker uses no coefficient map.
It recomputes every semantic row, optimum/tie set and gap, then compares the
complete report including JSON keys and types. Output evidence fields use
canonical integral values; boolean/one substitutions are rejected.

## Arithmetic and resources

Python uses exact integers. JavaScript Number arithmetic is exact here: every
coefficient sum and finite-grid evaluation is bounded by 4^4=256; node costs
are at most 7*8=56, counts at most 10,788. No rounding decides semantic identity,
reachability or optimum. SVG positions alone are rounded.

The grammar grows exponentially with a generalized budget. Search time is
O(V+E) after neighbor construction and caching, for reachable term count V and
legal-edge count E; semantic enumeration adds work on every grammar term.
Generic closure checking can inspect duplicate rule witnesses. Reverse-zero
rewrites enumerate fitting grammar terms. Proof parents avoid storing every
full path, but the complete downloadable closure may still be large. No
large-language, tensor-engine or runtime-performance claim. The cap seven is
not silently raised or lowered. Browser output is unverified until Python
accepts its downloaded report.
