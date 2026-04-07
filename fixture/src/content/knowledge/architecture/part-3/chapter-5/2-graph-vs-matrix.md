---
title: "Graph vs Matrix"
---

## Introduction

Modern artificial intelligence is built upon a profound structural contradiction. While the goal is to replicate the fluid, associative intelligence of biological organisms, the underlying mathematical engines are constrained by the rigid silicon reality of the hardware they inhabit.

## The Hardware Artifact: GPU Optimization and the Dominance of Dense Matrices

The presiding orthodoxy in artificial intelligence insists that intelligence must be modeled using dense matrices. This is not a biological reality; it is an artifact of hardware optimization. The phenomenon, formally recognized as the "hardware lottery" [[1]](#ref-1), describes how the trajectory of AI algorithmic design has been artificially dictated by its compatibility with available chip architectures. Specifically, the modern Graphics Processing Unit (GPU) was designed to massively parallelize dense matrix multiplications (MatMuls) [[2]](#ref-2).

As an industry, we have forcefully reduced cognitive architectures into chained matrix multiplications simply to exploit decades of hardware optimizations, a practice termed "MatMul-reductionism." While sparse, dynamic network topologies are theoretically and mathematically proven to be far more efficient—closely mirroring the sparse interconnectivity of the human brain—executing unstructured pointer-chasing and topological routing on modern memory arrays results in severe bandwidth bottlenecks. Consequently, attempting to compute unstructured, sparse networks yields performance virtually equivalent to computing the entire dense matrix, masking the zero-values but consuming identical hardware resources [[3]](#ref-3). We have forced algorithmic architecture to fit the hardware, rather than building architectures that mimic actual intelligence.

## The Mathematical Fallacy of Dense Matrices

A dense matrix forces relationships into rigid, mathematical dimensions. While exceptionally efficient for processing screen pixels or calculating the statistical probability distributions of next tokens, matrices exhibit profound structural brittleness when mapped against the chaotic, sparse, and hierarchical nature of true lifelong learning.

### Mechanisms of Destructive Interference

When a standard neural network trains, it encodes knowledge as a high-dimensional vector in a globally shared weight space. Every piece of knowledge is blended into an opaque blob through continuous backpropagation. If an architecture attempts to incrementally learn a new task and continuously attempts to update those weights, the new gradient signals inadvertently overwrite the highly correlated geometric configurations required to maintain previous models. This continuous update mathematically guarantees structural collapse, known as Catastrophic Forgetting [[4]](#ref-4). Attempting to update a densely entangled matrix with overlapping manifolds forces highly destructive representational overlap for sequential tasks [[5]](#ref-5).

### Opacity and the Loss of Explainability

This reliance on global statistical averaging inherent to dense structures permanently destroys mechanistic explainability. Because a dense matrix relies on distributed superposition—where individual parameters represent an inseparable mixture of multiple distinct concepts—there is no discrete, traceable causal route from raw input to output prediction [[6]](#ref-6). If the model hallucinates, the logic is irrecoverably buried inside the non-linear math. This opacity renders purely dense models mathematically unsuited for high-stakes, verifiable environments. If the system must continuously adapt, hold deterministic state, and cleanly reorganize its structure based on physical execution without interference, dense matrices offer no path forward.

## Biological Reality: Sparse Topology and Graphs

True physical intelligence in nature avoids catastrophic forgetting not through dense, globally updated backpropagation, but via highly localized, structurally modular topologies. Biological neurons do not organize into massive grids of floating-point values that fire simultaneously; they form discrete, dynamic **Graphs**.

This biological mandate is formalized in the Thousand Brains Theory, which posits that intelligences do not operate as single monolithic dense processors, but as thousands of independent, structurally isolated computational models that communicate via decentralized protocols to achieve consensus [[7]](#ref-7). Empirical research mapping associative continual learning circuits, such as those in the fruit fly, provides a direct architectural blueprint: extreme sparsity mathematically separates representations, drastically reducing memory interference, while localized associative learning explicitly modifies only active relational synapses, keeping all other unconnected weights mathematically frozen [[8]](#ref-8). A graph consisting of discrete **Nodes** (concepts) connected by defined **Edges** (causal relationships) naturally maps to this required sparsity.

## Dynamic Adaptation: Topological Routing and Explainable State

When an architecture utilizes a dynamic graph topology instead of a dense matrix, it moves from predicting statistics to charting structural reality.

### Routing and Expansion

In a dense matrix, every parameter is touched, and memory capacity is fixed. In a graph-based framework like Karyon's Rhizome, nodes can be dynamically added as novel out-of-distribution concepts are encountered. Execution relies on *topological routing*; a cell merely traverses the specific relational pathway required for the task (e.g., following the `[Depends_On]` edge between two explicit constraints), rather than dragging data through billions of unrelated weights. Techniques such as Dynamic Sparse Training (DST) explicitly optimize topologies on the fly, growing new sparse connections and maintaining structural isolation [[9]](#ref-9). Furthermore, algorithms that utilize genetic routing through vast super-networks have demonstrated that navigating discrete sparse pathways, while permanently freezing the historical pathway's gradients, provides mathematically guaranteed immunity to interference [[10]](#ref-10).

### State-Holding and Karyon's Transition

Because knowledge is explicitly stored topologically via discrete pathways rather than statistical averages, every single decision path is transparently traceable. However, navigating this topology effectively requires robust mechanisms for state-holding. Vector Symbolic Architectures (VSAs) successfully represent discrete symbolic states as high-dimensional, sparse hypervectors. Integrated with attractor networks, VSAs enable continuous neural substrates to execute deterministic, exact finite state machine sequences without degrading structural weights [[11]](#ref-11). The AI formulates a "thought" by traversing physical, stateful connections in the graph, making its reasoning mechanically observable.

By transitioning from matrices to the Rhizome graph, Karyon definitively rejects the hardware lottery to embrace a dynamic, growing map mathematically capable of true continuous learning and verifiable deduction.

## Summary

Dense matrices represent a hardware-optimized artifact fundamentally incompatible with continuous autonomous learning, suffering from catastrophic forgetting and mechanistic opacity. By transitioning to the sparse, dynamic topology of the Rhizome graph, Karyon explicitly maps causal relationships, allowing for verifiable state-holding and localized adaptation without destroying historical weights.

***

## References

1. <a id="ref-1"></a>Hooker, S. (2021). *The Hardware Lottery*. Communications of the ACM, 64(12), 58–65. [https://www.scribd.com/document/490478747/2009-06489](https://www.scribd.com/document/490478747/2009-06489)
2. <a id="ref-2"></a>CS 152: Computer Systems Architecture. (2023). *GPU Introduction*. [https://ics.uci.edu/\~swjun/courses/2023S-CS152/slides/lec13%20-%20GPU%20Introduction.pdf](https://ics.uci.edu/~swjun/courses/2023S-CS152/slides/lec13%20-%20GPU%20Introduction.pdf)
3. <a id="ref-3"></a>ResearchGate. (N.D.). *(PDF) Truly Sparse Neural Networks at Scale*. [https://www.researchgate.net/publication/348508649\_Truly\_Sparse\_Neural\_Networks\_at\_Scale](https://www.researchgate.net/publication/348508649_Truly_Sparse_Neural_Networks_at_Scale)
4. <a id="ref-4"></a>arXiv.org. (N.D.). *Catastrophic Forgetting in Deep Learning: A Survey*. [https://arxiv.org/pdf/2312.10549](https://arxiv.org/pdf/2312.10549)
5. <a id="ref-5"></a>Kaushik, et al. (2021). *Understanding Catastrophic Forgetting and Remembering in Continual Learning with Optimal Relevance Mapping*. Johns Hopkins Computer Science. [https://www.cs.jhu.edu/\~alanlab/Pubs21/kaushik2021understanding.pdf](https://www.cs.jhu.edu/~alanlab/Pubs21/kaushik2021understanding.pdf)
6. <a id="ref-6"></a>arXiv.org. (N.D.). *Mechanistic Interpretability for AI Safety: A Review*. [https://arxiv.org/html/2404.14082v3](https://arxiv.org/html/2404.14082v3)
7. <a id="ref-7"></a>Hawkins, J. et al. (2019). *The Thousand Brains Theory of Intelligence*. [https://arxiv.org/html/2412.18354v1](https://arxiv.org/html/2412.18354v1)
8. <a id="ref-8"></a>MIT Press. (N.D.). *Reducing Catastrophic Forgetting With Associative Learning: A Lesson From Fruit Flies*. Neural Computation. [https://direct.mit.edu/neco/article/35/11/1797/117579/Reducing-Catastrophic-Forgetting-With-Associative](https://direct.mit.edu/neco/article/35/11/1797/117579/Reducing-Catastrophic-Forgetting-With-Associative)
9. <a id="ref-9"></a>Sokar, G. (N.D.). *Learning Continually Under Changing Data Distributions*. [https://assets.w3.tue.nl/w/fileadmin/content/universiteit/Academische\_plechtigheden/academische\_jaarprijzen/2024/PhD/Thesis/PhDThesis\_GhadaSokar.pdf](https://assets.w3.tue.nl/w/fileadmin/content/universiteit/Academische_plechtigheden/academische_jaarprijzen/2024/PhD/Thesis/PhDThesis_GhadaSokar.pdf)
10. <a id="ref-10"></a>Fernando, C. et al. (2017). *PathNet: Evolution Channels Gradient Descent in Super Neural Networks*. arXiv:1701.08734. [https://arxiv.org/abs/1701.08734](https://arxiv.org/abs/1701.08734)
11. <a id="ref-11"></a>Kleyko, D. et al. (2022). *Vector Symbolic Finite State Machines in Attractor Neural Networks*. Neural Computation. [https://direct.mit.edu/neco/article/36/4/549/119784/Vector-Symbolic-Finite-State-Machines-in-Attractor](https://direct.mit.edu/neco/article/36/4/549/119784/Vector-Symbolic-Finite-State-Machines-in-Attractor)
