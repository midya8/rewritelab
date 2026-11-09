import copy,json,unittest
from pathlib import Path
from unittest.mock import patch
from rewritelab import atlas,verify_atlas
from rewritelab.oracle import universe
from rewritelab.model import show

C=dict(add=1,multiply=1,leaf=1)
def request(s,b=7,c=None):return dict(expression=s,max_nodes=b,costs=c or C)
class Barriers(unittest.TestCase):
    def test_bridge(self):
        r=atlas(request('(x*(1+1))'));self.assertTrue(verify_atlas(r))
        t=next(t for t in r['candidates'] if t['expression']=='(x+x)')
        self.assertEqual((t['first_fitting_budget'],t['first_reachable_budget'],t['extra_budget'],t['steps'],t['status']),(5,7,2,3,'larger-bridge'))
        self.assertIsNone(r['levels'][0]['report'])
    def test_blocked_and_leaf_budget(self):
        r=atlas(request('((1+1)*(1+1))',c=dict(add=1,multiply=8,leaf=1)));self.assertTrue(verify_atlas(r));self.assertEqual(sum(t['first_reachable_budget'] is None for t in r['candidates']),5)
        r=atlas(request('x',3));self.assertTrue(verify_atlas(r));t=next(t for t in r['candidates'] if t['expression']=='x');self.assertEqual((t['first_reachable_budget'],t['steps']),(3,0))
    def test_controls(self):
        cs=json.loads((Path(__file__).parents[1]/'docs/barriers-controls.json').read_text())
        for c in cs:
            r=atlas(c['input']);self.assertTrue(verify_atlas(r),c['label'])
            previous=set()
            for l in r['levels']:
                if l['report']:
                    now={s['expression'] for s in l['report']['states']};self.assertLessEqual(previous,now);previous=now
    def test_all_three_node_sources(self):
        for t in universe(3):self.assertTrue(verify_atlas(atlas(request(show(t),3))))
    def test_caps_and_costs(self):
        for b in [3,5,7]:
            for a in [1,8]:
                for m in [1,8]:
                    for l in [1,8]:self.assertTrue(verify_atlas(atlas(request('(x+0)',b,dict(add=a,multiply=m,leaf=l)))))
    def test_forgeries(self):
        base=atlas(request('(x*(1+1))'))
        paths=[['schema'],['source'],['candidates',0,'nodes'],['candidates',0,'cost'],['candidates',0,'first_fitting_budget'],['candidates',0,'first_reachable_budget'],['candidates',0,'extra_budget'],['candidates',0,'steps'],['candidates',0,'status'],['levels',1,'budget'],['levels',1,'report','states',0,'distance'],['levels',1,'report','objective_gap']]
        for path in paths:
            for value in [True,False,None,0,1,99,'wrong',[],{}]:
                r=copy.deepcopy(base);d=r
                for k in path[:-1]:d=d[k]
                if d[path[-1]]==value and type(d[path[-1]]) is type(value):continue
                d[path[-1]]=value;self.assertFalse(verify_atlas(r),(path,value))
        for key in base:
            r=copy.deepcopy(base);r.pop(key);self.assertFalse(verify_atlas(r))
        for action in ['drop','duplicate','reverse','extra']:
            r=copy.deepcopy(base)
            if action=='drop':r['candidates'].pop()
            if action=='duplicate':r['candidates'].append(r['candidates'][0])
            if action=='reverse':r['candidates'].reverse()
            if action=='extra':r['extra']=0
            self.assertFalse(verify_atlas(r),action)
        r=copy.deepcopy(base);r['levels'][0]['report']=r['levels'][1]['report'];self.assertFalse(verify_atlas(r))
    def test_verifier_without_generator(self):
        r=atlas(request('(x*(1+1))'))
        with patch('rewritelab.barriers.atlas',side_effect=AssertionError),patch('rewritelab.search.optimize',side_effect=AssertionError),patch('rewritelab.search.polynomial',side_effect=AssertionError),patch('rewritelab.rewrites.neighbours',side_effect=AssertionError):self.assertTrue(verify_atlas(r))
    def test_invalid(self):
        for r in [None,[],{},True,{'levels':[]}]:self.assertFalse(verify_atlas(r))
        for b in [1,True,4,9]:
            with self.assertRaises(ValueError):atlas(request('x',b))
    def test_independent_minimax_peak(self):
        # Heap labels minimize peak size, not BFS steps or the atlas scan.
        import heapq
        from rewritelab.oracle import edges
        from rewritelab.model import size,expression
        for name in ['x','0','(x*(1+1))','((1+1)*(1+1))','((x*x)+(x*y))','((x+y)+1)']:
            t=expression(name);r=atlas(request(name));labels={t:max(3,size(t))};heap=[(labels[t],show(t),t)]
            while heap:
                label,_,u=heapq.heappop(heap)
                if labels[u]!=label:continue
                for v,_,_ in edges(u,7):
                    d=max(label,size(v))
                    if d<labels.get(v,99):labels[v]=d;heapq.heappush(heap,(d,show(v),v))
            for c in r['candidates']:self.assertEqual(c['first_reachable_budget'],labels.get(expression(c['expression'])),(name,c))
