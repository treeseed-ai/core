---
title: "Multi-Version Concurrency Control"
---

## Introduction

The theory of a lock-free, dual-layer topological Rhizome is conceptually elegant, but its physical implementation represents a brutal orchestration challenge. When thousands of concurrent biological cells (Actor Model processes running on the BEAM virtual machine) attempt to rapidly query, generate, and prune millions of edges within a shared Memgraph memory pool, the environment is ripe for catastrophic race conditions. If an active Cell reads a relational state to parse a python file, while a background optimization daemon simultaneously deletes a decaying node that the Cell relied upon, the system experiences digital cognitive dissonance.

## Race Conditions & Concurrency in Graph Databases

The structural complexity inherent to graph databases—where distinct data entities are explicitly connected by arbitrary and continuously mutating relationships—creates concurrency challenges that differ dramatically from classic relational tables.

Traditional lock-based database systems operate predominantly on Two-Phase Locking (2PL) protocols, requiring transactions to acquire shared or exclusive locks on nodes before modification. While efficient for point-query operations, Karyon relies on "mammoth transactions." A mammoth transaction is a long-running operational task that accesses, reads, or updates millions of interconnected items within a single transactional boundary [[1]](#ref-1).

When a mammoth transaction initiates under 2PL across a dense graph, it creates a massive contention footprint. Under 2PL, the throughput for concurrent write transactions effectively drops to absolute zero the moment a mammoth transaction begins updating a commonly accessed property, starving short-lived transactions of execution resources [[1]](#ref-1).

Karyon averts process lock-ups and cognitive dissonance through strict architectural reliance on **Multi-Version Concurrency Control (MVCC)**. By replacing read/write blocking with MVCC, executing mammoth transactions on dense graphs (similar to architectures like TuskFlow) can improve p99 tail latencies by up to $45\times$ compared to standard 2PL, keeping the organism agile and highly responsive [[1]](#ref-1).

## MVCC and Hybrid Temporal Storage

With MVCC, the Rhizome treats memory as immutable facts rather than manipulatable fields. When a perception cell learns a new relationship and updates a graph node in Memgraph, it does not overwrite the old data pointer. It creates an explicit *new* version of that node appended with a newer chronological timestamp. The active execution cells always read the newest available "live" version of the graph across their shared caching layers.

However, capturing every historical state change to support temporal analytics rapidly degrades query performance by bloating the memory space with redundant copies. To optimize temporal tracking without sacrificing operational throughput, Karyon utilizes an advanced "anchor+delta" strategy, similar to the architecture of AeonG [[2]](#ref-2).

Instead of appending full structural copies of vertices upon every temporal mutation, the system periodically creates a materialized version of the graph object (the anchor) and subsequently maintains only the specific property changes (the delta) that occur between adjacent anchors [[3]](#ref-3). When reading historical states for optimization, the engine jumps directly to the nearest anchor point and applies only the necessary deltas, avoiding deep, recursive version traversals and significantly reducing storage consumption compared to standard append-only logging [[3]](#ref-3).

## The Garbage Collection Vicious Cycle

While MVCC elegantly resolves read-write blockages, it introduces severe memory management bottlenecks. Tracking historical states in high-frequency mutation environments generates exponential physical memory segments.

The most acute failure state in MVCC architectures occurs during Hybrid Transaction and Analytical Processing (HTAP) workloads, known as the "vicious cycle". When Karyon's background optimization daemons analyze older static versions of the graph's history (to identify recursion patterns or extract telemetry), they establish a very old active read-timestamp. Simultaneously, concurrent write transactions rapidly mutate the properties of highly volatile graph nodes, appending thousands of new versions [[4]](#ref-4), [[5]](#ref-5). Because the long-running analytical query remains active, the garbage collector is blocked from reclaiming any intermediate versions. The memory footprint of the database expands uncontrollably until all RAM is exhausted, frequently triggering OOM termination [[5]](#ref-5).

To prevent this saturation, Karyon shifts away from standard background high-watermark tracking in favor of eager version pruning (the "Steam" approach) combined with in-place delta updates [[4]](#ref-4), [[6]](#ref-6). Whenever a worker thread traverses a version chain during a routine traversal, it simultaneously drops intermediate versions mathematically proven to be obsolete, ensuring version chains remain continuously short even during heavy write skew [[4]](#ref-4). Furthermore, by keeping the most recent, authoritative version of an entity physically in the primary structure and pushing old data into a transaction-local buffer [[6]](#ref-6), high-throughput, read-intensive cells can access the master version directly via a single memory lookup [[7]](#ref-7).

## The Hardware Bottleneck: NUMA Constraints

This massive, asynchronous memory orchestration surfaces an unavoidable hardware constraint regarding CPU cache starvation and Non-Uniform Memory Access (NUMA) topologies.

In-memory graph processing is fundamentally latency-bound. Navigating an adjacency list requires "pointer chasing," where the CPU must read a memory address to fetch a pointer to another random memory location before computing the next step [[8]](#ref-8). Because hardware prefetchers cannot predict randomized graph interconnects, nearly every pointer hop incurs a cache miss. During the 70-90 nanoseconds required to fetch the data from standard DRAM, the CPU cannot parallelize the workload, causing its Reorder Buffer (ROB) to saturate and the core to physically stall [[9]](#ref-9).

Standard server configurations invariably employ dual-socket NUMA topologies (e.g., dual 64-core EPYC). If Karyon operates its 512GB of RAM split physically across the motherboard, a thread chasing pointers from Socket 0 to the DRAM banks of Socket 1 must cross the high-latency CPU interconnect [[10]](#ref-10). Because power-law graphs are deeply interconnected and cannot be cleanly partitioned to a single memory node, these remote fetches effectively double the memory latency and halve the processor's aggregate memory throughput [[9]](#ref-9).

Furthermore, MVCC engines rely heavily on hardware-level atomic instructions (like CAS or Fetch-and-Add) to execute lock-free operations across the shared graph memory. Executing an atomic pointer swap targeting a remote NUMA node forces the hardware to broadcast snooping traffic to guarantee cache coherency across all sockets. Hardware benchmarks indicate that relying on features like the AMD Zen 5 CMPXCHG16B instruction across remote cores causes latency to skyrocket disastrously, heavily suffocating highly concurrent MVCC environments [[11]](#ref-11), [[12]](#ref-12).

Consequently, Karyon's architecture specifically demands high-core-count, single-socket topographies (e.g., an AMD Threadripper with an 8-channel memory configuration). Consolidating execution cores to one physical die ensures all threads maintain equal, low-latency access to the entire 512GB Memgraph environment, bypassing the NUMA penalty completely.

## Zero-Copy Shared Memory and BEAM Interoperability

The 8-channel RAM layout permits the BEAM-based execution cells to branch deep into specialized sub-graphs simultaneously without suffocating under memory bandwidth constriction. Providing these cells access to the shared Rust Memgraph, however, necessitates overcoming the friction of isolated memory models.

The BEAM Virtual Machine provides unparalleled soft real-time scheduling by executing millions of lightweight processes within strictly isolated, private memory heaps [[13]](#ref-13). The VMs native shared-nothing architecture requires that all inter-process data routing occurs via physical memory copying. Transporting an analytically traversed subgraph of millions of nodes across the BEAM boundary via standard message passing would force catastrophic memory serialization, entirely negating the optimizations built into the underlying graph database [[14]](#ref-14).

Karyon circumvents this by exposing the shared memory pool via Native Implemented Functions (NIFs) utilizing safe Rust bridges (`Rustler`) [[15]](#ref-15). Because complex pointer-chasing graph traversals take vastly longer than the BEAM's strict microsecond reduction limits, these graph integrations frequently require routing executions through "Dirty Schedulers"—separate thread pools designed to prevent long-running tasks from paralyzing the BEAM's primary actor schedulers [[16]](#ref-16).

These unmanaged memory bridges pose their own engineering realities. By passing "Resource Objects"—tiny, opaque pointers referencing gigabytes of external Rust memory—into the BEAM environment, the internal garbage collector fails to register the substantial external memory weight [[17]](#ref-17). This frequently leads to severe "memory ballooning," requiring deep manual tuning of GC signals to prevent native memory exhaustion [[18]](#ref-18). In heavily virtualized or containerized deployments passing data layers via Virtio-fs backing, engineers have documented massive, aggressive host-level RAM caching that physically starves underlying host filesystems (like the ZFS ARC) from operating smoothly [[19]](#ref-19), [[20]](#ref-20).

## Summary

While the dual-layer graph provides mathematical elegance, its physical operation under extreme concurrency threatens severe database deadlocks. Implementing strict Multi-Version Concurrency Control (MVCC) resolves write blockages but introduces vicious garbage collection cycles and exacerbates NUMA latency overheads, demanding precise hardware constraint tuning to sustain the Elixir-Rust memory bridge.

***

## References

1. <a id="ref-1"></a>Theodorakis, G., Firth, H., Clarkson, J., Crooks, N., & Webber, J. (2025). *TuskFlow: An Efficient Graph Database for Long-Running Transactions*. Proceedings of the VLDB Endowment (PVLDB), Vol. 18(12). [https://doi.org/10.14778/3750601.3750603](https://doi.org/10.14778/3750601.3750603)
2. <a id="ref-2"></a>SciSpace. *An Efficient Built-in Temporal Support in MVCC-based Graph Databases*. [https://scispace.com/pdf/an-efficient-built-in-temporal-support-in-mvcc-based-graph-3vfi8286.pdf](https://scispace.com/pdf/an-efficient-built-in-temporal-support-in-mvcc-based-graph-3vfi8286.pdf)
3. <a id="ref-3"></a>OceanBase. *An efficient and scalable graph database with built-in temporal support*. [https://obbusiness-private.oss-cn-shanghai.aliyuncs.com/resource-download/report/1757311358191/an%20efficient%20and%20scalable%20graph%20database%20with%20built-in%20temporal%20support.pdf](https://obbusiness-private.oss-cn-shanghai.aliyuncs.com/resource-download/report/1757311358191/an%20efficient%20and%20scalable%20graph%20database%20with%20built-in%20temporal%20support.pdf)
4. <a id="ref-4"></a>Böttcher, J., et al. *Scalable Garbage Collection for In-Memory MVCC Systems*. TUM. [https://db.in.tum.de/\~boettcher/p128-boettcher.pdf](https://db.in.tum.de/~boettcher/p128-boettcher.pdf)
5. <a id="ref-5"></a>Tanabe, T., Hoshino, T., Kawashima, H., & Tatebe, O. (2020). *An Analysis of Concurrency Control Protocols for In-Memory Databases with CCBench*. Proceedings of the VLDB Endowment (PVLDB), Vol. 13(13). [https://vldb.org/pvldb/vol13/p3531-tanabe.pdf](https://vldb.org/pvldb/vol13/p3531-tanabe.pdf)
6. <a id="ref-6"></a>Freitag, M. (2020). *Building an HTAP Database System for Modern Hardware*. Technical University of Munich (TUM). [https://mediatum.ub.tum.de/doc/1701534/h00ucpb8na07ercy86r13hd3r.FREITAG\_Michael\_Dissertation.pdf](https://mediatum.ub.tum.de/doc/1701534/h00ucpb8na07ercy86r13hd3r.FREITAG_Michael_Dissertation.pdf)
7. <a id="ref-7"></a>Wu, Y., et al. *An Empirical Evaluation of In-Memory Multi-Version Concurrency Control*. VLDB Endowment. [https://www.vldb.org/pvldb/vol10/p781-Wu.pdf](https://www.vldb.org/pvldb/vol10/p781-Wu.pdf)
8. <a id="ref-8"></a>Huang, K., Wang, T., Zhou, Q., & Meng, Q. (2023). *The Art of Latency Hiding in Modern Database Engines*. Proceedings of the VLDB Endowment (PVLDB), Vol. 17(3). [https://www.vldb.org/pvldb/vol17/p577-huang.pdf](https://www.vldb.org/pvldb/vol17/p577-huang.pdf)
9. <a id="ref-9"></a>Beamer, S., Asanović, K., & Patterson, D. (2015). *Locality Exists in Graph Processing: Workload Characterization on an Ivy Bridge Server*. IEEE International Symposium on Workload Characterization (IISWC). [http://www.scottbeamer.net/pubs/beamer-iiswc2015.pdf](http://www.scottbeamer.net/pubs/beamer-iiswc2015.pdf)
10. <a id="ref-10"></a>Paul, S. K. *Why Memory Proximity decides Performance on modern servers*. Medium. [https://medium.com/@sourav-k-paul/memory-proximity-for-performance-f1be9f8c0a8a](https://medium.com/@sourav-k-paul/memory-proximity-for-performance-f1be9f8c0a8a)
11. <a id="ref-11"></a>Schweizer, T. *Modelling and Evaluating Performance of Atomic Operations*. [https://spcl.inf.ethz.ch/Publications/.pdf/schweizer-thesis-15.pdf](https://spcl.inf.ethz.ch/Publications/.pdf/schweizer-thesis-15.pdf)
12. <a id="ref-12"></a>Reddit. *Zen 5 latency regression - CMPXCHG16B instruction is now executed 35% slower compared to Zen 4*. [https://www.reddit.com/r/hardware/comments/1etpiof/zen\_5\_latency\_regression\_cmpxchg16b\_instruction/](https://www.reddit.com/r/hardware/comments/1etpiof/zen_5_latency_regression_cmpxchg16b_instruction/)
13. <a id="ref-13"></a>Stenman, E. *The BEAM Book: Understanding the Erlang Runtime System*. [https://blog.stenmans.org/theBeamBook/?ref=crustofcode.com](https://blog.stenmans.org/theBeamBook/?ref=crustofcode.com)
14. <a id="ref-14"></a>Stack Overflow. *performance penalty of message passing as opposed to shared data*. [https://stackoverflow.com/questions/1810313/performance-penalty-of-message-passing-as-opposed-to-shared-data](https://stackoverflow.com/questions/1810313/performance-penalty-of-message-passing-as-opposed-to-shared-data)
15. <a id="ref-15"></a>Lerche, J. *Writing Rust NIFs for your Elixir code with the Rustler package*. Medium. [https://medium.com/@jacob.lerche/writing-rust-nifs-for-your-elixir-code-with-the-rustler-package-d884a7c0dbe3](https://medium.com/@jacob.lerche/writing-rust-nifs-for-your-elixir-code-with-the-rustler-package-d884a7c0dbe3)
16. <a id="ref-16"></a>Hacker News. *Elixir and Rust is a good mix*. [https://news.ycombinator.com/item?id=35559925](https://news.ycombinator.com/item?id=35559925)
17. <a id="ref-17"></a>Vrije Universiteit Brussel. *A Distributed Logic Reactive Programming Model and its Application to Monitoring Security*. [https://soft.vub.ac.be/Publications/2019/vub-soft-phd-19-01.pdf](https://soft.vub.ac.be/Publications/2019/vub-soft-phd-19-01.pdf)
18. <a id="ref-18"></a>Elixir Forum. *High memory usage when performance testing simple Rustler NIFs*. [https://elixirforum.com/t/high-memory-usage-when-performance-testing-simple-rustler-nifs/45866](https://elixirforum.com/t/high-memory-usage-when-performance-testing-simple-rustler-nifs/45866)
19. <a id="ref-19"></a>Reddit. *virtio fs is great but why so much memory usage?*. [https://www.reddit.com/r/VFIO/comments/1mq9bia/virtio\_fs\_is\_great\_but\_why\_so\_much\_memory\_usage/](https://www.reddit.com/r/VFIO/comments/1mq9bia/virtio_fs_is_great_but_why_so_much_memory_usage/)
20. <a id="ref-20"></a>Proxmox Support Forum. *Virtiofs - high usage of cached and shared memory*. [https://forum.proxmox.com/threads/virtiofs-high-usage-of-cached-and-shared-memory.165726/](https://forum.proxmox.com/threads/virtiofs-high-usage-of-cached-and-shared-memory.165726/)
