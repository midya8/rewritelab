import unittest,json,copy
from pathlib import Path
from unittest.mock import patch
from rewritelab import weights,verify_weights,optimize
from rewritelab.oracle import universe
from rewritelab.model import show
C=dict(add=1,multiply=1,leaf=1)
def req(s,b=7):return dict(expression=s,max_nodes=b,costs=C)
class Weights(unittest.TestCase):
    def test_controls(self):
        controls=json.loads((Path(__file__).parents[1]/'docs/controls.json').read_text())
        for c in controls:self.assertTrue(verify_weights(weights(c['input'])))
    def test_three_node_exhaustive(self):
        for t in universe(3):self.assertTrue(verify_weights(weights(req(show(t),3))))
    def test_full_generator_crosscheck(self):
        for source,budget in [('(x*(1+1))',5),('((1+1)*(1+1))',7)]:
            r=weights(req(source,budget))
            for o in r['outcomes']:
                report=optimize({**r['request'],'costs':o['costs']})
                self.assertEqual((o['reachable_cost'],o['semantic_cost'],o['gap']),(report['best_reachable']['cost'],report['best_semantic']['cost'],report['objective_gap']))
                for kind in ['reachable','semantic']:
                    terms=sorted(t for i in o[kind+'_groups'] for t in r['groups'][i]['reachable_terms' if kind=='reachable' else 'terms']);self.assertEqual(terms,report['best_'+kind]['ties'])
    def test_tie_plane_and_fixed_reachability(self):
        r=weights(req('((1+1)*(1+1))',7))
        tie=next(o for o in r['outcomes'] if o['costs']==dict(add=2,multiply=2,leaf=1));self.assertEqual(tie['gap'],0);self.assertGreater(len(tie['semantic_groups']),1)
        gap=next(o for o in r['outcomes'] if o['costs']==C);self.assertEqual(gap['gap'],0)
        self.assertEqual(len(r['outcomes']),512)
        self.assertEqual(r['closure']['reachable_count'],1)
    def test_forged(self):
        r=weights(req('(x*(1+1))',5))
        for path in [['schema'],['source'],['groups',0,'id'],['groups',0,'vector'],['groups',0,'semantic_wins'],['groups',0,'reachable_wins'],['groups',0,'dominated_by'],['groups',0,'terms'],['groups',0,'reachable_terms'],['outcomes',0,'gap'],['outcomes',0,'semantic_groups'],['outcomes',0,'reachable_groups'],['outcomes',0,'costs'],['closure','objective_gap']]:
            for value in [None,True,False,0,999,'wrong',[],{}]:
                f=copy.deepcopy(r);d=f
                for key in path[:-1]:d=d[key]
                if d[path[-1]]==value and type(d[path[-1]]) is type(value):continue
                d[path[-1]]=value;self.assertFalse(verify_weights(f),(path,value))
        for key in r:
            f=copy.deepcopy(r);f.pop(key);self.assertFalse(verify_weights(f))
        for key in ['groups','outcomes']:
            f=copy.deepcopy(r);f[key].reverse();self.assertFalse(verify_weights(f))
        f=copy.deepcopy(r);f['extra']=0;self.assertFalse(verify_weights(f))
    def test_disabled(self):
        r=weights(req('(x*(1+1))'))
        with patch.object(__import__('importlib').import_module('rewritelab.weights'),'weights',side_effect=AssertionError),patch.object(__import__('importlib').import_module('rewritelab.weights'),'counts',side_effect=AssertionError),patch('rewritelab.search.optimize',side_effect=AssertionError),patch('rewritelab.search.polynomial',side_effect=AssertionError):self.assertTrue(verify_weights(r))
    def test_invalid(self):
        for r in [None,{},[],True]:self.assertFalse(verify_weights(r))
        with self.assertRaises(ValueError):weights(req('(x*(1+1))',3))
