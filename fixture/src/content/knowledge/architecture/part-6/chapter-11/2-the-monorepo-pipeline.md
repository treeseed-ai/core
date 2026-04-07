---
title: "The Monorepo Pipeline"
---

## Introduction

To coordinate the diverse technological layers of the Karyon architecture, we must move beyond fragmented repository management. A unified build and development pipeline is essential for ensuring that the concurrent orchestration of the BEAM and the raw performance of native Rust remain perfectly synchronized.

## The Imperative for a Hybrid Monorepo

The architecture of Karyon is not a monolithic script; it is a hybrid organism relying on two vastly different technological ecosystems to function. Elixir (operating on the Erlang VM, or BEAM) provides the highly concurrent, fault-tolerant "cytoplasm" that orchestrates cell communication, while Rust provides the bare-metal "organelles" capable of traversing a temporal graph at maximum bandwidth without garbage collection pauses.

The necessity of this hybrid structure stems from a foundational constraint of the BEAM: while it natively excels at distributed orchestration and preemptive scheduling, strictly enforced functional immutability creates a severe computational bottleneck regarding immutable data copying for CPU-bound tasks [[1]](#ref-1). To resolve this limitation, Karyon pierces the managed-VM abstraction by executing Native Implemented Functions (NIFs) utilizing Rust's zero-cost abstractions [[2]](#ref-2), safely dropping down to native code without compromising the VM's stability.

However, maintaining these two halves requires a unified build process. If the Elixir orchestrator and the Rust graph engine are split into separate repositories, the artificial integration boundary shatters development velocity and introduces dangerous deployment race conditions known as dependency drift [[3]](#ref-3). A monorepo guarantees precise Foreign Function Interface (FFI) synchronization; it ensures that any modification to the Rust memory layout is atomically committed and validated against the exact Elixir code that consumes it [[3]](#ref-3), [[4]](#ref-4), [[5]](#ref-5). Versioning them separately actively prioritizes structural segregation over runtime safety, inviting mismatched FFI signatures that instigate instantaneous segmentation faults. The Karyon organism must be built, managed, and compiled as a single deterministic entity: the monorepo.

## The Karyon Monorepo Structure

The objective is to physically structure the repository to respect the biological and execution boundaries of the design. The environment is rigidly separated into the Cytoplasm (Elixir), the Organelles (Rust), Immutable Genetics (DNA/Objectives), and isolated execution bounds (Sandbox).

```text
karyon/
├── mix.exs                     # The Elixir build manifest and BEAM dependencies
├── config/                     # Boot configurations for the Erlang VM
├── lib/                        # THE CYTOPLASM (Elixir Source Code)
│   ├── karyon.ex               # The Application initialization (BOOT)
│   └── karyon/
│       ├── epigenetic/         # The Epigenetic Supervisor (Stem cell differentiation)
│       └── cells/              # The biological logic for different cell types
├── native/                     # THE ORGANELLES (Rust Source Code)
│   └── rhizome_engine/         # The Rustler NIF crate
│       ├── Cargo.toml          # Rust dependencies (Tree-sitter, XTDB/Memgraph drivers)
│       └── src/
│           ├── lib.rs          # The Bridge: Defines what Rust functions Elixir can call
│           └── graph/          # Core memory topology
├── priv/                       # IMMUTABLE GENETICS (Static Assets)
│   ├── dna/                    # YAML manifests that define cell differentiation
│   └── objectives/             # The base Attractor States (Core Values)
├── sandbox/                    # VIRTIO-FS MOUNT TARGETS (The Environment)
└── Makefile                    # Orchestrates compiling Rust and Elixir symbiotically
```

Within this structure, advanced CI/CD tooling orchestrates the build execution by managing divergent dependency lockfiles (`mix.lock` and `Cargo.lock`) [[5]](#ref-5). The monorepo essentially maps the entire state of the hybrid system to a single Git commit tree, allowing conditional builds that invoke the Rust compiler only if the cryptographic hash of the `src/` directory mutates [[3]](#ref-3), [[5]](#ref-5).

## The Workspace vs. The Sterile Engine & Deployment Guarantees

A critical distinction in this architecture is the complete separation of the Karyon core (the *engine*) from the target projects it manages (the *workspaces*). Note what is intentionally absent from the repository: target codebases and execution states.

The Karyon repository is the engine. When enacted, it projects its presence into a target workspace entirely outside the immutable `karyon/` core directory. This separation guarantees that a catastrophic sandbox compilation failure has zero chance of corrupting the system's core source genetics.

To extend this sterility to the deployment phase, the monorepo relies on the `rustler_precompiled` paradigm for CI/CD integration [[6]](#ref-6). Instead of installing massive LLVM compilation toolchains onto target production servers, a build matrix cross-compiles the Rust NIF for specific CPU architectures ahead of time. However, downloading executable shared libraries introduces supply-chain security vulnerabilities. To strictly mitigate this, Karyon employs deterministic SHA-256 checksum validation [[7]](#ref-7); if the downloaded binary's hash diverges from the version-controlled checksum, the runtime immediately halts, ensuring the engine remains sovereign and immune to runtime tampering or supply-chain injection attacks.

## The Engineering Reality: The Rustler Bridge and Memory Transfer

The most technically demanding vector in this monorepo is the `native/` boundary. The Elixir Cytoplasm communicates with the Rust Organelles through NIFs, specifically using the `Rustler` crate to create the required FFI bindings. While `mix compile` inside the root directory orchestrates building both halves of the organism flawlessly, writing the bridge is unforgiving and necessitates strict adherence to zero-copy memory patterns.

In naive hybrid architectures, passing sprawling data structures (such as a massive Abstract Syntax Tree representation) involves deep serialization into intermediate string formats like JSON or ETF, which imposes astronomical latency penalties—frequently upwards of \~318 milliseconds per request [[8]](#ref-8). This deserialization chokehold undermines the computational advantage of utilizing Rust entirely.

To solve this, Karyon implements explicit "Zero-Copy" paradigms:

- **Sub-Binary Extraction:** For high-throughput read-only parsing, Rust utilizes SIMD hardware instructions for structural scanning and directly constructs BEAM sub-binary references, completely circumventing memory allocation by merely returning offset pointers to data residing on the global VM heap [[9]](#ref-9).
- **Opaque Resource Objects:** For mutable objects like the 512GB memory graph, Karyon utilizes `enif_alloc_resource` to wrap pure Rust memory pointers in opaque BEAM Resource Objects [[10]](#ref-10), [[11]](#ref-11). Because these resources integrate smoothly with the BEAM garbage collector, Elixir can safely pass a native pointer handle as a standard variable, returning it to Rust where it can be in-place mutated [[12]](#ref-12) without incurring copy penalties.

### Mitigating Virtual Machine Starvation

The integration of native code bypasses standard execution bounds, introducing the perilous risk of Virtual Machine starvation. The BEAM demands a strict, mathematically defined contract: a standard NIF must complete its operation and yield control to the scheduler within 1 millisecond [[10]](#ref-10), [[13]](#ref-13).

When a Rust function monopolizes a primary scheduler thread for heavy algorithmic loads without yielding, the VM ceases timeslicing on that core. Incoming network traffic queues infinitely in memory, and delayed distributed heartbeat responses trigger false node-failure scenarios, culminating in catastrophic network netsplits [[14]](#ref-14), [[15]](#ref-15).

To offload intensive compute from primary bounds, Karyon designates computationally dense operations via `DirtyCpu` or `DirtyIo` scheduler flags [[16]](#ref-16). This pushes native execution to an isolated thread pool within the VM, safeguarding the primary scheduler [[10]](#ref-10). However, this architectural safety mechanism carries physical consequences: invoking a dirty scheduler forces an operating system thread context switch, resulting in a base latency overhead directly compounded by the destruction of CPU cache locality and TLB thrashing [[17]](#ref-17), [[18]](#ref-18). Consequently, executing the Karyon architecture requires mathematically modeling this \~5 microsecond context switch against the functional execution time to optimize thresholding bounds.

## Summary

Transitioning from biological theory to physical software architecture requires an uncompromising development environment. A hybrid monorepo orchestrates the symbiotic compilation of the Elixir Cytoplasm and Rust Organelles, utilizing zero-copy memory extraction and strict CI/CD hashing to guarantee FFI synchronization without compromising the Erlang VM's primary scheduler.

***

## References

1. <a id="ref-1"></a>Mühlbauer, P. (2026). *Writing Elixir Bindings for Apache Arrow with Rustler*. Patrick Mühlbauer. [https://patrick-muehlbauer.com/articles/arrow-bindings-for-elixir-via-rust/](https://patrick-muehlbauer.com/articles/arrow-bindings-for-elixir-via-rust/)
2. <a id="ref-2"></a>Nowack, M. (2019). *Discord infra engineer here -- this blog post needs an update!* Hacker News. [https://news.ycombinator.com/item?id=19240040](https://news.ycombinator.com/item?id=19240040)
3. <a id="ref-3"></a>Segment Engineering. (2026). *Why Twilio Segment moved from microservices back to a monolith*. Hacker News. [https://news.ycombinator.com/item?id=46257714](https://news.ycombinator.com/item?id=46257714)
4. <a id="ref-4"></a>Manzanit0. (2022). *Elixir: Monorepos*. [https://manzanit0.github.io/elixir/2022/01/21/elixir-monorepos.html](https://manzanit0.github.io/elixir/2022/01/21/elixir-monorepos.html)
5. <a id="ref-5"></a>Elixir Forum Contributors. (2026). *Elixir mono-repo best practices*. Elixir Programming Language Forum. [https://elixirforum.com/t/elixir-mono-repo-best-practices/54403](https://elixirforum.com/t/elixir-mono-repo-best-practices/54403)
6. <a id="ref-6"></a>Kreuzberg Dev. (2026). *kreuzberg/CHANGELOG.md at main*. GitHub. [https://github.com/kreuzberg-dev/kreuzberg/blob/main/CHANGELOG.md](https://github.com/kreuzberg-dev/kreuzberg/blob/main/CHANGELOG.md)
7. <a id="ref-7"></a>Hexdocs. (2026). *Changelog — pcap\_file\_ex v0.1.5*. [https://hexdocs.pm/pcap\_file\_ex/0.1.5/changelog.html](https://hexdocs.pm/pcap_file_ex/0.1.5/changelog.html)
8. <a id="ref-8"></a>Aeon Authors. (2026). *Aeon: High-Performance Neuro-Symbolic Memory Management for Long-Horizon LLM Agents*. arXiv.org. [https://arxiv.org/html/2601.15311v3](https://arxiv.org/html/2601.15311v3)
9. <a id="ref-9"></a>Hexdocs. (2026). *Overview — RustyCSV v0.3.10*. [https://hexdocs.pm/rusty\_csv/](https://hexdocs.pm/rusty_csv/)
10. <a id="ref-10"></a>Brunet, et al. (2022). *The best of both worlds : Fast numerical computation in Erlang*. [https://webperso.info.ucl.ac.be/\~pvr/Brunet\_26481700\_Couplet\_20371700\_2022.pdf](https://webperso.info.ucl.ac.be/~pvr/Brunet_26481700_Couplet_20371700_2022.pdf)
11. <a id="ref-11"></a>Erlang. (2026). *erl\_nif*. [https://erlang.org/documentation/doc-10.1/erts-10.1/doc/html/erl\_nif.html](https://erlang.org/documentation/doc-10.1/erts-10.1/doc/html/erl_nif.html)
12. <a id="ref-12"></a>Sabron, S. (2026). *How Discord Used Rust to Scale Elixir Up to 11 Million Concurrent Users*. Medium. [https://medium.com/@siddharth.sabron/how-discord-used-rust-to-scale-elixir-up-to-11-million-concurrent-users-7eb84194aee5](https://medium.com/@siddharth.sabron/how-discord-used-rust-to-scale-elixir-up-to-11-million-concurrent-users-7eb84194aee5)
13. <a id="ref-13"></a>Valim, R. d. A. (2026). *TIL: BEAM Dirty Work!!*. Medium. [https://medium.com/@andradevalim.renato/til-beam-dirty-work-022cd729447a](https://medium.com/@andradevalim.renato/til-beam-dirty-work-022cd729447a)
14. <a id="ref-14"></a>Elixir Forum Contributors. (2026). *What is the difference between preemptive scheduling in Java and Elixir?*. [https://elixirforum.com/t/what-is-the-difference-between-preemptive-scheduling-in-java-and-elixir/58199](https://elixirforum.com/t/what-is-the-difference-between-preemptive-scheduling-in-java-and-elixir/58199)
15. <a id="ref-15"></a>Chalmers ODR. (2026). *Erlang SGX*. [https://odr.chalmers.se/bitstreams/35e997dc-8b0a-40e5-be2e-f3ce3de1e313/download](https://odr.chalmers.se/bitstreams/35e997dc-8b0a-40e5-be2e-f3ce3de1e313/download)
16. <a id="ref-16"></a>Erlang Solutions. (2026). *BEAM vs JVM: comparing and contrasting the virtual machines*. [https://www.erlang-solutions.com/blog/beam-jvm-virtual-machines-comparing-and-contrasting/](https://www.erlang-solutions.com/blog/beam-jvm-virtual-machines-comparing-and-contrasting/)
17. <a id="ref-17"></a>Yoric. (2026). *(Quite) A Few Words About Async*. [https://yoric.github.io/post/quite-a-few-words-about-async/](https://yoric.github.io/post/quite-a-few-words-about-async/)
18. <a id="ref-18"></a>Google Groups. (2026). *the real latency performance killer*. [https://groups.google.com/g/mechanical-sympathy/c/QMaiYtYj4rk/m/fKdJoAszDf4J](https://groups.google.com/g/mechanical-sympathy/c/QMaiYtYj4rk/m/fKdJoAszDf4J)
