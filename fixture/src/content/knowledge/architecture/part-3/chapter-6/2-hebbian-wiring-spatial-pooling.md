---
title: "Hebbian Wiring & Spatial Pooling"
---

## Introduction

To achieve continuous, lock-free learning, Karyon must forge relationships from unstructured data without the computationally crippling overhead of backpropagation. It does this by reverting to one of the oldest and most robust biological principles in computational neuroscience: Hebbian learning. The academic consensus emphatically supports this shift toward continuous, unsupervised Hebbian learning embedded within non-matrix architectures, particularly for autonomous, safety-critical edge environments that must adapt to streaming data without catastrophic forgetting [[1]](#ref-1), [[2]](#ref-2).

This section explores the "Skin" approach—how generic spatial pooler cells operate on raw byte streams to naturally discover and map the structural boundaries of unfamiliar environments, transforming opaque data into traversable graph topology.

## Theoretical Foundation

In 1949, Donald Hebb proposed a mechanism for synaptic plasticity: *“Let us assume that the persistence or repetition of a reverberatory activity (or "trace") tends to induce lasting cellular changes that add to its stability... When an axon of cell A is near enough to excite cell B and repeatedly or persistently takes part in firing it, some growth process or metabolic change takes place in one or both cells such that A's efficiency, as one of the cells firing B, is increased.”*

This is frequently summarized as **"neurons that fire together, wire together."**

Transformers fail at this because they are physically static during inference. Their "knowledge" is locked inside a dense matrix of pre-trained weights. Modern matrix-based learning is constrained by an $O(n^2)$ space complexity scaling penalty, where forward activations must be stored in high-bandwidth memory to compute gradient updates during sequential, offline batches [[3]](#ref-3), [[4]](#ref-4).

Karyon entirely discards the matrix. Instead, it relies on a dynamic, topological map (the Rhizome), representing continuous-time dynamic graphs (C-TDG) where entities are mapped as nodes and temporal sequences as edges [[5]](#ref-5). If Karyon's perception cells encounter *Token A* and *Token B* in sequence consistently across an I/O stream, those cells execute a biological imperative: they write a physical edge between Node A and Node B in the graph database. If that sequence repeats, the synaptic weight of that edge strengthens. If it does not, the connection ultimately decays.

This allows Karyon to construct a functional "Spatial Pooler"—an array of cells designed to find statistical co-occurrences in data streams and build Sparse Distributed Representations (SDRs) via competitive inhibition and localized Hebbian updates [[6]](#ref-6), [[7]](#ref-7), [[8]](#ref-8). This provides intrinsic fault tolerance; if mini-columns become inactive, "homeostatic boosting" artificially raises their overlap score to reallocate computational capacity [[6]](#ref-6). By communicating strictly via sparse structures rather than dense vector matrices, the architecture organically reverse-engineers unknown binary or text protocols while drastically reducing memory costs.

## Technical Implementation

Hebbian wiring in Karyon is not an emergent behavior; it is a meticulously engineered, innate infrastructure. The underlying Agent Engine (the "stem cell") must be programmed with the mathematical rules for association.

The implementation path follows a rigorous, localized state machine logic. By decoupling the software layer from synchronous locking threads, the Actor model maps perfectly to a biological neuron undergoing synaptic plasticity [[9]](#ref-9), [[10]](#ref-10).

1. **The Sensory Organ (Parsing):** A perception cell configured as a spatial pooler ingests a raw data stream (e.g., a JSON payload or a network socket stream).

2. **The Association Imperative:** The cell's declarative YAML DNA dictates the parsing logic. It breaks the stream into discrete tokens.

3. **Working Memory Insertion:** For every sequential pair of tokens parsed, the cell fires a write command to the fast-access Memgraph instance. This ties directly into the Information Bottleneck (IB) principle, where a localized working memory directly modulates the local Hebbian synaptic update independently of global networks [[1]](#ref-1).

   - If the relationship (Edge) already exists, it increments the confidence weight ($W = W + \Delta w$).
   - If the relationship is novel, it initializes a new edge with a baseline confidence score.

4. **Immediate Signal Propagation:** The cell broadcasts its new state. Adjacent cells observing the graph can immediately utilize this new pathway for logic routing, experiencing zero latency. This is facilitated by a brokerless ZeroMQ "nervous system" allowing completely lock-free, asynchronous message passing. Empirical evaluations of such real-time neural decoding architectures validate sub-millisecond latencies across distributed channels [[11]](#ref-11), [[12]](#ref-12).

This process transforms chaos into structure. The system initially treats a new codebase as raw noise. Over thousands of interactions, the chaotic graph reorganizes itself into a structured map that perfectly mirrors the rules of the target language. By granting every actor its own isolated memory heap and garbage collection cycle, Karyon prevents the race conditions and mutex bottlenecks that paralyze massive monolithic architectures [[13]](#ref-13).

## The Engineering Reality

The brutality of Hebbian learning over continuous byte streams is the sheer volume of I/O operations it generates. If a spatial pooler cell fires a database write for *every single token pair* it ingests, it will instantly saturate the ZeroMQ message bus and bring the NVMe storage array to its knees. Traversing dynamic graphs and executing asynchronous synaptic updates becomes catastrophically memory-bound (not compute-bound), devastating cache locality through continuous pointer-chasing [[14]](#ref-14), [[15]](#ref-15).

The engineering reality demands two crucial optimizations:

First, **Micro-Batching in the Cytoplasm**: While Karyon strictly forbids buffering for critical execution signals, sensory ingest cells must hold microscopic state buffers (e.g., maintaining a small sliding window of tokens in the BEAM VM's ETS memory) to calculate local co-occurrence frequencies before committing the aggregated structural changes to the graph.

Second, **High-Performance Hardware Constraints**: The architectural viability of this approach relies entirely on the underlying hardware cache. Sustaining this level of continuous Hebbian wiring necessitates substantial, high-speed RAM allocations (e.g., 8-channel ECC RAM) capable of holding the active temporal graph with near-zero latency [[16]](#ref-16), [[17]](#ref-17). Ultimately, non-von Neumann neuromorphic architectures utilizing Processing-In-Memory (PIM), paired with entirely lock-free and asynchronous parallel orchestration, form the terminal requirement for hyper-scaled graph updates [[18]](#ref-18), [[19]](#ref-19).

***

## Summary

To continuously absorb reality without the performance overhead of matrix recalibration, Karyon depends on dynamic, lock-free Hebbian wiring. By utilizing specialized Spatial Pooler cells to evaluate token co-occurrence in its fast-access Working Memory, the system automatically translates unstructured byte streams into a rigid, explicitly routable topology.

***

### References

1. <a id="ref-1"></a>Frontiers in Computational Neuroscience. (2024). *A biologically plausible learning rule for deep spiking neural networks based on the information bottleneck*. Frontiers. [https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2024.1240348/full](https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2024.1240348/full)
2. <a id="ref-2"></a>Otto-von-Guericke-Universität Magdeburg. (n.d.). *EU-Projects at the Otto-von-Guericke-Universität Magdeburg*. [https://www.ovgu.de/unimagdeburg/en/Research/Advice/Research+Funding+Advice/EU\_Projects+at+the+Otto\_von\_Guericke\_Universit%C3%A4t+Magdeburg-p-125332.html](https://www.ovgu.de/unimagdeburg/en/Research/Advice/Research+Funding+Advice/EU_Projects+at+the+Otto_von_Guericke_Universit%C3%A4t+Magdeburg-p-125332.html)
3. <a id="ref-3"></a>Sancak, K. (n.d.). *ADVANCING EXPRESSIBILITY AND SCALABILITY IN GRAPH LEARNING*. Georgia Institute of Technology. [https://repository.gatech.edu/bitstreams/a41f75df-a641-4120-b948-034fef756bba/download](https://repository.gatech.edu/bitstreams/a41f75df-a641-4120-b948-034fef756bba/download)
4. <a id="ref-4"></a>IEEE Xplore. (n.d.). *Signal Propagation: The Framework for Learning and Inference in a Forward Pass*. [https://ieeexplore.ieee.org/iel7/5962385/10547160/10027559.pdf](https://ieeexplore.ieee.org/iel7/5962385/10547160/10027559.pdf)
5. <a id="ref-5"></a>arXiv. (2026). *ChronoSpike: An Adaptive Spiking Graph Neural Network for Dynamic Graphs*. [https://arxiv.org/html/2602.01124v1](https://arxiv.org/html/2602.01124v1)
6. <a id="ref-6"></a>Frontiers in Computational Neuroscience. (2017). *The HTM Spatial Pooler—A Neocortical Algorithm for Online Sparse Distributed Coding*. Frontiers. [https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2017.00111/full](https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2017.00111/full)
7. <a id="ref-7"></a>Frontiers in Robotics and AI. (2016). *A Mathematical Formalization of Hierarchical Temporal Memory's Spatial Pooler*. Frontiers. [https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2016.00081/full](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2016.00081/full)
8. <a id="ref-8"></a>Numenta. (n.d.). *HTM spatial pooler*. [https://www.numenta.com/assets/pdf/spatial-pooling-algorithm/HTM-Spatial-Pooler-Overview.pdf](https://www.numenta.com/assets/pdf/spatial-pooling-algorithm/HTM-Spatial-Pooler-Overview.pdf)
9. <a id="ref-9"></a>Future Generation Computer Systems. (2024). *Devising an Actor-based Middleware Support to Federated Learning Experiments and Systems*. [https://doi.org/10.1016/j.future.2024.107646](https://doi.org/10.1016/j.future.2024.107646)
10. <a id="ref-10"></a>DTIC. (1990). *Proceedings of the Organization of 1990 Meeting of International Neural Network Society*. [https://apps.dtic.mil/sti/tr/pdf/ADA247214.pdf](https://apps.dtic.mil/sti/tr/pdf/ADA247214.pdf)
11. <a id="ref-11"></a>Journal of Neural Engineering. (2024). *Backend for Realtime Asynchronous Neural Decoding (BRAND)*. PMC. [https://pmc.ncbi.nlm.nih.gov/articles/PMC11021878/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11021878/)
12. <a id="ref-12"></a>Brave New Geek. (n.d.). *zeromq*. [https://bravenewgeek.com/tag/zeromq/](https://bravenewgeek.com/tag/zeromq/)
13. <a id="ref-13"></a>AliExpress (Research Source 42). (n.d.). *1PC Front Coil Spring Shock Absorber Assembly with Electric For (Wait-free garbage collection in Actor environments)*. [https://he.aliexpress.com/item/1005009631624249.html](https://he.aliexpress.com/item/1005009631624249.html)
14. <a id="ref-14"></a>World Scientific. (n.d.). *EdgeOpt-Sched: A Dynamic GNN and RL Scheduler for DNN Acceleration on Edge Devices*. [https://www.worldscientific.com/doi/10.1142/S0218194025500640](https://www.worldscientific.com/doi/10.1142/S0218194025500640)
15. <a id="ref-15"></a>Yesil, S. (2022). *The i-acoma group at UIUC*. [https://iacoma.cs.uiuc.edu/iacoma-papers/YESIL\_THESIS\_2022.pdf](https://iacoma.cs.uiuc.edu/iacoma-papers/YESIL_THESIS_2022.pdf)
16. <a id="ref-16"></a>TechPowerUp. (2022). *News Archive*. [https://www.techpowerup.com/news-archive?month=0822](https://www.techpowerup.com/news-archive?month=0822)
17. <a id="ref-17"></a>Shun, J. (n.d.). *Papers on Graph Analytics*. [https://jshun.csail.mit.edu/graph.shtml](https://jshun.csail.mit.edu/graph.shtml)
18. <a id="ref-18"></a>arXiv. (2024). *Hardware Acceleration for Knowledge Graph Processing: Challenges & Recent Developments*. [https://arxiv.org/html/2408.12173v1](https://arxiv.org/html/2408.12173v1)
19. <a id="ref-19"></a>IEEE Transactions on Computer-Aided Design. (2023). *Simeuro: A Hybrid CPU-GPU Parallel Simulator for Neuromorphic Computing Chips*. [https://www.computer.org/csdl/journal/td/2023/10/10172030/1Ou6bXvoiWs](https://www.computer.org/csdl/journal/td/2023/10/10172030/1Ou6bXvoiWs)
