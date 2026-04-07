---
title: "The Paradigm Shift in Artificial Intelligence: From Stateless Autoregression to Stateful Predictive Processing"
description: "The current trajectory of artificial intelligence research is approaching a critical architectural and thermodynamic inflection point. This juncture is driven…"
sidebar:
  label: "The Paradigm Shift in Artificial Intelligence"
  order: 2
tags:
  - stateful-ai
  - predictive-processing
  - abstract-state-prediction
  - architecture-synthesis
---

## **Executive Summary**

The current trajectory of artificial intelligence research is approaching a critical architectural and thermodynamic inflection point. This juncture is driven by the increasingly apparent, unsustainable computational demands and fundamental theoretical limitations of standard supervised backpropagation and autoregressive token prediction. While large language models (LLMs) and dense, attention-based transformer architectures have achieved unprecedented empirical success over the past decade, the academic consensus increasingly recognizes these monolithic systems as transitional technologies rather than the ultimate substrate for artificial general intelligence. The prevailing paradigms—characterized by stateless operations, global loss gradients, and pixel-or-token-level reconstruction—are fundamentally bottlenecked by energy inefficiencies, poor continuous learning capabilities, and a distinct lack of grounded, stateful environmental interaction.

A robust and comprehensive synthesis of current academic literature indicates a definitive theoretical and architectural migration toward predictive processing, Active Inference, and non-autoregressive latent space frameworks. Active Inference, which is mathematically grounded in the Free Energy Principle (FEP), offers a first-principles approach to machine learning wherein systems act to minimize a unified Bayesian objective: expected free energy. This mechanism natively balances environmental exploration (epistemic value) and policy exploitation (pragmatic value), functioning without the brittle, externally engineered reward structures characteristic of traditional reinforcement learning paradigms. Simultaneously, predictive coding networks demonstrate that local prediction error minimization can approximate the gradient updates of backpropagation while utilizing biologically plausible, parallelizable local plasticity rules, thereby theoretically circumventing the Von Neumann bottleneck.

However, translating these theoretical frameworks into scalable artificial neural networks presents distinct operational challenges. While predictive coding theoretically eliminates the need for sequential forward and backward passes, deep predictive coding architectures frequently suffer from energy concentration and vanishing gradients in their deepest layers. This prevents them from scaling efficiently to compete with heavily optimized, deep transformer architectures on complex benchmarks.

To bridge this scalability gap, researchers are pioneering Joint Embedding Predictive Architectures (JEPA) and continuous state models. JEPAs abandon the computationally wasteful task of autoregressive pixel or token generation, opting instead to predict abstract semantic representations within continuous latent spaces. Empirical evidence demonstrates that these models—such as the Vision-Language JEPA (VL-JEPA)—achieve superior sample efficiency, dramatic reductions in inference latency, and robust environmental adaptability compared to dense autoregressive models.

Ultimately, these theoretical and algorithmic advancements necessitate a profound shift in computational infrastructure and deployment methodologies. The literature highlights a necessary transition from stateless, monolithic matrices to stateful, decentralized, "cellular" or actor-based continuous learning systems. By integrating local prediction error minimization with actor-model concurrency and Neural Cellular Automata (NCA), future AI architectures will support persistent memory, multi-agent cooperation, and localized structural plasticity. This synthesis delineates the pathway from static, token-predicting LLMs to dynamic, state-aware predictive architectures, forging a definitive path toward autonomous, energy-efficient machine intelligence.

## **The Limitations of Supervised Learning & Static Correctness in AI**

### **The Structural and Biological Bottlenecks of Backpropagation**

The foundational mechanism of modern deep learning, the error backpropagation algorithm, constructs an end-to-end optimization framework that computes the gradient of a global loss function with respect to every parameter in the network.1 Despite its undisputed role in enabling superhuman performance across diverse machine learning applications, backpropagation inherently contradicts the localized processing constraints required for physical energy efficiency, biological plausibility, and continuous cognitive adaptation.2

The academic community has identified several intrinsic vulnerabilities within backpropagation that fundamentally limit the development of advanced, autonomous artificial intelligence.4 Foremost among these is the heavily documented "weight transport problem." Backpropagation requires that error signals be propagated backward via a feedback pathway whose synaptic weights are precisely the transpose of the feedforward weights.3 This necessitates a rigid, mathematically symmetric architecture and non-local information transfer. There is no known biological mechanism that could ensure such perfect symmetry in living neural circuits, leading researchers to classify backpropagation as biologically implausible.3 Furthermore, this strict architectural requirement forces computation to rely on deterministic digital hardware that can precisely match forward and backward passes in a low-noise environment, as even minor fluctuations propagate numerical errors that destroy the model's convergence.6

Furthermore, backpropagation relies on an inescapable sequential dependency between network layers. Updating the features or synaptic weights in an early layer requires waiting for the propagation of error signals from the highest layers.7 This sequential forward-then-backward locking prevents asynchronous, concurrent parameter updates, rendering the algorithm inherently hostile to distributed, stateful hardware implementations such as neuromorphic chips or analog in-memory compute fabrics.7

