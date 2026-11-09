"""Independent full weight-box checking, using direct syntax token counts."""
import json
from .model import parse,show
from .oracle import verify


def verify_weights(report):
    try:
        source,bound,_=parse(report['request'])
        closure=report['closure']
        if closure['request']!={**report['request'],'costs':dict(add=1,multiply=1,leaf=1)} or not verify(closure):
            return False
        # Canonical spelling contains one operator per internal node and one
        # 0/1/x/y symbol per leaf. No generator count-vector traversal imported.
        groups={}
        for row in closure['semantic_terms']:
            name=row['expression']
            v=(name.count('+'),name.count('*'),sum(name.count(c) for c in '01xy'))
            if v not in groups:groups[v]={'vector':list(v),'terms':[],'reachable_terms':[]}
            groups[v]['terms'].append(name)
            if row['reachable']:groups[v]['reachable_terms'].append(name)
        vs=sorted(groups)
        rs=[dict(id=i,**groups[v]) for i,v in enumerate(vs)]
        outcomes=[];sw=[0]*len(rs);rw=[0]*len(rs)
        for a in range(1,9):
            for m in range(1,9):
                for l in range(1,9):
                    values={i:a*v[0]+m*v[1]+l*v[2] for i,v in enumerate(vs)}
                    s=min(values.values());r=min(values[i] for i,row in enumerate(rs) if row['reachable_terms'])
                    st=sorted(i for i,value in values.items() if value==s)
                    rt=sorted(i for i,value in values.items() if value==r and rs[i]['reachable_terms'])
                    for i in st:sw[i]+=1
                    for i in rt:rw[i]+=1
                    outcomes.append(dict(costs=dict(add=a,multiply=m,leaf=l),semantic_cost=s,reachable_cost=r,gap=r-s,semantic_groups=st,reachable_groups=rt))
        for i,row in enumerate(rs):
            v=vs[i]
            row['dominated_by']=[j for j,u in enumerate(vs) if j!=i and not any(u[k]>v[k] for k in range(3))]
            row['semantic_wins']=sw[i];row['reachable_wins']=rw[i]
        expected=dict(schema='rewritelab-weights-v1',request=report['request'],source=show(source),closure=closure,groups=rs,outcomes=outcomes)
        return json.dumps(expected,sort_keys=True,separators=(',',':'))==json.dumps(report,sort_keys=True,separators=(',',':'))
    except (KeyError,ValueError,TypeError,IndexError,RecursionError):return False
