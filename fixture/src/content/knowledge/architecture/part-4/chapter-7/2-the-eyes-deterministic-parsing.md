---
title: "The Eyes (Deterministic Parsing)"
---

## Introduction

The most fundamental flaw in using an autoregressive neural network to parse complex structural environments—such as the 10,000 files of a software monorepo—is hallucination. Neural networks are probabilistic inference engines; they do not perceive the definitive source of truth, they predict the most statistically likely sequence of tokens that represents it. In the domain of software engineering, code hallucination manifests as a systematic distortion of conceptual organization, relational architecture, and syntactical grounding [[1]](#ref-1). When standard AI models attempt to build an internal map of an entire codebase, they frequently invent nonexistent dependencies, hallucinate function signatures, and drop exact references due to context window constraints.

For an architecture tasked with sovereign engineering, probabilistic perception of structural code is a fatal error. Recent evaluations on real-world repository benchmarks reveal that flagship models solve a mere fraction of issues without explicit structural scaffolding [[2]](#ref-2). Furthermore, error rates exhibit a distinct "context cliff," rising sharply once a codebase exceeds minimal structural thresholds [[3]](#ref-3).

## Theoretical Foundation

To operate as a competent systems architect, Karyon must possess a localized, 100% accurate mental model of the source code it intends to manipulate. When a baby is born, it does not spend the first two years computationally deriving the physics of photon ingestion from scratch; it is born with a functioning retina given to it by its genetic code.

### The Fallacy of Naive Vector Retrieval

To combat context window limitations, the industry initially adopted Retrieval-Augmented Generation (RAG) using dense vector databases. However, naive vector retrieval is fundamentally incompatible with the topological reality of software. Code is a rigid, mathematically constrained web of dependencies, inheritance hierarchies, and call graphs. Vector embeddings flatten this multi-dimensional structure into undifferentiated, semantically muddy chunks. When autonomous agents attempt iterative reasoning, vector search retrieves disconnected fragments, flooding the context window with irrelevant files and exacerbating Project Context Conflicts [[4]](#ref-4).

### Taxonomy of Codebase Hallucinations and Security Constraints

In the Karyon framework, the "Eyes" are Perception Cells genetically configured (via YAML DNA) to operate purely as deterministic parsers. They do not employ neural weights to guess at code structure; they algorithmically map the exact syntax. This deterministic approach is essential given the established taxonomy of codebase hallucinations, which includes Task Requirement Conflicts, Factual Knowledge Conflicts, and Project Context Conflicts [[5]](#ref-5).

The inability of autoregressive networks to maintain deterministic awareness introduces severe vulnerabilities into the software supply chain. Large Language Models frequently generate "package hallucinations," recommending libraries that do not exist [[6]](#ref-6). This vulnerability facilitates "slopsquatting," where malicious actors register hallucinated package names specifically to embed malware into enterprise environments [[7]](#ref-7).

## Technical Implementation

Because probabilistic models consistently fail at reliable structural mapping, Karyon deterministically extracts the codebase's true topology. The deterministic perception cell is instantiated through a Rust Native Implemented Function (NIF) bound to an Elixir Actor process. At its core, the cell utilizes Tree-sitter, an incremental parsing system that generates highly performant Abstract Syntax Trees (ASTs) in optimal logarithmic time [[8]](#ref-8).

1. **The Swarm Trigger:** When a directory-watcher cell detects a massive structural input (e.g., pointing Karyon at a new `/docs/src/` folder), it fires an ambient NATS signal: *"Massive structural input detected."*
2. **Cellular Activation:** Instantly, the Elixir Epigenetic Supervisor wakes up thousands of dormant Tree-sitter "Eye" cells. Each cell is assigned exactly one file from the repository.
3. **Microsecond Ingestion:** Across 128 virtual threads, these cells parse the codebase in parallel natively in Rust. Tree-sitter converts the raw ASCII string of a target file into an exact, microsecond-accurate AST.
4. **Topological Translation:** The cell traverses the AST, translating the deterministic syntax (e.g., `Class -> Method -> Variable`) into topological graph commands.

This hybrid architecture, known as the "Endurance Stack," delegates high-level system concurrency and supervision to the Erlang/Elixir BEAM virtual machine, while pushing raw CPU-intensive computational work down to Rust via NIFs [[9]](#ref-9). To prevent a long-running synchronous NIF from blocking the BEAM scheduler's strict 2,000-reduction limit, tasks are seamlessly routed to Dirty Schedulers, ensuring the main Elixir supervisors remain perfectly responsive [[10]](#ref-10).

## The Engineering Reality

The computational reality of this process is not bound by GPU VRAM, but entirely by CPU context-switching and lock-free memory contention.

While Tree-sitter requires almost zero CPU and no VRAM to parse a file, forcing parallel actors to rapidly flush their generated AST nodes into a shared graph creates an immense I/O blast radius. A 100,000-line codebase converted into an AST graph can spawn millions of distinct edges. Real-world codebases naturally follow a power-law degree distribution, where a small number of core utility files act as "super nodes" holding tens of thousands of relationships [[11]](#ref-11).

If Karyon's Rust routines attempt to lock the graph during ingestion using traditional Two-Phase Locking (2PL), they cause severe lock contention. These "Mammoth Transactions" force the Cytoplasm environment to stall, suffocating active reasoning cells and plunging analytical throughput [[12]](#ref-12).

### Multi-Version Concurrency Control (MVCC) Optimizations

To mitigate this system stalling, Karyon abandons single-version pessimistic locking in favor of Multi-Version Concurrency Control (MVCC). Under MVCC, the Memgraph ingestion utilizes rigorous copy-on-write semantics. The database creates new versions of affected subgraphs with monotonically increasing timestamps, rather than acquiring exclusive locks on existing data [[13]](#ref-13).

This allows the organism to "blink"—taking in a vast visual snapshot of the repository, parsing it concurrently, and committing the topological representation to working memory without blocking the background active inference loops. By employing advanced decoupled designs like vertex-group MVCC and adaptive delta-chains, writers append localized updates independently, guaranteeing that analytical readers never block deterministic writers [[14]](#ref-14) [[15]](#ref-15).

***

## Summary

To interact safely with a complex codebase, an autonomous agent must possess an absolute, deterministic map of its architecture. By utilizing Rust-backed Tree-sitter NIFs acting as "Eyes," Karyon instantaneously converts source code into an exact topological graph, avoiding the crippling hallucinations inherent to Large Language Models and ensuring the reasoning core operates on mathematical fact.

***

## References

1. <a id="ref-1"></a>Boudourides, M. (2026). *Structural Hallucination in Large Language Models: A Network-Based Evaluation of Knowledge Organization and Citation Integrity*. arXiv. [https://arxiv.org/abs/2603.01341](https://arxiv.org/abs/2603.01341)
2. <a id="ref-2"></a>Jimenez, C. E., et al. (2024). *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?*. ICLR Proceedings. [https://proceedings.iclr.cc/paper\_files/paper/2024/file/edac78c3e300629acfe6cbe9ca88fb84-Paper-Conference.pdf](https://proceedings.iclr.cc/paper_files/paper/2024/file/edac78c3e300629acfe6cbe9ca88fb84-Paper-Conference.pdf)
3. <a id="ref-3"></a>Emergent Mind. (2026). *RepoReason: Repository-Level Code Reasoning*. [https://www.emergentmind.com/topics/reporeason](https://www.emergentmind.com/topics/reporeason)
4. <a id="ref-4"></a>Factory.ai. (2026). *The Context Window Problem: Scaling Agents Beyond Token Limits*. [https://factory.ai/news/context-window-problem](https://factory.ai/news/context-window-problem)
5. <a id="ref-5"></a>Zhang, Z., et al. (2024). *LLM Hallucinations in Practical Code Generation: Phenomena, Mechanism, and Mitigation*. arXiv. [https://arxiv.org/html/2409.20550v1](https://arxiv.org/html/2409.20550v1)
6. <a id="ref-6"></a>Spracklen, J., et al. (2025). *We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs*. USENIX Security Symposium. [https://www.usenix.org/system/files/conference/usenixsecurity25/sec25cycle1-prepub-742-spracklen.pdf](https://www.usenix.org/system/files/conference/usenixsecurity25/sec25cycle1-prepub-742-spracklen.pdf)
7. <a id="ref-7"></a>Socket.dev. (2026). *The Rise of Slopsquatting: How AI Hallucinations Are Fueling a New Class of Supply Chain Attacks*. [https://socket.dev/blog/slopsquatting-how-ai-hallucinations-are-fueling-a-new-class-of-supply-chain-attacks](https://socket.dev/blog/slopsquatting-how-ai-hallucinations-are-fueling-a-new-class-of-supply-chain-attacks)
8. <a id="ref-8"></a>Wagner, T. A., & Graham, S. L. (2000). *Efficient and Flexible Incremental Parsing*. ACM Transactions on Programming Languages and Systems. [https://www.researchgate.net/publication/2377179\_Efficient\_and\_Flexible\_Incremental\_Parsing](https://www.researchgate.net/publication/2377179_Efficient_and_Flexible_Incremental_Parsing)
9. <a id="ref-9"></a>Anonymous. (2026). *Elixir + Rust = Endurance Stack? Curious if anyone here is exploring this combo*. Reddit. [https://www.reddit.com/r/rust/comments/1nblpf5/elixir\_rust\_endurance\_stack\_curious\_if\_anyone/](https://www.reddit.com/r/rust/comments/1nblpf5/elixir_rust_endurance_stack_curious_if_anyone/)
10. <a id="ref-10"></a>Anonymous. (2025). *Elixir and Rust is a good mix*. Hacker News. [https://news.ycombinator.com/item?id=35559925](https://news.ycombinator.com/item?id=35559925)
11. <a id="ref-11"></a>Allen, D. (2026). *Graph Modeling: All About Super Nodes*. Medium. [https://medium.com/neo4j/graph-modeling-all-about-super-nodes-d6ad7e11015b](https://medium.com/neo4j/graph-modeling-all-about-super-nodes-d6ad7e11015b)
12. <a id="ref-12"></a>Theodorakis, G., et al. (2025). *TuskFlow: An Efficient Graph Database for Long-Running Transactions*. Proceedings of the VLDB Endowment. [https://www.vldb.org/pvldb/vol18/p4777-theodorakis.pdf](https://www.vldb.org/pvldb/vol18/p4777-theodorakis.pdf)
13. <a id="ref-13"></a>CelerData. (2026). *Multiversion Concurrency Control (MVCC): A Practical Deep Dive*. [https://celerdata.com/glossary/multiversion-concurrency-control](https://celerdata.com/glossary/multiversion-concurrency-control)
14. <a id="ref-14"></a>Anonymous. (2025). *RapidStore: An Efficient Dynamic Graph Storage System for Concurrent Queries*. arXiv. [https://arxiv.org/pdf/2507.00839](https://arxiv.org/pdf/2507.00839)
15. <a id="ref-15"></a>Zhou, L., et al. (2025). *GTX: A Write-Optimized Latch-free Graph Data System with Transactional Support*. arXiv. [https://arxiv.org/html/2405.01418v2](https://arxiv.org/html/2405.01418v2)