From an operational and deployment standpoint, models trained via standard supervised backpropagation suffer acutely from catastrophic forgetting.2 Because stochastic gradient descent mathematically assumes that gradient samples originate from a stationary, independent and identically distributed (i.i.d.) dataset, incrementally updating the network with new information disrupts previously established weight configurations.4 Consequently, these models lack the structural plasticity and localized compartmentalization necessary for continuous, lifelong learning. They remain entirely static following their deployment unless subjected to phenomenally expensive and time-consuming stateless retraining cycles.9

### **The Fundamental Limits of the Autoregressive Paradigm**

Just as backpropagation restricts the physical implementation and temporal continuity of learning, the autoregressive (AR) paradigm—specifically next-token or next-pixel prediction—imposes strict functional limitations on machine reasoning and scalability. Modern dense transformers are effectively "token engines" optimized for System 1 cognition: fast, associative pattern completion lacking deliberate causal foresight.10 By processing and generating information sequentially, AR models incur massive computational overhead that scales poorly.

The sequential generation process creates a severe memory-bandwidth bottleneck, frequently referred to as the KV-cache bottleneck.10 For every single word or sub-word a model generates, the entirety of the model's weights must be loaded into the GPU VRAM from system memory to process the calculation, only to shift back to system memory. Because the actual arithmetic calculation takes significantly less time than the content transfer between memory layers, the silicon sits idle, wasting massive amounts of energy.12 In dense transformers, every parameter fires on every token, and every token attends to every other token, meaning that FLOPs scale quadratically with context length, rendering massive context reasoning practically unusable at the frontier without aggressive heuristic optimization.13

Moreover, autoregressive generation inherently accumulates error, a phenomenon that cripples long-horizon reasoning. At each sequential decoding step, the model samples from a probability distribution. If the model selects a statistically improbable or factually incorrect token—stepping off the "manifold of correctness"—the next step is permanently conditioned upon that localized mistake.10 Over long sequences, the statistical chance of remaining logically and physically coherent collapses. This structural reality manifests operationally as hallucinations, data brittleness, and a failure to maintain hard industrial constraints.14

The academic consensus suggests that treating text or pixel generation as the ultimate objective of intelligence is computationally extravagant and thermodynamically unsustainable.10 Systems strictly engineered to minimize cross-entropy reconstruction loss on surface-level data waste immense parameter capacity memorizing the stochastic, high-frequency noise of the environment. For instance, an autoregressive video model must perfectly predict the precise texture of a background wave or the specific grammatical syntax of a sentence, rather than extracting the invariant, causal mechanisms governing the scene.16 This fundamental objective mismatch highlights why AR models are superb at emulating human linguistic patterns but consistently fail at grounded, physics-based spatial planning and embodied control.14

## **Active Inference, Prediction Error, and World Models in Machine Learning**

### **Theoretical Foundations of the Free Energy Principle in ML**

To bypass the physical limitations of global backpropagation and the myopic constraints of autoregression, the academic community is increasingly integrating principles from computational neuroscience and theoretical biology—namely, the Free Energy Principle (FEP) and Active Inference (AIF)—directly into artificial neural network design.15

The FEP, pioneered by Karl Friston, is a mathematical framework positing that any adaptive, persistent system maintains its structural and functional integrity by minimizing a variational bound on sensory surprise.18 This bound is formalized as expected variational free energy, calculated under an internal generative model of the system's environment.18 Active Inference refines this principle by asserting that perception, planning, and action are not separate computational modules, but rather manifestations of a single, unified probabilistic inference problem.3

Under an Active Inference framework, agents do not passively receive data and output static predictions. Instead, they actively select policies (sequences of actions) that they calculate will minimize expected free energy in the future. This theoretical quantity decomposes elegantly into two distinct, competing behavioral imperatives that solve the traditional machine learning exploration-exploitation dilemma:

1. **Pragmatic Value (Exploitation):** The drive to reach preferred, expected sensory states, thereby minimizing the divergence between actual outcomes and goal states. This is akin to goal-seeking behavior.21
2. **Epistemic Value (Exploration):** The drive to reduce uncertainty about the hidden structure of the world model. This manifests as information-seeking behavior, artificial curiosity, or "Bayesian surprise," wherein the agent selects actions specifically to disambiguate among alternative hypotheses regarding its environment.21

By replacing externally engineered, scalar reward signals with an intrinsic, homeostatically derived drive to minimize free energy, Active Inference models function without the continuous human intervention required in Reinforcement Learning from Human Feedback (RLHF).15 This approach is intrinsically self-limiting, in contrast to the unbounded maximization of reward in standard reinforcement learning, effectively neutralizing the dangers of "reward hacking" because the definition of optimal behavior is relative to a generative model that evolves dynamically over time.23

### **Local Prediction Error Minimization as a Credit Assignment Mechanism**

A critical operationalization of Active Inference in machine learning is predictive coding (PC). Predictive coding describes a hierarchical neural architecture where each layer generates top-down predictions regarding the activity of the layer immediately below it.3 The incoming bottom-up sensory signals are compared against these predictions, and only the discrepancy—the prediction error—is propagated upward to refine the higher-level representations.3

This localized message-passing scheme offers a highly parallelizable, biologically plausible alternative to backpropagation for solving the credit assignment problem.3 In predictive coding networks, learning and inference are seamlessly integrated into a single continuous dynamic. The network settles into an equilibrium state that minimizes the total prediction error (the energy function) through local, parallel updates. Because the updates are strictly localized, synaptic weights are modified using only the activity of immediately adjacent pre-synaptic and post-synaptic neurons, circumventing the weight transport problem entirely.5

