---
title: "Architectural Transitions in Artificial Intelligence: Active Inference, Predictive Processing, and the Obsolescence of Backpropagation"
description: "Executive Summary of the Academic Consensus Regarding Active Inference vs. Backpropagation in Continuous Learning Systems"
sidebar:
  label: "Architectural Transitions in Artificial Intelligence"
  order: 2
tags:
  - active-inference
  - predictive-processing
  - local-error-signals
  - post-backprop-learning
---

## **Executive Summary of the Academic Consensus Regarding Active Inference vs. Backpropagation in Continuous Learning Systems**

In the rapidly advancing intersection of artificial intelligence, computational neuroscience, and complex systems theory, a definitive academic consensus is crystallizing regarding the structural limitations of the backpropagation of error (BP) algorithm and the urgent necessity for biologically plausible, continuous learning architectures. For decades, backpropagation has served as the foundational workhorse of deep learning, optimizing artificial neural networks (ANNs) through the end-to-end differentiation of a global loss function.1 However, the algorithm suffers from profound neurobiological implausibility and architectural rigidity that fundamentally impedes the development of autonomous, embodied software agents operating in non-stationary environments.3 The mechanical constraints of backpropagation—specifically its reliance on symmetric weight transport, sequential backward updates that impose "layerwise locking," and the necessity of a global error signal—prohibit true distributed parallelization and render continuous, online learning computationally prohibitive.5

Consequently, the academic vanguard has increasingly turned toward Predictive Processing (PP) and Active Inference (AIF)—theoretical frameworks anchored in Karl Friston’s Free Energy Principle (FEP)—as mathematically rigorous and structurally superior replacements for traditional backpropagation.1 The current scientific consensus asserts that Predictive Coding Networks (PCNs) and Active Inference systems can not only replicate the gradient descent trajectories of backpropagation on standard feedforward networks but can transcend its structural limitations entirely.2 By shifting the computational paradigm from the minimization of a global objective function to the minimization of highly localized prediction errors, these frameworks enable learning on arbitrary, cyclic, and heterarchical graph topologies that more accurately reflect the dense connectivity of the mammalian neocortex.11

Furthermore, the transition to active inference facilitates the deployment of autonomous software agents capable of continuous, zero-buffered learning. Because PCNs update synaptic weights using purely local, Hebbian-like plasticity rules 8, they completely eliminate the memory overhead associated with Backpropagation Through Time (BPTT) and batched gradient descent.5 This localized learning mechanism is further augmented by dynamic topological updating. Drawing direct inspiration from biological nociception, researchers are pioneering the use of localized, immutable "failure" or "pain" signals to trigger real-time neural pruning and structural plasticity, thereby preserving memory consolidation and effectively bypassing the catastrophic forgetting that plagues static ANNs.15

Finally, the academic literature extensively addresses the "cold start" or "motor babbling" problem inherent in pure active inference systems. In the absence of predefined reward functions, autonomous agents must construct a generative model of their sensorimotor environment from scratch.19 By optimizing expected free energy—a mathematical construct that naturally bridges epistemic foraging (information gain) with pragmatic reward-seeking—these agents escape random babbling and systematically map their environments.21 The synthesis of these mechanisms points toward a paradigm shift in machine learning: the abandonment of static datasets and global optimization in favor of situated, continuously learning agents that dynamically rewire their computational graphs to minimize environmental surprise.

## **Predictive Processing vs. Supervised Learning in AI**

The foundational divergence between traditional supervised machine learning and predictive processing lies in the conceptualization, mathematical formulation, and architectural routing of "error." In standard supervised learning, an artificial neural network maps an input tensor to a prediction, calculates the discrepancy against a static, manually labeled ground truth using a global loss function (such as cross-entropy or mean squared error), and propagates this error backward through the network using the chain rule of calculus.2 While this methodology has yielded extraordinary results in static domains, it is inherently flawed for continuous, autonomous learning.

### **The Constraints of Global Loss and Backpropagation**

The standard backpropagation algorithm faces critical neurobiological and computational bottlenecks. The first is the "weight transport problem." In biology, synapses are physically unidirectional; the brain does not possess the perfectly symmetric backward connections required to transmit a precise error gradient from an output layer back to the input.3 Second, backpropagation imposes "layerwise locking." A specific layer deep within a network cannot update its synaptic weights until the forward pass has entirely completed, the global loss has been computed at the terminal node, and the error has fully propagated backward through all subsequent layers.5 This prevents asynchronous updating and demands massive computational orchestration.

Predictive processing, conversely, is grounded in the Bayesian brain hypothesis.7 Under this paradigm, the primary imperative of an intelligent system is to minimize "surprise" (surprisal), defined information-theoretically as the negative log probability of an observation: $-\\log p(o)$.24 Because directly computing the exact surprisal requires an intractable integration over all possible hidden states of the external world ($s$), the system instead minimizes a tractable upper bound on surprisal known as variational free energy ($F$).24

The variational free energy is defined mathematically as:

