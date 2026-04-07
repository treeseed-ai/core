---
title: "Execution Telemetry"
---

## Introduction

Learning is fundamentally a process of trial and error, guided by survival-based feedback. For Karyon, this feedback manifests as execution telemetry—a precise digital signal that informs the system whether its architectural hypotheses are functionally sound or mathematically flawed.

## Biological Heuristics and Deterministic AI Feedback

In standard biological organism training, pain is the fundamental heuristic. The immediate, deterministic experience of environmental failure drives synaptic pruning, physically severing the internal neural pathways responsible for the mistake. If a toddler touches a hot stove, the nervous system bypasses higher-order logic entirely to fire an immediate failure signal [[1]](#ref-1).

In computational neuroscience and reinforcement learning (RL), biological brains are evolutionarily hardwired to interpret such homeostatic deviations as primary negative reinforcement signals. However, for a cellular AI architecture, the equivalent of physical pain is **Execution Telemetry**. In this context, the concept of "pain" is completely devoid of affective or conscious experience; rather, it is conceptualized strictly as a highly rigorous, functional precision signal that enforces rapid policy adaptation, behavioral inhibition, and internal model correction [[1]](#ref-1).

Without a deterministic penalty heuristic to act as an immediate behavioral inhibitor, continuous-learning agents are highly susceptible to severe operational failures. Empirical literature indicates that agents frequently suffer from "planner infinite loops," a failure mode where an agent continuously writes the same procedural checklist without reaching a terminal state, as well as "memory bloat" resulting from ingesting observational data without structural penalization [[2]](#ref-2). Just as biological pain signals an organism to cease tissue-damaging behavior, a deterministic execution error—such as a deep stack trace or a compiler rejection—acts as an absolute boundary condition, forcing the AI agent to abandon an invalid logic branch and actively backtrack [[3]](#ref-3).

## CI/CD Sandboxes as Reinforcement Environments

Because a cellular AI is not attempting to predict a sequence of linguistic tokens through gradient descent, it cannot learn anything from the static loss functions that train conversational Transformers. Instead, the AI learns by planning an action across its topological memory graph, executing that action as motor output within an isolated environment, and monitoring the resulting state change through continuous telemetry streams.

### Repositories as Ground-Truth Simulators

The environment must be highly controlled to ensure the signal is immediate and undeniable. The primary execution environment is the **Continuous Integration / Continuous Deployment (CI/CD) Sandbox**. When an execution cell formulates an architectural change—whether rewriting an API endpoint or refactoring a dependency module—it does not output text to a user prompt. Instead, it writes a `.patch` file, modifies the actual codebase locally within the VM, and triggers the CI/CD pipeline (e.g., executing `cargo test` in Rust or `mix test` in Elixir).

To harness the power of deterministic feedback signals, contemporary research increasingly conceptualizes remote software repositories and testing frameworks as structured, high-fidelity reinforcement learning simulators, operating analogously to robotic physics engines [[4]](#ref-4). Unlike synthetic benchmarks that rely on fragile human-crafted reward functions, CI/CD pipelines offer natural, mathematically sound reward and penalty signals [[4]](#ref-4). Testing frameworks like PyTest or JUnit provide varying levels of granularity necessary for continuous online learning, ranging from binary pass/fail feedback to highly detailed memory profiling [[5]](#ref-5).

Despite the absolute determinism of CI/CD pipelines, integrating autonomous agents introduces distinct theoretical and operational challenges due to agent nondeterminism. Traditional automated tests are designed for specific, human-written outputs, making them fragile when an agent achieves a mathematically equivalent but syntactically distinct algorithmic path [[7]](#ref-7). To resolve this friction, cutting-edge architectures deploy a multi-stage approach to execution guidance, dynamically incorporating execution signals directly into the inference process [[6]](#ref-6).

## Prediction Error Generation and Active Inference

The critical element of Execution Telemetry is not merely seeing a test fail; it is the mathematical generation of a **Prediction Error**. This deterministic feedback loop is deeply grounded in the frameworks of predictive coding and active inference [[9]](#ref-9).

### The Four-Step Prediction Error Mechanism

Under the Free Energy Principle (FEP), intelligent systems resist systemic entropy by continuously updating their internal generative models to minimize "surprise" or variational free energy [[9]](#ref-9). In a cellular AI architecture, this mechanism manifests through a highly precise, cyclical sequence:

1. **Prior Belief Formulation (Formulating the State Transition):** Before generating code, active cells map out their intent on the graph as an explicit internal belief. They trace an expectation: *"If I modify `module A` to pass parameter `X`, then `module B` should successfully compile, and Test Case 42 should pass."*
2. **Action Execution:** The agent synthesizes the code and commits it to the CI/CD compiler sandbox, effectively engaging its "motor reflex arcs" to act upon the environment [[10]](#ref-10).
3. **Sensory Ingestion (Validation Check):** The telemetry cells (listening purely to standard out, error logs, and exit codes) ingest the execution data. If they receive an exit code of `0`, the internal prediction error is zero, and optimization daemons instantly strengthen the graph edges utilized to make that conceptual leap.
4. **Failure Propagation (Error Minimization):** If the CI/CD pipeline throws a compiler error, the actual sensory input fundamentally diverges from the agent's prediction [[10]](#ref-10). Because the absolute rules of the compiler cannot be altered by the agent, it cannot hallucinate a functional outcome; it must minimize this massive prediction error by updating its internal logic models [[10]](#ref-10).

### Validating State Transitions

Active inference mathematically dictates that an agent must select the behavioral policy that minimizes Expected Free Energy (EFE), balancing pragmatic (instrumental) value with epistemic (information-seeking) value [[11]](#ref-11). When deployed into a novel or undocumented architecture, the agent gathers rich execution telemetry by deliberately testing boundary conditions—seeking epistemic value [[11]](#ref-11).

When an agent executes code, it proposes a state transition. These transitions are increasingly modeled using Partially Observable Markov Decision Processes (POMDPs) over the hidden states of the environmental architecture [[12]](#ref-12). Frameworks utilizing State Transition Validation Protocols ensure these transitions are valid and cryptographically verifiable [[8]](#ref-8). If a compiler execution trace reveals that the generated code bypassed a required logic node, the resulting prediction error propagates upward through the agent's hierarchical layers, forcing an immediate hypothesis revision [[10]](#ref-10).

## Offline Pruning and Temporal Graph Optimization (The "Sleep Cycle")

While active inference enables an agent to iteratively navigate and debug code during its operational "wake" state, continuous online learning generates immense amounts of noisy, contradictory execution telemetry. If an agent continuously appends every failed compiler trace to its active state, it will inevitably suffer from context degradation and unbounded memory bloat [[2]](#ref-2). To resolve this fundamental bottleneck, state-of-the-art architectures mimic biological memory consolidation through asynchronous, offline "sleep cycles" applied directly to topological memory graphs [[13]](#ref-13).

### Managing Delayed Telemetry and Synaptic Tagging

To prevent the destabilization of memory during active execution, advanced frameworks rely on processes inspired by Synaptic Tagging and Capture (STC) theories [[14]](#ref-14). During the active phase, the system does not immediately commit long-term weight changes to its knowledge graph; instead, it accumulates decaying "eligibility traces" that bridge the temporal gap between local actions and delayed global reward signals (such as a multi-stage pipeline taking 15 minutes to return feedback) [[14]](#ref-14). This "Tag-Gate-Capture" mechanism allows the agent to ingest high-speed telemetry without blocking the runtime [[14]](#ref-14).

### NREM Consolidation and Bitemporal Auditing in XTDB

When a prediction error occurs during overnight execution runs, the background optimization daemon flags the exact edges in the temporal graph responsible for the decision. During the offline analysis state—analogous to Non-Rapid Eye Movement (NREM) sleep—external environmental inputs are completely removed [[14]](#ref-14).

This offline phase acts as a centralized stability controller where dynamic graph pruning takes place. Redundant paths and failed code snippets are mathematically penalized via weight decay [[14]](#ref-14). Studies on network reasoning indicate that if an agent undergoes continuous fine-tuning without structured consolidation, it rapidly experiences "microscopic severing," where critical logic bridges are inadvertently fractured by overlapping updates [[15]](#ref-15).

Graph databases are essential for this consolidation. Memgraph enables execution-time dynamic pruning, allowing the planner to optimize query execution paths by eliminating irrelevant partitions of the graph [[17]](#ref-17). However, XTDB provides a more advanced bitemporal schema—tracking both "valid time" (when a software state transitioned) and "transaction time" (when the agent processed the fact) [[16]](#ref-16). During the sleep cycle, the agent performs complex time-travel queries to audit historical changes, identifying exactly when a specific logic branch drifted into an error state [[18]](#ref-18). The background daemon mathematically severs invalid logic paths while heavily reinforcing successfully compiled trajectories, preserving cognitive integrity via MVCC (Multi-Version Concurrency Control) pointers.

This brutal, offline feedback loop allows the system to run millions of simulated combinations in its air-gapped sandbox overnight, aggressively exploring the design space and organically pruning broken abstractions until the architectural graph perfectly reflects reality. Execution Telemetry creates the physics engine that forces the model out of structural hallucination and into rigorous engineering logic.

## Summary

Execution Telemetry acts as the functional pain receptor of the Karyon organism. By actively testing hypotheses within CI/CD sandboxes and ingesting compiler deterministic errors, the AI aggressively prunes structurally invalid graph pathways during offline sleep cycles, forcing its generative models to align with verified physical execution constraints.

***

## References

1. <a id="ref-1"></a>PMC. (2007). *Success-efficient/failure-safe strategy for hierarchical reinforcement motor learning*. [https://pmc.ncbi.nlm.nih.gov/articles/PMC12121909/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12121909/)
2. <a id="ref-2"></a>Galileo. (2025). *How to Debug AI Agents: 10 Failure Modes + Fixes*. [https://galileo.ai/blog/debug-ai-agents](https://galileo.ai/blog/debug-ai-agents)
3. <a id="ref-3"></a>MDPI. (2025). *Improving the Efficiency of Collaboration Between Humans and Embodied AI Agents in 3D Virtual Environments*. [https://www.mdpi.com/2076-3417/16/2/1135](https://www.mdpi.com/2076-3417/16/2/1135)
4. <a id="ref-4"></a>arXiv.org. (2025). *The Rise of AI Teammates in Software Engineering (SE) 3.0: How Autonomous Coding Agents Are Reshaping Software Engineering*. [https://arxiv.org/html/2507.15003v1](https://arxiv.org/html/2507.15003v1)
5. <a id="ref-5"></a>arXiv. (2025). *A Survey of Vibe Coding with Large Language Models*. [https://arxiv.org/html/2510.12399v1](https://arxiv.org/html/2510.12399v1)
6. <a id="ref-6"></a>NeurIPS. (2025). *Track: San Diego Poster Session 1*. [https://neurips.cc/virtual/2025/loc/san-diego/session/128331](https://neurips.cc/virtual/2025/loc/san-diego/session/128331)
7. <a id="ref-7"></a>arXiv. (2025). *Measuring Agents in Production*. [https://arxiv.org/html/2512.04123v1](https://arxiv.org/html/2512.04123v1)
8. <a id="ref-8"></a>arXiv. (2025). *BlockA2A: Towards Secure and Verifiable Agent-to-Agent Interoperability Position Paper*. [https://arxiv.org/html/2508.01332v3](https://arxiv.org/html/2508.01332v3)
9. <a id="ref-9"></a>Journal of NeuroPhilosophy. (2025). *View of Predictive Processing and Active Inference: A Comprehensive Review of Theoretical Foundations*. [https://www.jneurophilosophy.com/index.php/jnp/article/view/225/275](https://www.jneurophilosophy.com/index.php/jnp/article/view/225/275)
10. <a id="ref-10"></a>The Royal Society. (2016). *Top-down models in biology: explanation and control of complex living systems above the molecular level*. [https://royalsocietypublishing.org/rsif/article/13/124/20160555/35587/Top-down-models-in-biology-explanation-and-control](https://royalsocietypublishing.org/rsif/article/13/124/20160555/35587/Top-down-models-in-biology-explanation-and-control)
11. <a id="ref-11"></a>ResearchGate. (2025). *Curiosity is Knowledge: Self-Consistent Learning and No-Regret Optimization with Active Inference*. [https://www.researchgate.net/publication/400505762\_Curiosity\_is\_Knowledge\_Self-Consistent\_Learning\_and\_No-Regret\_Optimization\_with\_Active\_Inference](https://www.researchgate.net/publication/400505762_Curiosity_is_Knowledge_Self-Consistent_Learning_and_No-Regret_Optimization_with_Active_Inference)
12. <a id="ref-12"></a>MDPI. (2025). *Introducing ActiveInference.jl: A Julia Library for Simulation and Parameter Estimation with Active Inference Models*. [https://www.mdpi.com/1099-4300/27/1/62](https://www.mdpi.com/1099-4300/27/1/62)
13. <a id="ref-13"></a>Reddit. (2025). *I implemented "Sleep Cycles" (async graph consolidation) on top of pgvector to fix RAG context loss*. [https://www.reddit.com/r/AIMemory/comments/1pou4rg/i\_implemented\_sleep\_cycles\_async\_graph/](https://www.reddit.com/r/AIMemory/comments/1pou4rg/i_implemented_sleep_cycles_async_graph/)
14. <a id="ref-14"></a>arXiv. (2026). *\[2601.04362] Phasor Agents: Oscillatory Graphs with Three-Factor Plasticity and Sleep-Staged Learning*. [https://arxiv.org/abs/2601.04362](https://arxiv.org/abs/2601.04362)
15. <a id="ref-15"></a>arXiv. (2025). *How LLMs Learn to Reason: A Complex Network Perspective*. [https://arxiv.org/html/2509.23629v1](https://arxiv.org/html/2509.23629v1)
16. <a id="ref-16"></a>Sigarra. (2025). *Towards versioning profiles through time: A database benchmark*. [https://sigarra.up.pt/feup/pt/pub\_geral.show\_file?pi\_doc\_id=485372](https://sigarra.up.pt/feup/pt/pub_geral.show_file?pi_doc_id=485372)
17. <a id="ref-17"></a>Andrew Baker. (2025). *Category: Databases - Andrew Baker's Technology Blog Posts*. [https://andrewbaker.ninja/category/databases/](https://andrewbaker.ninja/category/databases/)
18. <a id="ref-18"></a>SourceForge. (2025). *Best Data Management Software for Apache Kafka*. [https://sourceforge.net/software/data-management/integrates-with-apache-kafka/?page=4](https://sourceforge.net/software/data-management/integrates-with-apache-kafka/?page=4)