Rigorous mathematical analyses, most notably by Whittington and Bogacz (2017), have conclusively demonstrated that under specific conditions (termed the "fixed prediction assumption"), predictive coding networks are algorithmically equivalent to a direct implementation of backpropagation.25 However, predictive coding achieves these mathematically identical weight updates without requiring a separate, sequential backward-locking computational pass.26

| Architectural Feature  | Supervised Backpropagation                                               | Predictive Coding / Local Error Minimization                         |
| :--------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------- |
| **Credit Assignment**  | Global computation heavily reliant on the chain rule 28                  | Localized computation driven by prediction error gradients 29        |
| **Information Flow**   | Sequential forward pass, locked by a sequential backward pass 6          | Simultaneous, bidirectional message passing and relaxation 3         |
| **Weight Symmetry**    | Requires perfect mathematical transpose of feedforward weights 3         | Functions robustly with separate, learned feedback weights 30        |
| **Hardware Affinity**  | Highly optimized for dense GPU matrix multiplication (Von Neumann) 8     | Ideal for distributed, asynchronous neuromorphic or analog fabrics 8 |
| **Continual Learning** | Highly prone to catastrophic forgetting of previous data distributions 2 | Compartmentalized updates alleviate memory degradation naturally 2   |

### **Scalability Bottlenecks of Predictive Coding Networks vs. Transformers**

Despite its theoretical elegance and biological fidelity, empirical implementations of predictive coding face severe, documented scalability bottlenecks when compared directly to modern dense LLM transformer architectures.6

Recent benchmarking of predictive coding networks, utilizing accelerated JAX frameworks such as the open-source PCX library developed by researchers at VERSES AI and Oxford University, reveals a critical phenomenon: energy imbalance.6 While PC effectively matches the performance of backpropagation on small-scale, shallow tasks (e.g., convolutional networks with 5 to 7 layers on CIFAR10), its performance degrades precipitously as model depth increases to the scale of modern deep neural networks.6

During the inference relaxation phase of a predictive coding network, the model's "energy" (the quantified prediction error) becomes heavily concentrated in the final layers nearest the target signal. The localized message-passing architecture struggles to effectively propagate this energy backward through deep hierarchical structures to update the initial feature-extraction layers.6 The energy in the final layer can remain orders of magnitude larger than the energy in the input layer, severely stifling learning.6

This systemic energy concentration yields an inescapable hyperparameter dilemma in deep PC networks. Utilizing a small learning rate for state updates improves the final equilibrium accuracy but dramatically exacerbates the energy imbalance, leading to exponentially decaying gradients in early layers—analogous to the catastrophic vanishing gradient problem in traditional recurrent neural networks.6 Conversely, utilizing a large learning rate to force energy propagation destroys the network's stability, leading to immediate performance decay. Consequently, while local prediction error minimization remains a superior theoretical framework for localized learning, raw predictive coding architectures currently struggle to train the massively deep, billion-parameter matrices that have made dense transformers the industry standard.6

## **Abstract State Prediction (JEPA) vs. Token-level Autoregression**

To circumvent both the scaling limits of predictive coding and the compounding thermodynamic inefficiencies of autoregressive token generation, frontier AI researchers are pivoting toward representation learning in continuous latent spaces. The premier instantiation of this philosophy is the Joint Embedding Predictive Architecture (JEPA), pioneered by Yann LeCun and Meta's Fundamental AI Research (FAIR) team.17

### **Overcoming the Pixel and Token Prediction Trap**

Traditional generative world models—including state-of-the-art multimodal LLMs and diffusion models—operate via encoder-decoder architectures optimized to reconstruct missing pixels or predict the next discrete text token.16 As previously noted, this forces the model to allocate vast parameter counts to model high-frequency, task-irrelevant stochasticity.

JEPA actively abandons data-space reconstruction. Instead, JEPA trains models to learn the underlying causal dynamics of data by predicting the internal, abstract representations of future or masked information.17 The architecture fundamentally consists of three primary components:

1. **Context Encoder (X-Encoder):** Processes known data (e.g., the first 80% of a video sequence or a text prompt) into a stable, continuous abstract representation.16
2. **Target Encoder (Y-Encoder):** Processes the unobserved, masked, or future data into a target representation. During inference, this encoder is bypassed or frozen.34
3. **Predictor:** A lightweight, highly efficient network that takes the context embedding and an optional action or latent variable to output a predicted target embedding.17

Because the JEPA architecture operates strictly in a continuous semantic space, multiple plausible futures can coexist within a single embedding prediction without forcing the model to collapse into a single, potentially incorrect pixel or token.36 This structural inductive bias effectively abstracts away surface-level variability. For instance, the linguistic representations for "the room is dark" and "the lamp is off" converge in the latent space, eliminating the semantic redundancy that plagues cross-entropy loss in discrete token predictors.16

The mathematical alignment of these representations is enforced without pixel reconstruction through contrastive mechanisms or variance-invariance-covariance regularization (such as the InfoNCE loss), which pulls matching semantic pairs closer together while pushing disparate noise apart to prevent representation collapse.34

### **Empirical Performance and Computational Efficiency**