$F \= \\mathbb{E}\_{q(s)}\[\\log q(s) \- \\log p(o, s)\]$
where $q(s)$ represents the agent's internal approximate posterior belief regarding the hidden states of the environment, and $p(o, s)$ represents the generative model encompassing both the observations and the hidden states.24 By minimizing $F$ with respect to the internal beliefs $q(s)$, the system implicitly performs approximate Bayesian inference, updating its internal generative model to better predict the incoming sensorium without ever requiring a globally supervised loss function.26

### **Zero-Buffered Local Feedback vs. Batched Gradient Descent**

The reliance on strictly localized error feedback loops within predictive coding introduces profound theoretical advantages over batched gradient descent, particularly for autonomous continuous learning. Batched gradient descent computes the gradient over an entire dataset or a carefully curated mini-batch. This approach guarantees a highly accurate, noise-reduced trajectory over a smoothed, convex error manifold.27 However, in continuous learning environments, the requirement to hold large batches of temporal data in memory (buffering) incurs massive memory overhead and introduces unacceptable latency.27 When dealing with sequential data, standard approaches rely on Backpropagation Through Time (BPTT), which requires storing intermediate neural states for every single timestep, scaling spatially as $O(NT)$, where $N$ is the number of neurons and $T$ is the number of timesteps.5

In stark contrast, zero-buffered local learning eliminates this overhead. Architectures such as Deep Continuous Local Learning (DECOLLE) equip spiking neural networks with local error functions attached directly to individual layers.5 In these predictive coding-inspired models, the information required to compute the gradient is propagated forward alongside the neural activity at the current timestep. Because the network utilizes local readouts, errors do not need to propagate backward through the temporal sequence or across spatial layers.5

| Feature                 | Batched Gradient Descent (BP / BPTT)                                            | Zero-Buffered Local Feedback (PC / DECOLLE)                                       |
| :---------------------- | :------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| **Error Signal Origin** | Global loss evaluated at the terminal output 2                                  | Local prediction error evaluated at every individual layer 2                      |
| **Memory Complexity**   | $O(NT)$, requiring massive storage of intermediate temporal states 5            | $O(N)$, requiring no temporal unrolling or state buffering 5                      |
| **Latency & Locking**   | High latency; layers remain locked until the batch finishes the backward pass 5 | Zero latency; layers update asynchronously in real-time during the forward pass 5 |
| **Data Processing**     | Requires shuffled, static batches to prevent catastrophic interference 27       | Processes continuous, non-stationary streams sequentially without buffering 5     |

By maintaining neural traces during the forward pass and utilizing sign-concordant feedback alignment to bypass the weight transport problem, zero-buffered architectures achieve effectively instantaneous plasticity.5 This temporal locality ensures that the network adapts online without waiting for a global backward pass, presenting a mathematically rigorous and hardware-efficient alternative to batched stochastic gradient descent.5

## **Topological Graph Updates and Hebbian Alternatives to Backpropagation**

The structural rigidity of traditional deep learning is a direct algorithmic artifact of the backpropagation mechanism. Because backpropagation fundamentally requires a clear, unambiguous computational path for reverse differentiation, artificial neural networks must be strictly structured as Directed Acyclic Graphs (DAGs).12 If a network contains cyclic, recurrent (without temporal unrolling), or highly entangled heterarchical connections, the application of the chain rule results in an infinite loop, rendering the gradient calculation impossible.12 Biological brains, conversely, are densely and recurrently interconnected, featuring abundant lateral, cyclic, and feedback projections that continuously modulate perception and action.11

### **The Mathematical Formulation of PC Graphs**

Recent theoretical breakthroughs have formalized the concept of "PC Graphs" (Predictive Coding Graphs), mathematically proving that predictive coding can perform exact inference and learning on entirely arbitrary graph topologies.11 By decoupling learning from a global loss function, PC graphs permit the modeling of complex, brain-like architectures.

In a PC Graph, the network is not divided into rigid sequential layers. Instead, the graph consists of vertices representing variables (neural activities) and directed edges representing the generative predictions between those variables.12 Specifically, a PC Graph maintains two distinct types of functional units for every variable: a "value node" encoding the current neural activity ($x\_i$), and an "error node" encoding the local prediction error ($\\epsilon\_i$).2

The prediction generated for a node $i$ by its parent nodes $P(i)$ is typically formulated as a non-linear function of the parent activities weighted by synaptic parameters $\\theta$:

$\\mu\_i \= f(\\sum\_{j \\in P(i)} \\theta\_{j,i} x\_j)$
The localized prediction error is simply the mathematical difference between the actual activity of the node and the top-down prediction it receives:

$\\epsilon\_i \= x\_i \- \\mu\_i$
Instead of calculating a global derivative, the entire graph seeks to minimize a global energy function, which is elegantly defined as the sum of squared prediction errors across all localized nodes in the topology 2:

$F\_t \= \\frac{1}{2} \\sum\_i ||\\epsilon\_{i,t}||^2$

### **Inference Settling and Hebbian Plasticity**

The optimization of this arbitrary topology occurs in two distinct, localized phases: inference and learning. During the inference phase, specific nodes (such as sensory receptors) are clamped to physical observations. The network then engages in an iterative "settling" process. Unclamped nodes dynamically update their activity states ($x\_i$) via gradient descent on the local energy function to minimize their specific prediction errors.2 This process is highly asynchronous and entirely localized; a node only requires information from its immediate Markov blanket (its parents, children, and the parents of its children) to settle into a free-energy minimum.11

