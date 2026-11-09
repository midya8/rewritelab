"""Independent region reconstruction by line-pair intersection, not clipping.

Shares only request/syntax validation and the existing complete-closure checker.
No generator, clipping, search, count traversal or region helper is imported.
"""
from fractions import Fraction as Q
from itertools import combinations
from .model import parse, show
from .oracle import verify


def _intersections(v, alternatives):
    lines=[(-1,0,0),(0,-1,0),(1,1,-1)]
    for u in alternatives:
        a,b,c=[v[k]-u[k] for k in range(3)]
        lines.append((a-c,b-c,c))
    points=set()
    for (a,b,c),(d,e,f) in combinations(lines,2):
        det=a*e-b*d
        if not det:continue
        x,y=Q(b*f-c*e,det),Q(c*d-a*f,det)
        if all(i*x+j*y+k<=0 for i,j,k in lines):points.add((x,y,1-x-y))
    points=sorted(points)
    # On a lower-dimensional region, retain only extreme points. For full
    # dimension, feasible intersections of support lines are extreme points.
    if len(points)>2:
        p,q=points[0],points[-1]
        if all((r[0]-p[0])*(q[1]-p[1])==(r[1]-p[1])*(q[0]-p[0]) for r in points):
            points=[p,q]
    dim=-1 if not points else 0 if len(points)==1 else 1 if len(points)==2 else 2
    positive=bool(points) and all(any(p[k]>0 for p in points) for k in range(3))
    return dict(vertices=[[[n.numerator,n.denominator] for n in p] for p in points],dimension=dim,positive=positive)


def verify_regions(report):
    try:
        raw=report['request'];source,_,_=parse(raw)
        closure=report['closure']
        if closure['request']!={**raw,'costs':dict(add=1,multiply=1,leaf=1)}:return False
        if not verify(closure):return False
        groups={}
        for row in closure['semantic_terms']:
            text=row['expression']
            v=(text.count('+'),text.count('*'),sum(text.count(x) for x in '01xy'))
            g=groups.setdefault(v,dict(vector=list(v),terms=[],reachable_terms=[]))
            g['terms'].append(text)
            if row['reachable']:g['reachable_terms'].append(text)
        vectors=sorted(groups);reachable=[v for v in vectors if groups[v]['reachable_terms']]
        expected=dict(schema='rewritelab-regions-v1',request=raw,source=show(source),closure=closure,groups=[
            dict(id=i,**groups[v],semantic=_intersections(v,vectors),
                 reachable=_intersections(v,reachable) if v in reachable else dict(vertices=[],positive=False,dimension=-1))
            for i,v in enumerate(vectors)])
        # JSON equality alone admits booleans in integer fields in Python.
        import json
        return json.dumps(report,sort_keys=True,separators=(',',':'))==json.dumps(expected,sort_keys=True,separators=(',',':'))
    except (KeyError,TypeError,ValueError,IndexError,OverflowError):return False