The empirical advantages of transitioning from discrete token generation to continuous embedding prediction are striking. Recent evaluations of Vision-Language JEPA (VL-JEPA) against standard autoregressive Multimodal Large Language Models (MLLMs) demonstrate fundamental efficiency gains across training, inference, and adaptability.37

| Metric / Capability      | Autoregressive Vision-Language Models (VLMs)                 | Joint Embedding Predictive Architecture (VL-JEPA)                                                  |
| :----------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Output Space**         | Discrete tokens bounded by cross-entropy (Data Space) 37     | Continuous semantic embeddings (Latent Space) 37                                                   |
| **Generation Mode**      | Sequential / Step-by-step prediction 39                      | Non-autoregressive / One-shot continuous stream 34                                                 |
| **Parameter Efficiency** | Requires massive scale to memorize generative syntax 16      | Achieves superior baseline performance with **50% fewer trainable parameters** 37                  |
| **Inference Latency**    | High (bounded by continuous KV-cache loading) 38             | Significantly reduced (**\~2.85x fewer decoding operations**) 38                                   |
| **Selective Decoding**   | Requires complex heuristics (e.g., speculative decoding) 40  | Natively supported; the text decoder is invoked only when human-readable output is required 37     |
| **Zero-Shot Modality**   | Highly sensitive to prompt engineering and exact matching 16 | Naturally supports open-vocabulary classification and retrieval without structural modification 38 |

In strictly controlled experiments matching the vision encoder, training data volume, and batch size, VL-JEPA consistently outperforms generative VLMs trained with standard cross-entropy loss.38 By predicting a semantic answer embedding non-autoregressively, VL-JEPA processes discriminative tasks—such as video question-answering, semantic retrieval, and action recognition—in real-time online streaming scenarios.32 Crucially, the system is natively decoupled from language generation; a lightweight text decoder is only engaged conditionally at the absolute end of the pipeline if raw text must be presented to a human observer.32

Similarly, the Continuous Autoregressive Language Model (CALM) framework validates this trajectory in pure text processing. By compressing chunks of discrete tokens into single continuous vectors via a high-fidelity autoencoder, and predicting the next *vector* rather than the next *token*, CALM reduces the number of required generative steps dramatically.41 This establishes continuous next-vector prediction as a scalable pathway toward ultra-efficient language models that circumvent the traditional sequential bottlenecks.41

Ultimately, these continuous state predictors function as scalable "world simulators." By removing the generative bottleneck, JEPAs allow the model to iterate rapidly in the latent space, performing deep temporal reasoning, mental rollouts, and hierarchical planning without the degrading noise floor of pixel or token generation.17

## **Architectural Transitions: From Stateless Monoliths to Stateful, Cellular/Actor-based Continuous Learning Systems**

The culmination of predictive processing, Active Inference, and abstract representation learning fundamentally conflicts with the current cloud-native infrastructure underlying artificial intelligence. Modern AI deployment predominantly treats LLMs as stateless monoliths.42 In typical serving systems, once an API request is completed, the generation state (e.g., the KV cache) is discarded entirely. Subsequent interactions from the same user or agent force a computationally costly reprefill of the entire interaction history, treating every continuation as a completely novel prompt.43

However, intelligence operating on principles of dynamic active inference, world modeling, and local error minimization is inherently stateful.42 A system learning continuously from its environment must persist context, evolve its generative rules, and update localized parameters online without catastrophic forgetting.42

### **The Necessity of Stateful AI Infrastructure**

As AI research moves toward embedded agents and lifelong learning frameworks, physical and software infrastructure is pivoting from stateless, ephemeral microservices to stateful, decentralized systems.42 Stateful learning involves updating model parameters online in response to continuous data streams, effectively decreasing long-term training times, saving massive computing costs, and mitigating model drift.44

In advanced architectures, functions maintain a persistent state linked to specific environmental tasks or user sessions. While traditional cloud networks rely on external database storage—which incurs extreme latency overhead rendering real-time robotics impossible—next-generation edge AI and cellular network paradigms mandate localized, in-memory state persistence.45 This hardware transition has catalyzed the adoption of **Actor-based** concurrency models in machine learning software design.

### **Cellular and Actor-based Topologies for Decentralized Inference**

The Actor model is a mathematical framework for concurrent computation that treats "actors" as the universal primitives of execution. Actors are inherently stateful, encapsulated entities that communicate strictly through asynchronous message passing, never exposing their internal state to the global system.46

Translating this computer science paradigm into AI topology yields "cellular" machine learning architectures. Rather than a singular, massive global matrix optimized via backpropagation, cellular AI models conceptualize the network as a decentralized grid of autonomous, interacting processing units.

**1. Neural Cellular Automata (NCA) and Predictive Coding:** By treating predictive coding as the emergent dynamics of a Neural Cellular Automaton, the global algorithm is fractured into a multi-agent system. Each "cell" in the algorithmic grid maintains its own local prediction, prediction error, and state vectors.8 Synchronous local update rules replace explicit, global relaxation loops. In this actor-based paradigm, cells optimize their local free energy independently. Because the rules are strictly local and do not require global backpropagation, the architecture inherently scales across distributed compute fabrics, including next-generation analog neuromorphic hardware, without requiring the global synchronization that bottlenecks GPUs.8