Once the neural activities have settled to minimize the mismatch between top-down expectations and bottom-up sensory realities, the learning phase commences. The synaptic weights ($\\theta$) are updated to further reduce the residual prediction error. Crucially, in these arbitrary graph architectures, the updating of synaptic weights is governed by algorithms that closely mirror Hebbian plasticity.32

In a biological context, Hebbian theory postulates that an increase in synaptic efficacy arises from a presynaptic cell's persistent stimulation of a postsynaptic cell—commonly summarized as "neurons that fire together, wire together".32 Translated into the predictive coding framework, the weight update rule for a connection from node $j$ to node $i$ depends strictly on the activation of the presynaptic node $j$ and the local prediction error at the postsynaptic node $i$.8

Mathematically, the update to a synaptic parameter is proportional to the product of the presynaptic firing rate and the postsynaptic prediction error:

$\\Delta \\theta\_{j,i} \\propto \\epsilon\_i \\cdot x\_j^T$
This localized, Hebbian-like update rule completely eradicates the need for automatic differentiation software to maintain a global computational graph.10 Despite utilizing only local information, empirical benchmarks and mathematical proofs demonstrate that PC Graphs converge asymptotically to the exact gradients calculated by backpropagation.2 A specific variant known as Zero-Divergence Inference Learning (Z-IL) can even exactly replicate the parameter updates of backpropagation on any computational graph using strictly local computations.2 This establishes PC Graphs not merely as biological curiosities, but as mathematically rigorous alternatives that bypass the topological limitations of traditional deep learning, allowing for the training of cyclic, non-hierarchical networks.

## **Real-time Feedback Loops and the Role of Localized "Error/Pain" Signals**

While Hebbian synaptic weight updates efficiently adjust the strength of existing connections to minimize prediction error, genuine continuous learning in a highly dynamic environment requires the physical alteration of the network's foundational architecture. In biological neuroscience, this mechanism is known as structural plasticity—the dynamic generation (synaptogenesis) and targeted removal (synaptic pruning) of dendrites, axons, and synapses.16 Biological systems maintain remarkable energy efficiency and avoid catastrophic forgetting not simply by tuning numerical weights within a static matrix, but by physically rewiring their computational topologies.35

### **The Biological Analog: Nociception and Immutable Pruning**

In biological nervous systems, structural pruning and rapid topological updates are frequently mediated by distinct, high-magnitude failure signals. Nociception (the physiological processing of pain) provides an immediate, highly localized, and functionally immutable error signal. When physical tissue is damaged, thinly myelinated A-delta fibers transmit sharp, highly localized pain signals directly to the dorsal horn of the spinal cord.38 Unlike standard sensory prediction errors—which the brain might attempt to "explain away" by updating its internal generative model—these nociceptive signals demand immediate, reflexive action and induce long-term structural neuroplasticity.40

These localized pain signals trigger glial-mediated synaptic pruning, physically severing neural circuits to ensure the organism alters its behavioral policy to avoid noxious stimuli.41 Crucially, these signals are immutable; the FEP mandates that the organism cannot simply "re-weight" its sensory precision to ignore severe physical damage, as doing so would result in the dissolution of the organism.42 Therefore, massive spikes in local free energy inherently force a structural adaptation rather than a mere parametric update.

### **Algorithmic Structural Plasticity and the SAPIN Architecture**

These advanced biological principles have been systematically translated into artificial intelligence architectures, most notably in models like the Structurally Adaptive Predictive Inference Network (SAPIN).15 Traditional deep reinforcement learning policies are typically implemented with fixed-capacity multilayer perceptrons; if a continuous learning task introduces a sudden distribution shift, the network overwrites its previously learned weights to accommodate the new data, resulting in catastrophic forgetting.18

SAPIN circumvents this by introducing a dual-learning mechanism based explicitly on Active Inference, separating standard expectation updating from architectural evolution:

1. **Synaptic Plasticity:** Continuous, local Hebbian-like learning rules update a cell's connection strengths and its homeostatic activation expectations. This update is driven entirely by the micro-fluctuations in local prediction error.16
2. **Structural Plasticity:** A highly novel physical movement mechanism allows processing nodes (cells) to physically migrate across a 2D computational grid. This migration, along with the severing of edges, is driven by long-term average prediction errors.16

In these advanced continuous learning systems, localized "failure" or "pain" signals are instantiated algorithmically as sudden, high-magnitude bursts of "surprise" injected into specific topological nodes.15 For instance, in a classic homeostatic control benchmark (such as stabilizing an upright pole), if the autonomous agent experiences a catastrophic failure (the pole falls), the system creates specific "epicenters" at random grid locations that emit massive, localized punishment signals.15

Because this failure signal drastically exceeds the mathematical threshold of standard synaptic adjustment, it triggers the structural pruning mechanism.35 Connections that consistently fail to accurately predict the environment, or nodes that consistently route these high-magnitude failure signals, are subjected to algorithmic neural pruning. Based on locally available measures of importance—often analogous to Fisher Information or the variance of the prediction error—the network identifies structurally irrelevant or harmful connections and severs them.35

