---
title: "The Baseline Diet"
---

## Introduction

The convergence of deterministic syntax parsing, graph representation learning, and active inference has catalyzed a fundamental paradigm shift in the architecture of autonomous code-generating systems. In biological systems, organisms are not born as blank mathematical slates; they possess hardcoded instincts—genetic infrastructure—that dictates how they parse the physical world. A human infant does not need to learn *how* to process photons into visual data; the physical retina handles the protocol parsing inherently.

Similarly, for the Karyon microkernel to begin mapping abstract architectural relationships, it must first possess an unwavering, instinctual understanding of the base reality it inhabits: source code syntax. If the underlying memory graph (Rhizome) is corrupted by malformed grammar or syntax errors early in its lifespan, every subsequent abstraction layered atop that foundation will be structurally flawed.

This architectural requirement mirrors the long-standing cognitive science debate between connectionist models and Chomskyan Universal Grammar. While standard Large Language Models (LLMs) operate as the ultimate expression of the connectionist paradigm—learning language structures purely through statistical pattern recognition over massive, uncurated data [[1]](#ref-1)—they fundamentally lack innate grammatical scaffolding [[2]](#ref-2). This probabilistic acculturation allows for immense flexibility in natural language processing but results in probabilistic outputs that do not guarantee logical consistency [[3]](#ref-3). In software engineering, where a single misplaced token or unclosed bracket results in catastrophic execution failure, probabilistic emergence is an unacceptable liability.

To prevent this, the cellular organism undergoes an initial ingestion phase colloquially known as **The Baseline Diet**. This is a highly constrained, heavily curated phase where the system is exclusively fed 1-5GB of pristine, modular source code as an unyielding Abstract Syntax Tree (AST) baseline. By establishing a rigid deterministic nucleus (the innate grammar) combined with a flexible neural periphery, the architecture ensures that the AI's internal generative models remain strictly aligned with the target language's syntax and human-intended logic before execution [[4]](#ref-4).

## The Objective of Deterministic Parsing

The cellular AI is not attempting to write boilerplate code during this baseline ingestion phase. Its sole objective is to observe and physically construct the lowest-level nodes and edges of its internal Memgraph instance.

The fundamental premise of neuro-symbolic code analysis is that source code possesses an inherent, rigid hierarchy that cannot be fully captured by one-dimensional sequence modeling. When a large language model processes code as a flat sequence of tokens, applying attention mechanisms to infer context, it natively fails to grasp structural boundaries—unable to instinctively distinguish an undeclared variable named "function" from an actual functional declaration without extensive contextual approximation [[5]](#ref-5).

To rectify the limitations of sequence modeling, the Karyon architecture employs deterministic parsers to generate ASTs. When a perception cell (configured via YAML DNA to act as a sensory parser) ingests a file from the pristine repository, it uses Tree-sitter—or a similarly error-tolerant, low-level Rust NIF—to parse the file. Tree-sitter generates concrete syntax trees in microseconds with full fidelity to the source code, abstracting surface-level variations to focus entirely on structural syntax and capturing the exact source locations vital for mapping dimensional hierarchies into topological matrices [[5]](#ref-5), [[6]](#ref-6).

The perception cell then translates that tree strictly into topological components for spatial graph traversal:

- **The Nodes:** Variables, Class Definitions, Function Declarations, External Endpoints.
- **The Edges:** `Invokes`, `Inherits_From`, `Depends_On`, `Mutates`.

By continuously ingesting this 1-5GB baseline of structurally perfect data, the optimization daemons running in the background (the "sleep cycle") begin identifying recurring graphical patterns. Over millions of micro-interactions, the graph organizes itself into a mapping that perfectly mirrors the incontrovertible laws of the host language. To mitigate the problem of vanishing gradients typical of massive, monolithic ASTs, the system leverages techniques akin to AST-based Neural Networks (ASTNN), systematically partitioning the primary tree into localized statement sub-trees and encoding them into continuous vectors [[7]](#ref-7). This methodology transforms the mathematical geometry of the data, allowing the neural network to traverse complex, multi-variable dependencies natively without computational overloading [[8]](#ref-8).

## Absolute Sterility and Topological Mapping

The data fed to the organism during the Baseline Diet must be unequivocally sterile. It cannot contain hacked-together scripts, deprecated logic, or temporary workarounds.

This architectural mandate stems from the "Sterility Hypothesis," which posits that graph-based models possess a unique operational vulnerability when exposed to non-pristine training data. Traditional transformer-based models are trained via massive uncurated scraping, utilizing statistical probability to effectively "smooth over" logical inconsistencies in the corpus. Dense matrix transformers can gloss over sloppy code by predicting the statistically acceptable middle ground. In stark contrast, a cellular Memory Graph treats *everything* it ingests as an explicit, definitive physical relationship.

If you feed the system a codebase filled with technical debt, it will dutifully map that debt as a valid structural paradigm [[9]](#ref-9). Empirical studies in spatial anomaly detection and semantic segmentation illustrate that graph networks trained on highly curated, sterile data form robust feature extractors with exceptional generalization capabilities, whereas noisy datasets force the network to assign mathematical weights to anomalous, inefficient pathways [[10]](#ref-10).

Furthermore, graph models exhibit severe brittleness when subjected to chaotic or irregular inputs due to their core mechanics [[11]](#ref-11). Graph Neural Networks (GNNs) utilize message-passing algorithms where each node iteratively updates its continuous state vector based upon the aggregated states of its immediate neighbors [[12]](#ref-12). Consequently, if a single syntactical node is corrupted by logically flawed code or technical debt, that error is unequivocally propagated throughout the entire local graph neighborhood during the aggregation phase. Within a few layers of message passing, the noise from one logically flawed function can contaminate the topological embedding of an entire subsystem [[12]](#ref-12).

Thus, the Baseline Diet must consist exclusively of highly opinionated, flawlessly tested, and mathematically sound repositories. Providing a foundation composed of provable geometric axioms rather than chaotic approximations is critical to preventing the AI's foundational reasoning capabilities from becoming intrinsically compromised.

### Dimensionality Costs and the Richer Representation Fallacy

While the theoretical appeal of capturing deep semantic relationships through multidimensional topologies is strong, the engineering reality of hosting these graphs natively mandates strict moderation. Imposing an unconstrained metabolism on the single-socket Threadripper architecture during the ingestion phase rapidly encounters severe thermodynamic and computational bottlenecks.

In pursuit of greater semantic context, contemporary research frequently attempts to augment standard ASTs into hybrid multigraphs by explicitly encoding Control Flow Graphs (CFGs), Data Flow Graphs (DFGs), or Flow-Augmented ASTs (FA-ASTs). However, calculating dynamic data dependencies via DFGs has been shown to increase baseline ingestion time by a factor of 21, while FA-AST transitions can more than double necessary storage costs and graph density [[13]](#ref-13).

Beyond the extreme I/O and memory channel constraints, this unchecked dimensional expansion actively degrades the system's reasoning capacity—a phenomenon formally identified as the "Richer Representation Fallacy" [[14]](#ref-14). Supplying a model with excessive structural information introduces "structural noise," overloading the graph neural network's cross-attention mechanisms. The AI is forced to optimize neural weights across redundant or contradictory topological pathways. Studies utilizing Graph Matching Networks (GMNs) have demonstrated that an unadulterated, standard AST structure consistently yields superior accuracy, allowing the cross-attention layers to natively discover relational alignment without the computational bloat and mathematical distortion of densely interwoven flow graphs [[13]](#ref-13).

Consequently, the engineering imperative for the Baseline Diet is not to capture every conceivable semantic association interactively, but rather to construct mathematically elegant, deterministic scaffolding that highlights fundamental relationships without overloading the hardware's NVMe and memory capacities.

## Motor Output and Active Inference in the Sandbox

Once the Memgraph has consolidated the structural invariants mapped during the Baseline Diet, the organism transitions from pure ingestion to active inference via its configured motor cells. This transition transforms passive, open-loop statistical prediction into a closed-loop deterministic execution cycle rooted in the Free Energy Principle (FEP) [[4]](#ref-4).

The biological necessity for a self-organizing system to minimize variational free energy equates computationally to minimizing prediction errors—the gap between the system's internal generative model and the sensory feedback of its environment [[15]](#ref-15). For Karyon, the environment is defined strictly by the deterministic execution sandbox (the native compiler or runtime environment). The system utilizes its newly forged internal graph topology to synthesize an AST hypothesis, converts it back into valid syntax text, and injects it into the compilation environment [[16]](#ref-16).

If the proposed source code compiles flawlessly, the synaptic pathways governing that topological output are reinforced. However, if the output fails, the compiler diagnostic acts as an immediate, highly specific sensory prediction error. Leveraging paradigms akin to the DrRepair framework, the system utilizes a specialized program-feedback graph paired with advanced graph-attention mechanisms mapping the traceback text directly to structural nodes on the AST [[17]](#ref-17). Rather than probabilistically guessing a syntactical fix, the Karyon traces the failing symbol through the AST spatial geometry and instantly prunes the anomalous graph edges that originated the violation.

Because the Baseline Diet provides an initial, utterly sterile reference model of reality, these execution prediction errors are isolated purely to higher-order logical abstractions rather than foundational grammar issues. This active inference sandbox guarantees that the system's motor outputs are continually restricted by deterministic, provable boundaries, facilitating zero-latency self-correction without relying on massive, annotated datasets.

## Summary

To prevent the chaotic accretion of invalid logic, Karyon requires a rigid developmental foundation. The Baseline Diet restricts the organism's initial sensory input to pristine, formally validated ASTs—establishing an unwavering grammatical physics engine before activating motor outputs in the active inference sandbox.

***

## References

1. <a id="ref-1"></a>The Philosophy Forum. (2024). *Exploring the artificially intelligent mind of GPT4*. The Philosophy Forum. [https://thephilosophyforum.com/discussion/14138/exploring-the-artificially-intelligent-mind-of-gpt4/p17](https://thephilosophyforum.com/discussion/14138/exploring-the-artificially-intelligent-mind-of-gpt4/p17)
2. <a id="ref-2"></a>Dan Everett. (2014). *Pragmatics & Cognition*. Dan Everett Books. [https://daneverettbooks.com/wp-content/uploads/2014/04/Pragmatics-and-Cognition.pdf](https://daneverettbooks.com/wp-content/uploads/2014/04/Pragmatics-and-Cognition.pdf)
3. <a id="ref-3"></a>Kenichi Sasagawa. (2024). *Montague Grammar: A First Step Toward Neuro-Symbolic AI*. Medium. [https://medium.com/@kenichisasagawa/montague-grammar-a-first-step-toward-neuro-symbolic-ai-6b5591594f4c](https://medium.com/@kenichisasagawa/montague-grammar-a-first-step-toward-neuro-symbolic-ai-6b5591594f4c)
4. <a id="ref-4"></a>Anonymous. (2025). *Cognitive Silicon: An Architectural Blueprint for Post-Industrial Computing Systems*. arXiv. [https://arxiv.org/html/2504.16622v1](https://arxiv.org/html/2504.16622v1)
5. <a id="ref-5"></a>Dropstone Research. (2024). *AST Parsing at Scale: Tree-sitter Across 40 Languages*. Dropstone Research. [https://www.dropstone.io/blog/ast-parsing-tree-sitter-40-languages](https://www.dropstone.io/blog/ast-parsing-tree-sitter-40-languages)
6. <a id="ref-6"></a>Dinesh Kuppan. (2024). *Semantic Code Indexing with AST and Tree-sitter for AI Agents (Part - 1 of 3)*. Medium. [https://medium.com/@email2dineshkuppan/semantic-code-indexing-with-ast-and-tree-sitter-for-ai-agents-part-1-of-3-eb5237ba687a](https://medium.com/@email2dineshkuppan/semantic-code-indexing-with-ast-and-tree-sitter-for-ai-agents-part-1-of-3-eb5237ba687a)
7. <a id="ref-7"></a>Hongyu Zhang. (2019). *A Novel Neural Source Code Representation Based on Abstract Syntax Tree*. GitHub. [http://hongyujohn.github.io/ASTNN.pdf](http://hongyujohn.github.io/ASTNN.pdf)
8. <a id="ref-8"></a>MDPI. (2026). *Early-Stage Graph Fusion with Refined Graph Neural Networks for Semantic Code Search*. MDPI. [https://www.mdpi.com/2076-3417/16/1/12](https://www.mdpi.com/2076-3417/16/1/12)
9. <a id="ref-9"></a>Anonymous. (2026). *RAG-GNN: Integrating Retrieved Knowledge with Graph Neural Networks for Precision Medicine*. arXiv. [https://arxiv.org/html/2602.00586v1](https://arxiv.org/html/2602.00586v1)
10. <a id="ref-10"></a>DiVA. (2024). *FGSSNet: Applying Feature-Guided Semantic Segmentation on real world floorplans*. DiVA. [http://www.diva-portal.org/smash/get/diva2:1867190/FULLTEXT02.pdf](http://www.diva-portal.org/smash/get/diva2:1867190/FULLTEXT02.pdf)
11. <a id="ref-11"></a>Jesse Kroll. (2025). *Evaluating Adversarial Robustness in Time-Series Classification: A Comparative Study on Self-Supervised Learning Models*. LIACS Thesis Repository. [https://theses.liacs.nl/pdf/2024-2025-KrollJJesse.pdf](https://theses.liacs.nl/pdf/2024-2025-KrollJJesse.pdf)
12. <a id="ref-12"></a>Distill. (2021). *A Gentle Introduction to Graph Neural Networks*. Distill. [https://distill.pub/2021/gnn-intro/](https://distill.pub/2021/gnn-intro/)
13. <a id="ref-13"></a>Anonymous. (2025). *AST-Enhanced or AST-Overloaded? The Surprising Impact of Hybrid Graph Representations on Code Clone Detection*. arXiv. [https://arxiv.org/abs/2506.14470](https://arxiv.org/abs/2506.14470)
14. <a id="ref-14"></a>Maffeis, M. (2025). *The Richer Representation Fallacy: Are We Just Adding Noise to LLM-based Software Vulnerability Detectors?*. IEEE Xplore. [https://ieeexplore.ieee.org/iel8/11334018/11334019/11334069.pdf](https://ieeexplore.ieee.org/iel8/11334018/11334019/11334069.pdf)
15. <a id="ref-15"></a>eLife. (2024). *A neuronal least-action principle for real-time learning in cortical circuits*. eLife. [https://elifesciences.org/reviewed-preprints/89674](https://elifesciences.org/reviewed-preprints/89674)
16. <a id="ref-16"></a>Anonymous. (2020). *Action understanding and active inference*. PMC - NIH. [https://pmc.ncbi.nlm.nih.gov/articles/PMC3491875/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3491875/)
17. <a id="ref-17"></a>Yasunaga, M., & Liang, P. (2020). *Graph-based, Self-Supervised Program Repair from Diagnostic Feedback*. Stanford NLP. [https://nlp.stanford.edu/pubs/yasunaga2020repair.pdf](https://nlp.stanford.edu/pubs/yasunaga2020repair.pdf)