**2. The SAPIN Architecture:** A prime realization of this stateful, cellular transition is the Structurally Adaptive Predictive Inference Network (SAPIN).47 SAPIN operates as a 2D grid where cellular processing units learn by minimizing local prediction errors, inspired directly by active inference. SAPIN employs two concurrent learning mechanisms:

- A local, Hebbian-like synaptic plasticity rule driven by the temporal difference between a cell's actual activation and its learned expectation.
- A morphological (structural) plasticity mechanism where cells physically "migrate" across the topological grid to optimize their information-receptive fields.47

Unlike static LLMs, SAPIN's intrinsic drive to minimize prediction error allows it to learn not just *how* to process information, but *where* to position its computational resources dynamically. In standard reinforcement learning benchmarks like CartPole, SAPIN successfully discovered stable balancing policies autonomously, proving the viability of decentralized, homeostasis-driven networks.47

**3. Multi-Agent Ecosystems and Federated Inference:** Scaling this cellular concept to the macro level, organizations such as the Active Inference Institute and VERSES AI are formalizing entire ecosystems of intelligence.48 Within a macro actor-based architecture, separate AI agents (or domain-specific Small Language Models) maintain distinct generative models. Through a process termed "Federated Inference," these agents share beliefs via decentralized consensus mechanisms—often formalized mathematically via category theory topoi—rather than transmitting raw, uncompressed data.49

This allows a localized agent to dynamically swap between an egocentric and an allocentric perspective, inferring the beliefs of other actors in the system.51 The result is that complex, cooperative intelligence emerges from the localized interactions of bounded actors, entirely bypassing the need for a centralized, monolithic control matrix.

By fracturing the monolithic transformer into an interacting ecosystem of stateful, JEPA-like active inference nodes, AI research is establishing a foundation for models that do not merely simulate language generation, but actively compute, persist, and structurally evolve within the continuous dynamics of the physical world.

## ---

**Annotated List of Key Academic Sources**

**1. "A Neural Network Implementation for Free Energy Principle" (Liu, 2023)**

*Identifier:* 52