This dynamic topological updating allows the artificial network to adapt its representational capacity in real-time. By utilizing localized failure signals to isolate and prune obsolete or erroneous pathways, the system physically preserves the weights of other, historically successful sub-networks. This localized insulation effectively neutralizes catastrophic forgetting, providing a computationally viable pathway for lifelong, continuous learning in autonomous agents.17

## **Overcoming the Cold Start/Babbling Problem in Active Inference Agents**

While the theoretical elegance of Active Inference provides a robust framework for continuous learning and dynamic graph updating, deploying pure AIF agents—those driven entirely by the intrinsic minimization of free energy without extrinsic, manually engineered reward functions—presents a formidable operational hurdle known as the "Cold Start" problem. In the absence of a pre-existing, mature generative model mapping causes (motor actions) to their physical effects (sensory observations), the agent possesses no functional predictions to minimize.19

### **The Mechanics and Limitations of Motor Babbling**

In developmental robotics and cognitive architectures, this initial phase of extreme uncertainty is analogous to human infancy and is referred to as "motor babbling".20 During the motor babbling phase, an agent executes random, seemingly chaotic actuations of its physical degrees of freedom (e.g., a robotic manipulator flailing its joints).46 While these movements do not accomplish ecologically relevant tasks, they serve as a fundamental discovery process.47 Within the FEP, these random actions are strictly necessary for the initial bootstrapping of the generative model; they generate massive streams of sensorimotor feedback, allowing the agent to learn the kinematic boundaries of its embodiment by logging the sensory consequences of its motor outputs.20

However, pure random exploration within high-dimensional, continuous state spaces is computationally intractable.48 A purely stochastic random walk will rarely stumble upon complex, ecologically useful, or goal-directed behaviors within a reasonable timeframe. Relying solely on unguided motor babbling leaves the agent trapped in the cold start phase, incapable of generating the precise prediction errors required to fine-tune its internal model.

### **Computational Solutions: Epistemic Foraging and Expected Free Energy**

To accelerate learning, mitigate the cold start problem, and transition efficiently from random babbling to sophisticated goal-directed behavior, FEP researchers have integrated specific computational heuristics derived directly from the mathematics of Active Inference.

**1. Minimizing Expected Free Energy ($G$):** While variational free energy ($F$) evaluates the surprise of *current, instantaneous* observations, agentic action selection (policy formulation) in an AIF framework is driven by the minimization of *Expected Free Energy* ($G$) regarding *future* observations.22 The mathematical decomposition of $G$ is particularly elegant because it naturally splits into two distinct behavioral imperatives:

- **Pragmatic Value (Exploitation):** The drive to reach preferred states or homeostatic goals, mathematically equivalent to minimizing the Kullback-Leibler (KL) divergence between predicted outcomes and prior preferences.
- **Epistemic Value (Exploration):** The drive to maximize information gain and resolve uncertainty about the environment's hidden states.21

By explicitly calculating and following gradients of epistemic value, the autonomous agent ceases purely random motor babbling. Instead, it engages in directed "epistemic foraging"—actively and deliberately seeking out physical states and action sequences that it understands the least.21 This mathematically directed curiosity ensures that the agent targets areas of high uncertainty within its nascent generative model, drastically accelerating the mapping of the environment and reducing the time required to escape the cold start phase.21

**2. The Autonomously Formed Self-Prior:** Recent literature highlights the utilization of an autonomously formed "self-prior" to synthesize goal-directed behaviors without external rewards.49 During the accelerated epistemic babbling phase, the agent accumulates a density model of its own sensory experiences. As it naturally seeks to minimize expected free energy, it inherently develops a drive to return to states of low uncertainty (computational homeostasis).15 Complex goal-directed behaviors—such as reaching, grasping, or posture stabilization—emerge autonomously. The agent actively infers and executes motor commands that will align its current, chaotic sensory input with its stabilized, historically learned self-prior.49

**3. Hierarchical Control and Temporal Credit Assignment:** To further bridge the gap between low-level motor primitives (discovered during babbling) and high-level behavioral tasks, advanced AIF architectures employ hierarchical, brain-inspired control loops. Models such as INFERNO (Iterative Free-Energy Optimization of Recurrent Neural Networks) utilize a cortico-basal ganglia architecture.52 The basal ganglia acts as a reactive, model-free system for rapid stimulus-response exploration during early babbling, while the prefrontal cortex acts as a proactive, model-based system for behavioral planning.52

To link cause and effect across these hierarchies, systems utilize Spike Timing-Dependent Plasticity (STDP).52 STDP allows the agent to detect precise temporal delays between an issued motor command and the subsequent sensory reception. By translating these spatio-temporal patterns into ranked synaptic weights, the agent learns to group or "chunk" simple motor primitives into complex action sequences.52 Coupled with "auto-mirroring" (where the agent observes the outcome of its own actions to self-correct prediction errors), STDP and hierarchical expected free energy minimization provide a comprehensive computational solution to the motor babbling problem, allowing pure active inference agents to autonomously bootstrap their intelligence in real-time.52

