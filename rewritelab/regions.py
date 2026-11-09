"""Exact closed optimal regions on the normalized nonnegative cost simplex.

Strictly positive costs are a separately reported intersection, not a claim
that boundary-only winners are obtainable with positive node costs.
"""
from fractions import Fraction as F
from .model import parse, expression, show
from .search import optimize
from .weights import counts


def _clip(poly, line):
    """Sutherland-Hodgman with exact rational arithmetic, including degeneracy."""
    if not poly:
        return []
    a,b,c=line
    value=lambda p:a*p[0]+b*p[1]+c
    out=[]
    for p,q in zip(poly,poly[1:]+poly[:1]):
        vp,vq=value(p),value(q)
        if vp<=0:out.append(p)
        if (vp<0 and vq>0) or (vp>0 and vq<0):
            t=vp/(vp-vq)
            out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    unique=[]
    for p in out:
        if p not in unique:unique.append(p)
    # Remove points in the interior of straight edges, but retain both ends
    # of a degenerate segment. A singleton remains a valid closed region.
    changed=True
    while len(unique)>2 and changed:
        changed=False
        for i,p in enumerate(unique):
            u,v=unique[i-1],unique[(i+1)%len(unique)]
            cross=(p[0]-u[0])*(v[1]-p[1])-(p[1]-u[1])*(v[0]-p[0])
            if cross==0 and p!=u and p!=v:
                del unique[i];changed=True;break
    return unique


def _region(v,others):
    poly=[(F(0),F(0)),(F(1),F(0)),(F(0),F(1))]
    for u in others:
        d=[v[k]-u[k] for k in range(3)]
        poly=_clip(poly,(d[0]-d[2],d[1]-d[2],d[2]))
    vertices=sorted((x,y,1-x-y) for x,y in poly)
    positive=bool(vertices) and all(sum(p[k] for p in vertices)>0 for k in range(3))
    dimension=-1
    if vertices:
        dimension=0 if len(vertices)==1 else 1
        if len(vertices)>2:dimension=2
    return dict(vertices=[[[x.numerator,x.denominator] for x in p] for p in vertices],
                positive=positive,dimension=dimension)


def regions(raw):
    source,_,_=parse(raw)
    closure=optimize({**raw,'costs':dict(add=1,multiply=1,leaf=1)})
    grouped={}
    for r in closure['semantic_terms']:
        v=counts(expression(r['expression']))
        row=grouped.setdefault(v,dict(vector=list(v),terms=[],reachable_terms=[]))
        row['terms'].append(r['expression'])
        if r['reachable']:row['reachable_terms'].append(r['expression'])
    vectors=sorted(grouped)
    reachable=[v for v in vectors if grouped[v]['reachable_terms']]
    rows=[]
    for i,v in enumerate(vectors):
        rows.append(dict(id=i,**grouped[v],semantic=_region(v,vectors),
            reachable=_region(v,reachable) if v in reachable else dict(vertices=[],positive=False,dimension=-1)))
    return dict(schema='rewritelab-regions-v1',request=raw,source=show(source),closure=closure,groups=rows)
