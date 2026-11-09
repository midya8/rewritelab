"""All 512 positive integral node-weight triples, with complete count-vector ties."""
from .model import parse, show
from .search import optimize


def counts(t):
    if isinstance(t, str):
        return (0, 0, 1)
    a, b = counts(t[1]), counts(t[2])
    return (a[0]+b[0]+(t[0]=='+'), a[1]+b[1]+(t[0]=='*'), a[2]+b[2])


def weights(raw):
    source, bound, _ = parse(raw)
    # The request weights are a selected UI slice only; every box point is kept.
    closure = optimize({**raw, 'costs':dict(add=1,multiply=1,leaf=1)})
    from .model import expression
    groups = {}
    for row in closure['semantic_terms']:
        v = counts(expression(row['expression']))
        if v not in groups:
            groups[v] = dict(vector=list(v), terms=[], reachable_terms=[])
        groups[v]['terms'].append(row['expression'])
        if row['reachable']:
            groups[v]['reachable_terms'].append(row['expression'])
    vectors = sorted(groups)
    rows = [dict(id=i, **groups[v]) for i,v in enumerate(vectors)]
    outcomes = []
    wins = [dict(semantic=0,reachable=0) for _ in rows]
    for a in range(1,9):
        for m in range(1,9):
            for l in range(1,9):
                values = [sum(x*y for x,y in zip(v,(a,m,l))) for v in vectors]
                semantic = min(values)
                reachable = min(values[i] for i,r in enumerate(rows) if r['reachable_terms'])
                st = [i for i,v in enumerate(values) if v==semantic]
                rt = [i for i,v in enumerate(values) if v==reachable and rows[i]['reachable_terms']]
                for i in st:wins[i]['semantic']+=1
                for i in rt:wins[i]['reachable']+=1
                outcomes.append(dict(costs=dict(add=a,multiply=m,leaf=l),semantic_cost=semantic,
                    reachable_cost=reachable,gap=reachable-semantic,semantic_groups=st,reachable_groups=rt))
    for i,row in enumerate(rows):
        v=row['vector']
        row['dominated_by']=[j for j,u in enumerate(vectors) if j!=i and all(x<=y for x,y in zip(u,v))]
        row['semantic_wins']=wins[i]['semantic']
        row['reachable_wins']=wins[i]['reachable']
    return dict(schema='rewritelab-weights-v1',request=raw,source=show(source),closure=closure,
                groups=rows,outcomes=outcomes)