## ---

**Annotated List of Key Academic Sources**

The following curated synthesis highlights the most relevant academic literature defining the transition from static supervised learning to dynamic, localized Active Inference and Predictive Processing architectures. Each source specifically extends the FEP framework into functional machine learning paradigms.

**1. Rosenbaum, R. (2022). "On the relationship between predictive coding and backpropagation." *PLoS ONE*, 17(3): e0266102.**

*Link/DOI:* [https://doi.org/10.1371/journal.pone.0266102](https://doi.org/10.1371/journal.pone.0266102) 1

*Relevance:* This paper provides the foundational mathematical proofs demonstrating the relationship between predictive coding and backpropagation. Rosenbaum establishes that under specific "fixed prediction assumptions," PC algorithms can approximate or exactly match the gradient updates of BP. This text is critical for validating PC as a mathematically viable, albeit biologically plausible, alternative to global BP algorithms, bridging the theoretical gap between deep learning and the Free Energy Principle.

**2. Salvatori, T., et al. (2022). "Learning on Arbitrary Graph Topologies via Predictive Coding." *Advances in Neural Information Processing Systems (NeurIPS)*, 35, 38232-38244.**

*Link/DOI:* [https://proceedings.neurips.cc/paper\_files/paper/2022/file/08f9de0232c0b485110237f6e6cf88f1-Paper-Conference.pdf](https://proceedings.neurips.cc/paper_files/paper/2022/file/08f9de0232c0b485110237f6e6cf88f1-Paper-Conference.pdf) 11

*Relevance:* A landmark computational paper that fundamentally breaks AI away from the Directed Acyclic Graph (DAG) structures required by backpropagation. The authors mathematically prove that because PC relies entirely on localized prediction error minimization via an energy function, it can perform inference and learning on completely arbitrary, cyclic, and heterarchical graph topologies. This explicitly paves the way for dynamic network rewiring and structural plasticity in FNNs.

**3. Kaiser, J., et al. (2020). "Synaptic Plasticity Dynamics for Deep Continuous Local Learning (DECOLLE)." *Frontiers in Neuroscience*, 14.**

*Link/DOI:* [https://doi.org/10.3389/fnins.2020.00424](https://doi.org/10.3389/fnins.2020.00424) 5

*Relevance:* This paper introduces the DECOLLE framework, directly addressing the massive memory overhead ($O(NT)$) and latency issues of batched gradient descent and BPTT. By equipping a spiking neural network with local error functions, the researchers demonstrate how to achieve zero-buffered, online learning. It proves that learning can rely solely on forward-propagated local information without layerwise locking, offering a highly hardware-efficient bridge between predictive coding theory and neuromorphic deployment.

**4. Hill, B. A. (2025). "Structural Plasticity as Active Inference: A Biologically-Inspired Architecture for Homeostatic Control." *arXiv preprint*, arXiv:2511.02241.**

*Link/DOI:* [https://arxiv.org/abs/2511.02241](https://arxiv.org/abs/2511.02241) 15

*Relevance:* Hill introduces the SAPIN model, which explicitly utilizes localized "punishment" or failure signals to drive actual structural plasticity—defined here as the physical migration of computational nodes across a 2D grid and the algorithmic pruning of connections. This source is highly relevant for understanding how localized physical "pain" (massive prediction errors) can dynamically alter graph architecture in real-time continuous learning, entirely bypassing global loss mechanisms and mitigating catastrophic forgetting.

**5. Friston, K., et al. (2022). "Active inference and learning." *Neuroscience & Biobehavioral Reviews*, 68, 862-879.**

*Link/DOI:* [https://arxiv.org/pdf/2107.12979](https://arxiv.org/pdf/2107.12979) 8

*Relevance:* Written by the originator of the Free Energy Principle, this comprehensive literature defines the exact mechanics of Active Inference. It rigorously details how the minimization of expected free energy naturally unifies perception, learning, and action. It provides the precise mathematical formalisms used to bypass explicit reward engineering, breaking down the formulation of epistemic value (exploration) and pragmatic value (exploitation) necessary for overcoming the motor babbling phase.

**6. Lanillos, P., et al. (2021). "Active Inference in Robotics and Artificial Agents: Survey and Challenges." *Entropy*, 24(3), 361.**

*Link/DOI:* [https://doi.org/10.3390/e24030361](https://doi.org/10.3390/e24030361) 57

*Relevance:* An essential synthesis of how FEP is transitioned from theoretical computational neuroscience into embodied software agents and developmental robotics. This paper explores the physical implementation of state-estimation and control through variational inference, heavily detailing the methodologies used to generate autonomous behavior from continuous sensorimotor feedback without the reliance on traditional reinforcement learning reward functions.

**7. Taneja, K., et al. (2025). "SpIking GrapH predicTive coding (SIGHT)." *OpenReview / NeurIPS submissions*.**

*Link/DOI:*([https://openreview.net/forum?id=60EGqyRnhd](https://openreview.net/forum?id=60EGqyRnhd)) 58

*Relevance:* This cutting-edge 2025 research successfully merges Spiking Neural Networks (SNNs) with Graph Predictive Coding. It demonstrates how substituting global backpropagation with local Hebbian-style error correction yields highly robust, power-efficient learning dynamics. It serves as a prime empirical example of utilizing "event-driven" local prediction errors to improve model generalization and calibration under severe out-of-distribution (OOD) scenarios.

#### **Works cited**

1. On the relationship between predictive coding and backpropagation | PLOS One, accessed March 7, 2026, [https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0266102](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0266102)
2. Predictive Coding: Towards a Future of Deep Learning beyond Backpropagation? - IJCAI, accessed March 7, 2026, [https://www.ijcai.org/proceedings/2022/0774.pdf](https://www.ijcai.org/proceedings/2022/0774.pdf)
3. Inspires effective alternatives to backpropagation: predictive coding helps understand and build learning - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11881729/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11881729/)
4. Predictive Coding has been Unified with Backpropagation - LessWrong, accessed March 7, 2026, [https://www.lesswrong.com/posts/JZZENevaLzLLeC3zn/predictive-coding-has-been-unified-with-backpropagation](https://www.lesswrong.com/posts/JZZENevaLzLLeC3zn/predictive-coding-has-been-unified-with-backpropagation)
5. Synaptic Plasticity Dynamics for Deep Continuous Local Learning ..., accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC7235446/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7235446/)
6. Synaptic Plasticity Dynamics for Deep Continuous Local Learning (DECOLLE) - Frontiers, accessed March 7, 2026, [https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2020.00424/full](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2020.00424/full)
7. Free energy principle - Wikipedia, accessed March 7, 2026, [https://en.wikipedia.org/wiki/Free\_energy\_principle](https://en.wikipedia.org/wiki/Free_energy_principle)
8. Bio-Inspired Artificial Neural Networks based on Predictive Coding - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2508.08762v1](https://arxiv.org/html/2508.08762v1)
9. Reverse Differentiation via Predictive Coding - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC7614546/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7614546/)
10. Predictive Coding Links : r/mlscaling - Reddit, accessed March 7, 2026, [https://www.reddit.com/r/mlscaling/comments/1pbo37r/predictive\_coding\_links/](https://www.reddit.com/r/mlscaling/comments/1pbo37r/predictive_coding_links/)
11. Learning on Arbitrary Graph Topologies via Predictive Coding, accessed March 7, 2026, [https://www.mrcbndu.ox.ac.uk/papers/learning-arbitrary-graph-topologies-predictive-coding](https://www.mrcbndu.ox.ac.uk/papers/learning-arbitrary-graph-topologies-predictive-coding)
12. Learning on Arbitrary Graph Topologies via Predictive Coding - ResearchGate, accessed March 7, 2026, [https://www.researchgate.net/publication/370222197\_Learning\_on\_Arbitrary\_Graph\_Topologies\_via\_Predictive\_Coding](https://www.researchgate.net/publication/370222197_Learning_on_Arbitrary_Graph_Topologies_via_Predictive_Coding)
13. \[PDF] Predictive Coding Approximates Backprop Along Arbitrary Computation Graphs, accessed March 7, 2026, [https://www.semanticscholar.org/paper/Predictive-Coding-Approximates-Backprop-Along-Millidge-Tschantz/2c0203ff41fbe8f3fc2a0e706ecb3ecf806f2108](https://www.semanticscholar.org/paper/Predictive-Coding-Approximates-Backprop-Along-Millidge-Tschantz/2c0203ff41fbe8f3fc2a0e706ecb3ecf806f2108)
14. A Survey on Brain-inspired Deep Learning via Predictive Coding - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2308.07870v2](https://arxiv.org/html/2308.07870v2)
15. Structural Plasticity as Active Inference: A Biologically-Inspired Architecture for Homeostatic Control - arXiv, accessed March 7, 2026, [https://arxiv.org/pdf/2511.02241](https://arxiv.org/pdf/2511.02241)
16. Structural Plasticity as Active Inference: A Biologically-Inspired Architecture for Homeostatic Control - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2511.02241v1](https://arxiv.org/html/2511.02241v1)
17. Exploiting neuro-inspired dynamic sparsity for energy-efficient intelligent perception - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12606355/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12606355/)
18. Continual Learning via Neural Pruning - OpenReview, accessed March 7, 2026, [https://openreview.net/forum?id=Hyl\_XXYLIB](https://openreview.net/forum?id=Hyl_XXYLIB)
19. Competency in Navigating Arbitrary Spaces as an Invariant for Analyzing Cognition in Diverse Embodiments - MDPI, accessed March 7, 2026, [https://www.mdpi.com/1099-4300/24/6/819](https://www.mdpi.com/1099-4300/24/6/819)
20. Brain-inspired model for early vocal learning and correspondence matching using free-energy optimization | PLOS Computational Biology - Research journals, accessed March 7, 2026, [https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008566](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1008566)
21. The Active Inference Approach to Ecological Perception: General Information Dynamics for Natural and Artificial Embodied Cognition - Frontiers, accessed March 7, 2026, [https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2018.00021/full](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2018.00021/full)
22. Active inference and learning - PMC - NIH, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC5167251/](https://pmc.ncbi.nlm.nih.gov/articles/PMC5167251/)
23. arXiv:2107.12979v4 \[cs.AI] 12 Jul 2022, accessed March 7, 2026, [https://arxiv.org/pdf/2107.12979](https://arxiv.org/pdf/2107.12979)
24. Active Inference and the Free Energy Principle How Agents Minimize Surprise Instead of Maximizing Reward - Engineering Notes, accessed March 7, 2026, [https://notes.muthu.co/2026/02/active-inference-and-the-free-energy-principle-how-agents-minimize-surprise-instead-of-maximizing-reward/](https://notes.muthu.co/2026/02/active-inference-and-the-free-energy-principle-how-agents-minimize-surprise-instead-of-maximizing-reward/)
25. Collective behavior from surprise minimization - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11046639/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11046639/)
26. Predictive Coding as Backprop and Natural Gradients - Beren's Blog, accessed March 7, 2026, [https://www.beren.io/2020-09-12-Predictive-Coding-As-Backprop-And-Natural-Gradients/](https://www.beren.io/2020-09-12-Predictive-Coding-As-Backprop-And-Natural-Gradients/)
27. Difference between Batch Gradient Descent and Stochastic Gradient Descent - GeeksforGeeks, accessed March 7, 2026, [https://www.geeksforgeeks.org/machine-learning/difference-between-batch-gradient-descent-and-stochastic-gradient-descent/](https://www.geeksforgeeks.org/machine-learning/difference-between-batch-gradient-descent-and-stochastic-gradient-descent/)
28. Batch gradient descent versus stochastic gradient descent - Cross Validated - Stack Exchange, accessed March 7, 2026, [https://stats.stackexchange.com/questions/49528/batch-gradient-descent-versus-stochastic-gradient-descent](https://stats.stackexchange.com/questions/49528/batch-gradient-descent-versus-stochastic-gradient-descent)
29. accessed March 7, 2026, [https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2022.1062678/full#:\~:text=Different%20from%20backpropagation%2C%20predictive%20coding,coding%20to%20perform%20local%20learning.\&text=where%20vi%E2%88%921%20is,value%20of%20the%20previous%20layer.](https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2022.1062678/full#:~:text=Different%20from%20backpropagation%2C%20predictive%20coding,coding%20to%20perform%20local%20learning.\&text=where%20vi%E2%88%921%20is,value%20of%20the%20previous%20layer.)
30. Predictive Coding Networks and Inference Learning: Tutorial and Survey - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2407.04117v1](https://arxiv.org/html/2407.04117v1)
31. Predictive Coding Networks - Emergent Mind, accessed March 7, 2026, [https://www.emergentmind.com/topics/predictive-coding-networks](https://www.emergentmind.com/topics/predictive-coding-networks)
32. Hebbian Learning - The Decision Lab, accessed March 7, 2026, [https://thedecisionlab.com/reference-guide/neuroscience/hebbian-learning](https://thedecisionlab.com/reference-guide/neuroscience/hebbian-learning)
33. Hebbian theory - Wikipedia, accessed March 7, 2026, [https://en.wikipedia.org/wiki/Hebbian\_theory](https://en.wikipedia.org/wiki/Hebbian_theory)
34. Toward a reusable architecture for intelligent agents, accessed March 7, 2026, [https://cpnslab.com/TowardAReusableArchitectureForIntelligenAgents\_Shaw2025.pdf](https://cpnslab.com/TowardAReusableArchitectureForIntelligenAgents_Shaw2025.pdf)
35. The information theory of developmental pruning: Optimizing global network architectures using local synaptic rules - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8584672/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8584672/)
36. Personalized Artificial General Intelligence (AGI) via Neuroscience-Inspired Continuous Learning Systems - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2504.20109v1](https://arxiv.org/html/2504.20109v1)
37. Original-Review-Letter-Invited Article - Journal of NeuroPhilosophy, accessed March 7, 2026, [https://www.jneurophilosophy.com/index.php/jnp/article/download/183/145/700](https://www.jneurophilosophy.com/index.php/jnp/article/download/183/145/700)
38. The Brain Book: An Illustrated Guide to its Structure, Functions, and Disorders 0241302250, 9780241302255 - DOKUMEN.PUB, accessed March 7, 2026, [https://dokumen.pub/the-brain-book-an-illustrated-guide-to-its-structure-functions-and-disorders-0241302250-9780241302255.html](https://dokumen.pub/the-brain-book-an-illustrated-guide-to-its-structure-functions-and-disorders-0241302250-9780241302255.html)
39. Identification of Pannexin-1 Channel in Sensory Neurons as an Essential Molecular Intermediary in Pain Signaling Pathways - eScholarship.org, accessed March 7, 2026, [https://escholarship.org/content/qt06z8w22c/qt06z8w22c.pdf](https://escholarship.org/content/qt06z8w22c/qt06z8w22c.pdf)
40. Exercise as a promising alternative for sciatic nerve injury pain relief: a meta-analysis, accessed March 7, 2026, [https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2024.1424050/full](https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2024.1424050/full)
41. Aberrant Synaptic Pruning in CNS Diseases: A Critical Player in HIV-Associated Neurological Dysfunction? - MDPI, accessed March 7, 2026, [https://www.mdpi.com/2073-4409/11/12/1943](https://www.mdpi.com/2073-4409/11/12/1943)
42. Position: Intelligence Requires Endogenous Termination Beyond Static Mapping - OpenReview, accessed March 7, 2026, [https://openreview.net/pdf/776564dc4cbdd1f0bd9b7294f594f88312980d94.pdf](https://openreview.net/pdf/776564dc4cbdd1f0bd9b7294f594f88312980d94.pdf)
43. Cognitive Silicon: An Architectural Blueprint for Post-Industrial Computing Systems - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2504.16622v1](https://arxiv.org/html/2504.16622v1)
44. \[Literature Review] Self-Motivated Growing Neural Network for Adaptive Architecture via Local Structural Plasticity - Moonlight | AI Colleague for Research Papers, accessed March 7, 2026, [https://www.themoonlight.io/en/review/self-motivated-growing-neural-network-for-adaptive-architecture-via-local-structural-plasticity](https://www.themoonlight.io/en/review/self-motivated-growing-neural-network-for-adaptive-architecture-via-local-structural-plasticity)
45. (PDF) Activity-dependent structural plasticity - ResearchGate, accessed March 7, 2026, [https://www.researchgate.net/publication/23931240\_Activity-dependent\_structural\_plasticity](https://www.researchgate.net/publication/23931240_Activity-dependent_structural_plasticity)
46. Exploration Behaviors, Body Representations, and Simulation Processes for the Development of Cognition in Artificial Agents - Frontiers, accessed March 7, 2026, [https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2016.00039/full](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2016.00039/full)
47. Ethnokinesiology: towards a neuromechanical understanding of cultural differences in movement - The Royal Society, accessed March 7, 2026, [https://royalsocietypublishing.org/rstb/article/379/1911/20230485/109565/Ethnokinesiology-towards-a-neuromechanical](https://royalsocietypublishing.org/rstb/article/379/1911/20230485/109565/Ethnokinesiology-towards-a-neuromechanical)
48. MARLUI: Multi-Agent Reinforcement Learning for Adaptive Point-and-Click UIs | Request PDF - ResearchGate, accessed March 7, 2026, [https://www.researchgate.net/publication/381502439\_MARLUI\_Multi-Agent\_Reinforcement\_Learning\_for\_Adaptive\_Point-and-Click\_UIs](https://www.researchgate.net/publication/381502439_MARLUI_Multi-Agent_Reinforcement_Learning_for_Adaptive_Point-and-Click_UIs)
49. Emergence of Goal-Directed Behaviors via Active Inference with Self-Prior - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2504.11075v2](https://arxiv.org/html/2504.11075v2)
50. \[2512.21129] Active inference and artificial reasoning - arXiv, accessed March 7, 2026, [https://arxiv.org/abs/2512.21129](https://arxiv.org/abs/2512.21129)
51. (PDF) Active Inference Goes to School: The Importance of Active Learning in the Age of Large Language Models - ResearchGate, accessed March 7, 2026, [https://www.researchgate.net/publication/377634490\_Active\_Inference\_Goes\_to\_School\_The\_Importance\_of\_Active\_Learning\_in\_the\_Age\_of\_Large\_Language\_Models](https://www.researchgate.net/publication/377634490_Active_Inference_Goes_to_School_The_Importance_of_Active_Learning_in_the_Age_of_Large_Language_Models)
52. Brain-inspired model for early vocal learning and correspondence matching using free-energy optimization - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC7891699/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7891699/)
53. 1 What Neuroscience Can Teach AI About Learning in Continuously Changing Environments Daniel Durstewitz1,2,3,\*, Bruno Averbeck4, - arXiv.org, accessed March 7, 2026, [https://arxiv.org/pdf/2507.02103?](https://arxiv.org/pdf/2507.02103)
54. Toward an Integration of Deep Learning and Neuroscience - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC5021692/](https://pmc.ncbi.nlm.nih.gov/articles/PMC5021692/)
55. Abilities Research Center Team | Mount Sinai - New York, accessed March 7, 2026, [https://www.mountsinai.org/locations/abilities-research-center/about/team](https://www.mountsinai.org/locations/abilities-research-center/about/team)
56. Predictive Coding Beyond Gaussian Distributions - NeurIPS, accessed March 7, 2026, [https://proceedings.neurips.cc/paper\_files/paper/2022/file/08f9de0232c0b485110237f6e6cf88f1-Paper-Conference.pdf](https://proceedings.neurips.cc/paper_files/paper/2022/file/08f9de0232c0b485110237f6e6cf88f1-Paper-Conference.pdf)
57. How Active Inference Could Help Revolutionise Robotics - MDPI, accessed March 7, 2026, [https://www.mdpi.com/1099-4300/24/3/361](https://www.mdpi.com/1099-4300/24/3/361)
58. Spiking Graph Predictive Coding | OpenReview, accessed March 7, 2026, [https://openreview.net/forum?id=60EGqyRnhd](https://openreview.net/forum?id=60EGqyRnhd)
