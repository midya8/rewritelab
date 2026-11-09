# Exact continuous cost regions

Status: feature implementation; final release awaits main, deployment and
showcase verification. The separate cost-weight atlas retains its finite
1..8 integer-box contract.

`regions` consumes the exact ordinary request and validates its selected costs
before normalization. It builds one complete unit-cost closure at the fixed
node budget, groups all equivalent terms by (addition,multiplication,leaf)
counts and retains all reachable members.

For every group v, its semantic region is the closed polytope

    a >= 0, m >= 0, l >= 0, a+m+l=1
    (v-u) dot (a,m,l) <= 0 for every semantic group u.

Its reachable region uses only groups with reachable members. A group with no
reachable members has an empty reachable region regardless of semantic value.
Every vertex is an exact reduced rational triple, serialized as three
[numerator,positive denominator] pairs. Vertices sort lexicographically by their
rational coordinates. No rounded floats define geometry, feasibility or ties.
Empty regions have dimension -1, points 0, segments 1 and area regions 2.

`positive` means this closed region intersects a>0,m>0,l>0. A closed polygon can
be nonempty yet have no strictly positive point. Boundary-only optima therefore
must not be advertised as winners under the original positive-cost model.
Conversely an interior point or tie segment can be positive even with zero area.
Taking the mean of all vertices gives a strictly positive witness exactly when
some vertex is positive in each coordinate, because every coordinate is
nonnegative and the region is convex. This does not require an area tolerance.

Normalization removes only overall positive scale: every strictly positive real
weight triple has a unique normalized point, and scaling costs by a common
positive number preserves optimum membership. The exact rational inequalities
also describe irrational normalized points; rational vertices are not samples.
The simplex boundary compactifies the positive domain for display. It does not
change the original optimizer's accepted request costs or assert that zero-cost
rewrite search is implemented.

A vector with zero wins in the released finite grid may win elsewhere. A vector
with an empty positive semantic region cannot win at any strictly positive
weights in this fixed grammar and budget. Neither fact changes reachability.
All ties remain memberships in every participating region, including shared
edges and vertices. Area is not a probability unless an explicit distribution
is supplied; no random weight model is assumed.

The generator uses exact rational polygon clipping. The independent checker
uses line-pair intersections, filters all inequalities and retains extreme
points. It does not import the generator, clipping, recursive counts or forward
search. It first verifies the complete nested closure through the existing
independent checker and counts canonical syntax tokens separately. Shared syntax
and independent base closure checking are explicit. JavaScript uses BigInt
rational clipping; safe-integer conversion is checked only at JSON serialization.

This remains a finite small rational arithmetic grammar, maximum seven nodes,
not an e-graph, compiler performance model, learned costs, shared-DAG extraction,
tensor optimizer or new algorithm. Exact rational identities do not authorize
IEEE floating-point transformations. Enumeration grows exponentially.
