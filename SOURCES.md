# Primary sources and nonclaims

Read November 9, 2026. These sources motivate explicit search, phase-ordering,
AI graph optimization and validation. This project is an explicit finite rewrite
graph with a tiny rational polynomial language, not an e-graph, tensor optimizer,
floating-point optimizer or LLVM validator. None of the sources' systems,
performance results or larger claims are attributed to this implementation.
All sources below are primary and author/project or publisher hosted.

1. Ross Tate, Michael Stepp, Zachary Tatlock, Sorin Lerner. *Equality Saturation:
   a New Approach to Optimization*, POPL 2009.
   https://www.cs.cornell.edu/~lerner/papers/popl09.pdf
   Abstract, introduction and overview read. Supplies the established separation
   between retaining alternatives and choosing a final cost optimum, and the
   phase-ordering motivation. No claim to implement PEGs/E-PEGs or Peggy.
2. Max Willsey, Chandrakana Nandi, Yisu Remy Wang, Oliver Flatt, Zachary Tatlock,
   Pavel Panchekha. *egg: Fast and Extensible Equality Saturation*, POPL 2021.
   https://arxiv.org/html/2004.03082v3
   Publisher record: https://dl.acm.org/doi/10.1145/3434304
   Abstract, introduction and §2.2 read. Distinguishes the exponentially explicit
   alternative-keeping rewrite graph used here from a compact e-graph and its
   congruence/rebuilding/e-class analyses. This project does not implement egg.
3. Yichen Yang, Phitchaya Mangpo Phothilimthana, Yisu Remy Wang, Max Willsey,
   Sudip Roy, Jacques Pienaar. *Equality Saturation for Tensor Graph
   Superoptimization*, MLSys 2021.
   https://proceedings.mlsys.org/paper_files/paper/2021/file/cc427d934a7f6c0663e5923f49eba531-Paper.pdf
   Abstract/introduction and term-rewriting background read. Establishes why
   rewrite ordering/search matters to deep-learning computation graphs. No
   tensor graphs, ILP extraction, GPU measurements or TENSAT speedup claim here.
4. Zhihao Jia and coauthors. TASO project page, linked SOSP 2019 publication.
   https://catalyst.cs.cmu.edu/projects/taso.html
   Explains generated/verified graph substitutions and cost-based search for
   DNN graphs. This is source context only; no ONNX/PyTorch import, automatic
   rule discovery or TASO performance reproduction.
5. Pavel Panchekha, Alex Sanchez-Stern, James R. Wilcox, Zachary Tatlock.
   *Automatically Improving Accuracy for Floating Point Expressions*, PLDI 2015.
   https://jamesrwilcox.com/herbie.pdf
   Abstract/introduction read. Explains why exact algebraic identity alone does
   not establish floating-point accuracy or behavior. No Herbie heuristic,
   sampled error estimate or accuracy improvement is implemented or claimed.
6. Nuno P. Lopes, Juneyoung Lee, Chung-Kil Hur, Zhengyang Liu, John Regehr.
   *Alive2: bounded translation validation for LLVM*, PLDI 2021.
   https://dl.acm.org/doi/10.1145/3453483.3454030
   Publisher-authored abstract and authors/date read, not the page's separately
   labeled AI-generated summary. Supplies bounded-validation context and the
   importance of stated semantic/resource scope. This is not LLVM, SMT,
   machine arithmetic or a production translation validator.
7. TASO reference implementation and project documentation.
   https://github.com/jiazhihao/TASO
   Official project repository read. Implementation/project evidence for the
   surrounding AI-compiler domain, not imported code or a dependency.

The polynomial-identity grid argument is proved directly in CONTRACT.md from
its finite degree bound and the univariate root bound. It is not presented as
an empirical evaluation. Cost weights are supplied arithmetic weights, not
learned/measured latency. All controls are synthetic arithmetic examples.
