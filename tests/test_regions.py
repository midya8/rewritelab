import copy
import importlib
import json
import random
import unittest
from fractions import Fraction as F
from unittest.mock import patch
from rewritelab.regions import regions, _region
from rewritelab.region_oracle import verify_regions, _intersections


def contains(region, w):
    from itertools import combinations
    total=sum(w);q=(F(w[0],total),F(w[1],total))
    ps=[tuple(F(*n) for n in p[:2]) for p in region['vertices']]
    if q in ps:return True
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    if len(ps)==2:
        a,b=ps
        return cross(a,b,q)==0 and all(min(a[k],b[k])<=q[k]<=max(a[k],b[k]) for k in (0,1))
    for a,b,c in combinations(ps,3):
        if cross(a,b,c)==0:continue
        signs=[cross(a,b,q),cross(b,c,q),cross(c,a,q)]
        if all(x>=0 for x in signs) or all(x<=0 for x in signs):return True
    return False


def request(text='((1+1)*(1+1))',bound=7):
    return dict(expression=text,max_nodes=bound,costs=dict(add=1,multiply=1,leaf=1))


class RegionsTests(unittest.TestCase):
    def test_controls_and_complete_grid_inclusion(self):
        from rewritelab.weights import weights
        from pathlib import Path
        controls=json.loads((Path(__file__).parent.parent/'docs/weights-controls.json').read_text())
        for c in controls:
            raw=c['input']
            report=regions(raw);self.assertTrue(verify_regions(report))
            box=weights(raw)
            for outcome in box['outcomes']:
                w=tuple(outcome['costs'][s] for s in ['add','multiply','leaf'])
                for key,winners in [('semantic',outcome['semantic_groups']),('reachable',outcome['reachable_groups'])]:
                    groups=[r for r in report['groups'] if key=='semantic' or r['reachable_terms']]
                    scores={g['id']:sum(a*b for a,b in zip(g['vector'],w)) for g in groups}
                    best=min(scores.values())
                    self.assertEqual(winners,[i for i,v in scores.items() if v==best])
                    for g in groups:
                        self.assertEqual(contains(g[key],w),g['id'] in winners)
                        if g['id'] in winners:self.assertTrue(g[key]['positive'])

    def test_constant_crossover(self):
        r=regions(request());a,b=r['groups']
        self.assertEqual([a['vector'],b['vector']],[[2,1,4],[3,0,4]])
        self.assertEqual(a['semantic']['vertices'],[[[0,1],[0,1],[1,1]],[[1,2],[1,2],[0,1]],[[1,1],[0,1],[0,1]]])
        self.assertTrue(a['semantic']['positive']);self.assertTrue(b['semantic']['positive'])

    def test_boundary_only_not_positive_and_degenerate(self):
        # A dominated vector may tie only on a closed simplex edge.
        r=_region((1,0,0),[(0,0,0),(1,0,0)])
        self.assertEqual(r,_intersections((1,0,0),[(0,0,0),(1,0,0)]))
        self.assertEqual(r['dimension'],1);self.assertFalse(r['positive'])
        r=_region((1,1,0),[(0,0,0)])
        self.assertEqual(r['dimension'],0);self.assertFalse(r['positive'])
        r=_region((1,1,1),[(0,0,0)])
        self.assertEqual(r['dimension'],-1)
        # A tie-only interior segment is possible and is still a positive region.
        r=_region((1,1,0),[(2,0,0),(0,2,0)])
        self.assertEqual(r['dimension'],1);self.assertTrue(r['positive'])
        # Point at the interior barycenter, with no area and no rounding.
        r=_region((1,1,1),[(2,0,1),(0,2,1),(1,2,0),(1,0,2)])
        self.assertEqual(r['dimension'],0);self.assertTrue(r['positive'])
        self.assertEqual(r['vertices'],[[[1,3],[1,3],[1,3]]])

    def test_differential_random_geometry(self):
        rng=random.Random(7319)
        for _ in range(500):
            vectors=sorted(set(tuple(rng.randrange(7) for _ in range(3)) for _ in range(rng.randrange(1,12))))
            for v in vectors:self.assertEqual(_region(v,vectors),_intersections(v,vectors))

    def test_original_request_validation_and_forgeries(self):
        r=regions(request())
        self.assertTrue(verify_regions(r))
        mutations=[lambda x:x.update(extra=True),lambda x:x.update(schema='other'),
            lambda x:x['groups'][0]['semantic'].update(positive=False),
            lambda x:x['groups'][0]['semantic'].update(dimension=True),
            lambda x:x['groups'][0]['semantic']['vertices'][0][0].__setitem__(1,2),
            lambda x:x['groups'][0]['semantic']['vertices'].reverse(),
            lambda x:x['groups'][0]['terms'].append('x'),
            lambda x:x['groups'][0]['reachable_terms'].clear(),
            lambda x:x['closure']['semantic_terms'].pop(),
            lambda x:x['request']['costs'].update(add=True)]
        for mutate in mutations:
            t=copy.deepcopy(r);mutate(t);self.assertFalse(verify_regions(t))
        with self.assertRaises(ValueError):regions({**request(),'costs':dict(add=True,multiply=1,leaf=1)})

    def test_positive_points_outside_integer_box(self):
        from pathlib import Path
        controls=json.loads((Path(__file__).parent.parent/'docs/weights-controls.json').read_text())
        samples=[(100,1,1),(1,100,1),(1,1,100),(997,991,2),(2,991,997),(991,2,997),(1,137,249),(137,1,249)]
        for control in controls:
            r=regions(control['input'])
            for w in samples:
                for key in ['semantic','reachable']:
                    gs=[g for g in r['groups'] if key=='semantic' or g['reachable_terms']]
                    costs=[sum(a*b for a,b in zip(w,g['vector'])) for g in gs]
                    for g,cost in zip(gs,costs):self.assertEqual(contains(g[key],w),cost==min(costs))

    def test_complete_three_node_sources_and_canonical_vertices(self):
        from rewritelab.oracle import universe
        from rewritelab.model import show
        for source in universe(3):
            r=regions(request(show(source),3));self.assertTrue(verify_regions(r))
            for g in r['groups']:
                for kind in ['semantic','reachable']:
                    q=g[kind]
                    for vertex in q['vertices']:
                        v=[F(*n) for n in vertex]
                        self.assertEqual(sum(v),1);self.assertTrue(all(n>=0 for n in v))
                        for encoded,n in zip(vertex,v):self.assertEqual(encoded,[n.numerator,n.denominator])
                    if q['positive']:
                        vs=[[F(*n) for n in p] for p in q['vertices']]
                        witness=[sum(p[k] for p in vs)/len(vs) for k in range(3)]
                        self.assertTrue(all(n>0 for n in witness))

    def test_checker_without_generator(self):
        report=regions(request())
        with patch.object(importlib.import_module('rewritelab.regions'),'regions',side_effect=RuntimeError),patch.object(importlib.import_module('rewritelab.regions'),'_clip',side_effect=RuntimeError),patch.object(importlib.import_module('rewritelab.weights'),'counts',side_effect=RuntimeError):
            self.assertTrue(verify_regions(report))

if __name__=='__main__':unittest.main()