*Link/DOI:* [arXiv:2306.06792](https://arxiv.org/abs/2306.06792)

*Validation Note:* This foundational paper establishes the direct theoretical and empirical bridge between the Free Energy Principle and machine learning. By utilizing a Helmholtz machine as a variational model optimized via free energy minimization, the research demonstrates how active inference can be practically applied to fine-tune neural networks. It validates that data distributions can be deformed through active sampling to achieve high accuracy while entirely circumventing traditional backpropagation limitations.

**2. "VL-JEPA: Joint Embedding Predictive Architecture for Vision-Language" (Chen et al., FAIR, 2025)**

*Identifier:* 38

*Link/DOI:* [arXiv:2512.10942](https://arxiv.org/html/2512.10942v1)

*Validation Note:* A critical benchmark paper from Meta FAIR proving that non-generative, latent-space predictive models drastically outperform traditional autoregressive token predictors. It empirically validates the superiority of JEPA architectures, showcasing that predicting abstract semantic embeddings reduces trainable parameters by 50% and decreases inference latency by 2.85x while supporting dynamic, zero-shot modality scaling.

**3. "Structurally Adaptive Predictive Inference Network (SAPIN)" (2025)**

*Identifier:* 47

*Link/DOI:* [arXiv:2511.02241](https://arxiv.org/abs/2511.02241)

*Validation Note:* This paper explicitly validates the theoretical transition from monolithic matrices to cellular, actor-based topologies. By introducing a 2D grid of processing cells that learn via local prediction error minimization and structural migration, SAPIN proves that decentralized, biologically plausible learning models driven by Active Inference can independently solve complex dynamic control tasks without global gradients.

**4. "A Path Towards Autonomous Machine Intelligence" (LeCun, 2022)**

*Identifier:* 54

*Link/DOI:*([https://openreview.net/pdf?id=BZ5a1r-kVsf](https://openreview.net/pdf?id=BZ5a1r-kVsf))

*Validation Note:* Yann LeCun's foundational position paper outlining the specific architecture necessary to bypass the autoregressive token-prediction trap. It serves as the primary theoretical blueprint for the Joint Embedding Predictive Architecture (JEPA), detailing how hierarchical predictive world models driven by intrinsic motivation (strongly aligned with Active Inference principles) can facilitate complex reasoning and planning without pixel-level reconstruction.

**5. "Benchmarking Predictive Coding Networks Made Simple" (VERSES AI Research, 2025)**

*Identifier:* 6

*Link/DOI:*([https://www.verses.ai/research-blog/benchmarking-predictive-coding-networks-made-simple](https://www.verses.ai/research-blog/benchmarking-predictive-coding-networks-made-simple))

*Validation Note:* A crucial empirical examination of the exact scalability bottlenecks inherent in predictive coding networks. By utilizing the newly released PCX JAX library, this research clearly delineates where predictive coding equals backpropagation (shallow networks) and where it fails (deep ResNets) due to systemic energy imbalance and gradient decay, highlighting the exact computational hurdles that transitional hybrid architectures must overcome.

**6. "Continuous Autoregressive Language Models (CALM)" (2025)**

*Identifier:* 41

*Link/DOI:* [arXiv:2510.27688](https://arxiv.org/html/2510.27688v1)

*Validation Note:* Provides vital empirical evidence for the necessity of expanding the semantic bandwidth of generative steps in NLP. By compressing discrete tokens into continuous vectors for predictive modeling, CALM validates the transition away from stateless, discrete sequence generation and corroborates the broader findings of JEPA regarding the extreme efficiency of operating strictly in continuous abstract spaces.

**7. "Federated Inference and Belief Sharing" (Friston et al., 2024)**

*Identifier:* 50

*Link/DOI:*([https://pmc.ncbi.nlm.nih.gov/articles/PMC11139662/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11139662/))

*Validation Note:* Authored by Karl Friston and the Active Inference Institute, this paper explores the macro-application of cellular and actor-based topologies. It provides the mathematical framework (utilizing category theory topoi) for how multiple stateful Active Inference agents can share beliefs and achieve collective intelligence without relying on centralized, monolithic training, validating the decentralized "ecosystem" approach to AI.

#### **Works cited**

1. Auto Deep Spiking Neural Network Design Based on an Evolutionary Membrane Algorithm - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12383992/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12383992/)
2. Brain-inspired Predictive Coding Improves the Performance of Machine Challenging Tasks, accessed March 7, 2026, [https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2022.1062678/full](https://www.frontiersin.org/journals/computational-neuroscience/articles/10.3389/fncom.2022.1062678/full)
3. Structural Plasticity as Active Inference: A Biologically-Inspired Architecture for Homeostatic Control - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2511.02241v1](https://arxiv.org/html/2511.02241v1)
4. \[Discussion] What are the problems of the backpropagation algorithm? : r/MachineLearning, accessed March 7, 2026, [https://www.reddit.com/r/MachineLearning/comments/70tz1n/discussion\_what\_are\_the\_problems\_of\_the/](https://www.reddit.com/r/MachineLearning/comments/70tz1n/discussion_what_are_the_problems_of_the/)
5. Inspires effective alternatives to backpropagation: predictive coding helps understand and build learning - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11881729/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11881729/)
6. Benchmarking Predictive Coding Networks Made Simple - Genius, accessed March 7, 2026, [https://www.verses.ai/research-blog/benchmarking-predictive-coding-networks-made-simple](https://www.verses.ai/research-blog/benchmarking-predictive-coding-networks-made-simple)
7. Deep Supervised Learning Using Local Errors - Frontiers, accessed March 7, 2026, [https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2018.00608/full](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2018.00608/full)
8. Predictive Coding as Neural Cellular Automata: Scaling Brain-Like Learning to Colossus-Scale GPU Clusters | by Rabus McCaleb | Feb, 2026 | Medium, accessed March 7, 2026, [https://medium.com/@RabusMccaleb/predictive-coding-as-neural-cellular-automata-scaling-brain-like-learning-to-colossus-scale-gpu-907c0ae6d38a](https://medium.com/@RabusMccaleb/predictive-coding-as-neural-cellular-automata-scaling-brain-like-learning-to-colossus-scale-gpu-907c0ae6d38a)
9. designing-ml-systems-summary/09-continual-learning-and-test-in-production.md at main, accessed March 7, 2026, [https://github.com/serodriguez68/designing-ml-systems-summary/blob/main/09-continual-learning-and-test-in-production.md](https://github.com/serodriguez68/designing-ml-systems-summary/blob/main/09-continual-learning-and-test-in-production.md)
10. Thermodynamic Turn: From the Transformer Dead End to Physics-Based Active Inference, accessed March 7, 2026, [https://medium.com/@qhjyfrfw/thermodynamic-turn-from-the-transformer-dead-end-to-physics-based-active-inference-2afa410622fb](https://medium.com/@qhjyfrfw/thermodynamic-turn-from-the-transformer-dead-end-to-physics-based-active-inference-2afa410622fb)
11. Rethinking LLM Inference Bottlenecks: Insights from Latent Attention and Mixture-of-Experts, accessed March 7, 2026, [https://arxiv.org/html/2507.15465v3](https://arxiv.org/html/2507.15465v3)
12. The Strangest Bottleneck in Modern LLMs | Towards Data Science, accessed March 7, 2026, [https://towardsdatascience.com/the-strangest-bottleneck-in-modern-llms/](https://towardsdatascience.com/the-strangest-bottleneck-in-modern-llms/)
13. The Chocolate Milk Cult's Guide to Inference Scaling for AI Models | by Devansh | Medium, accessed March 7, 2026, [https://machine-learning-made-simple.medium.com/the-chocolate-milk-cults-guide-to-inference-scaling-for-ai-models-50aa2290eb50](https://machine-learning-made-simple.medium.com/the-chocolate-milk-cults-guide-to-inference-scaling-for-ai-models-50aa2290eb50)
14. Beyond Next-Token Prediction: A Standards-Aligned Survey of Autoregressive LLM Failure Modes, Deployment Patterns, and the Potential Role of World Models - MDPI, accessed March 7, 2026, [https://www.mdpi.com/2079-9292/15/5/966](https://www.mdpi.com/2079-9292/15/5/966)
15. The Missing Reward: Active Inference in the Era of Experience - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2508.05619v1](https://arxiv.org/html/2508.05619v1)
16. VL-JEPA: Why Predicting Meaning Beats Generating Words in Vision-Language AI, accessed March 7, 2026, [https://medium.com/@ranjanunicode22/vl-jepa-why-predicting-meaning-beats-generating-words-in-vision-language-ai-f5f8d613c87b](https://medium.com/@ranjanunicode22/vl-jepa-why-predicting-meaning-beats-generating-words-in-vision-language-ai-f5f8d613c87b)
17. The Anatomy of JEPA: The Architecture Behind embedded Predictive Representation Learning | by Tyler Frink | Medium, accessed March 7, 2026, [https://medium.com/@frinktyler1445/the-anatomy-of-jepa-the-architecture-behind-embedded-predictive-representation-learning-994bfa0bffe0](https://medium.com/@frinktyler1445/the-anatomy-of-jepa-the-architecture-behind-embedded-predictive-representation-learning-994bfa0bffe0)
18. Active Inference & Free-Energy Principle - Emergent Mind, accessed March 7, 2026, [https://www.emergentmind.com/topics/active-inference-and-free-energy-principle](https://www.emergentmind.com/topics/active-inference-and-free-energy-principle)
19. Exclusive: Dr. Karl Friston Unveils Cutting-Edge Active Inference AI Research at IWAI, accessed March 7, 2026, [https://deniseholt.us/dr-karl-friston-on-the-fabric-of-intelligence/](https://deniseholt.us/dr-karl-friston-on-the-fabric-of-intelligence/)
20. Intelligent Agents, AGI, Active Inference and the Free Energy Principle - MIIAfrica, accessed March 7, 2026, [https://miiafrica.org/2024/01/16/intelligent-agents-agi-active-inference-and-the-free-energy-principle/](https://miiafrica.org/2024/01/16/intelligent-agents-agi-active-inference-and-the-free-energy-principle/)
21. The Convergence of Swarm Intelligence, Antetic AI, Cellular Automata & Active Inference: Reshaping Multi-Agent Systems - Alphanome.AI, accessed March 7, 2026, [https://www.alphanome.ai/post/the-convergence-of-swarm-intelligence-antetic-ai-cellular-automata-active-inference-reshaping-m](https://www.alphanome.ai/post/the-convergence-of-swarm-intelligence-antetic-ai-cellular-automata-active-inference-reshaping-m)
22. Active inference and artificial reasoning - arXiv.org, accessed March 7, 2026, [https://arxiv.org/pdf/2512.21129](https://arxiv.org/pdf/2512.21129)
23. The Science and Standards Behind the Breakthrough - Verses AI, accessed March 7, 2026, [https://www.verses.ai/blog/blogs/science-and-standards-behind-the-breakthrough](https://www.verses.ai/blog/blogs/science-and-standards-behind-the-breakthrough)
24. The Information-Theoretic Imperative: Compression and the Epistemic Foundations of Intelligence - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2510.25883v1](https://arxiv.org/html/2510.25883v1)
25. On the relationship between predictive coding and backpropagation | PLOS One, accessed March 7, 2026, [https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0266102](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0266102)
26. \[LINK] Unifying Predictive Coding With Backpropagation - Astral Codex Ten, accessed March 7, 2026, [https://www.astralcodexten.com/p/link-unifying-predictive-coding-with](https://www.astralcodexten.com/p/link-unifying-predictive-coding-with)
27. Phasor Agents: Oscillatory Graphs with Three-Factor Plasticity and Sleep-Staged Learning - arXiv.org, accessed March 7, 2026, [https://www.arxiv.org/pdf/2601.04362](https://www.arxiv.org/pdf/2601.04362)
28. Backpropagation in Deep Learning: The Key to Optimizing Neural Networks | by Juan C Olamendy | Medium, accessed March 7, 2026, [https://medium.com/@juanc.olamendy/backpropagation-in-deep-learning-the-key-to-optimizing-neural-networks-7c063a03f677](https://medium.com/@juanc.olamendy/backpropagation-in-deep-learning-the-key-to-optimizing-neural-networks-7c063a03f677)
29. Predictive Coding has been Unified with Backpropagation - LessWrong, accessed March 7, 2026, [https://www.lesswrong.com/posts/JZZENevaLzLLeC3zn/predictive-coding-has-been-unified-with-backpropagation](https://www.lesswrong.com/posts/JZZENevaLzLLeC3zn/predictive-coding-has-been-unified-with-backpropagation)
30. A Survey on Brain-inspired Deep Learning via Predictive Coding - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2308.07870v2](https://arxiv.org/html/2308.07870v2)
31. Some thoughts on autoregressive models - Wonder's Lab, accessed March 7, 2026, [https://wonderfall.dev/autoregressive/](https://wonderfall.dev/autoregressive/)
32. VL-JEPA: JOINT EMBEDDING PREDICTIVE ARCHITECTURE FOR VISION-LANGUAGE - OpenReview, accessed March 7, 2026, [https://openreview.net/pdf?id=tjimrqc2BU](https://openreview.net/pdf?id=tjimrqc2BU)
33. Denoising with a Joint-Embedding Predictive Architecture - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2410.03755v2](https://arxiv.org/html/2410.03755v2)
34. From Token Prediction to World Models: The Architectural Evolution After LLMs, accessed March 7, 2026, [https://deepsense.ai/blog/from-token-prediction-to-world-models-the-architectural-evolution-after-llms/](https://deepsense.ai/blog/from-token-prediction-to-world-models-the-architectural-evolution-after-llms/)
35. seq-JEPA: Autoregressive Predictive Learning of Invariant-Equivariant World Models - arXiv, accessed March 7, 2026, [https://arxiv.org/html/2505.03176v2](https://arxiv.org/html/2505.03176v2)
36. VL-JEPA: Why Predicting Embeddings Beats Generating Tokens for Vision-Language AI, accessed March 7, 2026, [https://rewire.it/blog/vl-jepa-why-predicting-embeddings-beats-generating-tokens/](https://rewire.it/blog/vl-jepa-why-predicting-embeddings-beats-generating-tokens/)
37. VL-JEPA: Joint Embedding Predictive Architecture for Vision-language | OpenReview, accessed March 7, 2026, [https://openreview.net/forum?id=tjimrqc2BU](https://openreview.net/forum?id=tjimrqc2BU)
38. VL-JEPA: Joint Embedding Predictive Architecture for Vision-language - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2512.10942v1](https://arxiv.org/html/2512.10942v1)
39. From Efficient Multimodal Models to World Models: A Survey - arXiv, accessed March 7, 2026, [https://arxiv.org/pdf/2407.00118](https://arxiv.org/pdf/2407.00118)
40. VL-JEPA: Joint Embedding Predictive Architecture for Vision-language - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2512.10942v2](https://arxiv.org/html/2512.10942v2)
41. Continuous Autoregressive Language Models - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2510.27688v1](https://arxiv.org/html/2510.27688v1)
42. AI Infrastructure Is Becoming Stateful — And That Changes Everything - Datacenters.com, accessed March 7, 2026, [https://www.datacenters.com/news/ai-infrastructure-is-becoming-stateful-and-that-changes-everything](https://www.datacenters.com/news/ai-infrastructure-is-becoming-stateful-and-that-changes-everything)
43. Stateful Large Language Model Serving with Pensieve - ResearchGate, accessed March 7, 2026, [https://www.researchgate.net/publication/390315330\_Stateful\_Large\_Language\_Model\_Serving\_with\_Pensieve](https://www.researchgate.net/publication/390315330_Stateful_Large_Language_Model_Serving_with_Pensieve)
44. Thoughts on Stateful ML, Online Learning, and Intelligent ML Model Retraining - Medium, accessed March 7, 2026, [https://medium.com/data-science/thoughts-on-stateful-ml-online-learning-and-intelligent-ml-model-retraining-4e583728e8a1](https://medium.com/data-science/thoughts-on-stateful-ml-online-learning-and-intelligent-ml-model-retraining-4e583728e8a1)
45. Energy-Efficient Deployment of Stateful FaaS Vertical Applications on Edge Data Networks, accessed March 7, 2026, [https://arxiv.org/html/2405.04263v1](https://arxiv.org/html/2405.04263v1)
46. Design patterns/best practice for building Actor-based system - Stack Overflow, accessed March 7, 2026, [https://stackoverflow.com/questions/3931994/design-patterns-best-practice-for-building-actor-based-system](https://stackoverflow.com/questions/3931994/design-patterns-best-practice-for-building-actor-based-system)
47. \[2511.02241] Structural Plasticity as Active Inference: A Biologically-Inspired Architecture for Homeostatic Control - arXiv.org, accessed March 7, 2026, [https://arxiv.org/abs/2511.02241](https://arxiv.org/abs/2511.02241)
48. Designing ecosystems of intelligence from first principles - TUE Research portal - Eindhoven University of Technology, accessed March 7, 2026, [https://research.tue.nl/files/352949502/friston-et-al-2024-designing-ecosystems-of-intelligence-from-first-principles.pdf](https://research.tue.nl/files/352949502/friston-et-al-2024-designing-ecosystems-of-intelligence-from-first-principles.pdf)
49. Shared Protentions in Multi-Agent Active Inference - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11049075/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11049075/)
50. Federated inference and belief sharing - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11139662/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11139662/)
51. Empathy Modeling in Active Inference Agents for Perspective-Taking and Alignment - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2602.20936v1](https://arxiv.org/html/2602.20936v1)
52. \[2306.06792] A Neural Network Implementation for Free Energy Principle - arXiv, accessed March 7, 2026, [https://arxiv.org/abs/2306.06792](https://arxiv.org/abs/2306.06792)
53. (PDF) VL-JEPA: Joint Embedding Predictive Architecture for Vision-language, accessed March 7, 2026, [https://www.researchgate.net/publication/398601986\_VL-JEPA\_Joint\_Embedding\_Predictive\_Architecture\_for\_Vision-language](https://www.researchgate.net/publication/398601986_VL-JEPA_Joint_Embedding_Predictive_Architecture_for_Vision-language)
54. A Path Towards Autonomous Machine Intelligence Version 0.9.2, 2022-06-27 - OpenReview, accessed March 7, 2026, [https://openreview.net/pdf?id=BZ5a1r-kVsf](https://openreview.net/pdf?id=BZ5a1r-kVsf)
55. Yann LeCun's Home Page, accessed March 7, 2026, [http://yann.lecun.com/](http://yann.lecun.com/)
56. Federated inference and belief sharing - Chris Fields, accessed March 7, 2026, [https://chrisfieldsresearch.com/pre-proof-NBR-2023.pdf](https://chrisfieldsresearch.com/pre-proof-NBR-2023.pdf)
