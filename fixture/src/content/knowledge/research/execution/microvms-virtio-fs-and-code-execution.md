---
title: "Architectural Membranes for Untrusted AI Workloads: Synthesizing MicroVM Isolation, Virtio-fs Bridging, and Hypervisor Telemetry"
description: "The rapid maturation of autonomous artificial intelligence (AI) agents and large language model (LLM)-driven code generation has fundamentally upended the trad…"
sidebar:
  label: "Architectural Membranes for Untrusted AI Workloads"
  order: 1
tags:
  - microvm-isolation
  - virtio-fs
  - hypervisor-telemetry
  - untrusted-workloads
---

## **Executive Summary**

The rapid maturation of autonomous artificial intelligence (AI) agents and large language model (LLM)-driven code generation has fundamentally upended the traditional threat models of cloud-native infrastructure. Unlike conventional multi-tenant environments where code is written by relatively trusted human developers, AI agentic workflows generate and execute arbitrary, highly dynamic, and entirely untrusted code on the fly. This machine-generated code presents a unique security hazard: it may contain hallucinated dependencies vulnerable to supply chain attacks, unintentional infinite loops that exhaust system resources, or actively malicious payloads (such as prompt-injected exploits) designed to exfiltrate host data or pivot into adjacent tenant environments.

To safely execute these volatile workloads, modern systems architecture requires a computational "membrane"—a sophisticated isolation layer capable of guaranteeing absolute digital sovereignty without sacrificing the low-latency initialization and high-throughput I/O required for real-time AI execution. Through an exhaustive synthesis of recent academic literature, empirical benchmark data, and systems security proceedings, this report evaluates the efficacy of Kernel-based Virtual Machine (KVM) microVMs paired with paravirtualized file systems (virtio-fs) as the optimal architectural foundation for this membrane.

The academic consensus overwhelmingly demonstrates that traditional shared-kernel containerization (e.g., standard Docker or Linux Containers) is structurally inadequate for untrusted AI code due to a sprawling system call attack surface and the persistent threat of container escapes.1 MicroVM architectures, specifically AWS Firecracker, Cloud Hypervisor, and Kata Containers, resolve this critical vulnerability by enforcing a hardware-assisted virtualization boundary that shrinks the Trusted Computing Base (TCB) while maintaining boot latencies under 125 milliseconds.4

However, achieving absolute hardware isolation introduces profound engineering friction in host-to-guest file sharing and lifecycle orchestration. The literature establishes virtio-fs as the premier solution for bridging the file system divide, leveraging Direct Access (DAX) to bypass the severe latency and small-block degradation inherent to legacy network file systems like NFS and 9p.7 Furthermore, mitigating the "metabolic drain" of rapidly provisioning ephemeral microVMs necessitates advanced snapshotting techniques. Recent academic interventions—such as hardware-accelerated memory compression (Sabre), working-set prefetching (REAP), and byte-addressable persistent memory indexing (PASS)—are required to neutralize the page-fault latency storms inherent to snapshot restoration.10

Finally, the challenge of synchronizing cross-boundary telemetry and stack traces without piercing the security membrane is addressed through modern Virtual Machine Introspection (VMI) frameworks and the delegation of userspace Berkeley Packet Filter (uBPF) programs to the hypervisor.14 Together, the synthesis of KVM microVMs, virtio-fs, and uBPF-driven telemetry provides a highly performant, mathematically rigorous architecture capable of securely containing the outputs of modern artificial intelligence.

## **Defining Digital Sovereignty: Literature on KVM/QEMU Isolation vs. Shared-Kernel Risks**

The concept of digital sovereignty within cloud infrastructure dictates that a workload must be absolutely contained within a designated cryptographic and physical perimeter. The workload must be mathematically and practically unable to access, infer, or manipulate the host operating system, adjacent hypervisor memory, or co-resident tenant processes. When deploying AI-generated code—which operates as a black box of potentially hostile instructions—the architectural boundary defining this sovereignty is the single most critical engineering decision.16

### **The Structural Vulnerability of Shared-Kernel Architectures**

For the past decade, the industry standard for high-density workload deployment has been containerization, governed by runtimes such as Docker, containerd, and runc. Containers operate on a shared-kernel architecture, utilizing native Linux kernel primitives to project an illusion of isolation.1 Specifically, containers rely on namespaces for visibility isolation (restricting what a process can see, such as process IDs and mount points), cgroups for resource metering (limiting CPU and memory consumption), and seccomp profiles or Linux Security Modules (LSMs) like AppArmor and SELinux for system call filtering.1

While this model is exceptionally efficient, yielding near-zero boot overhead and maximum density, it presents a catastrophic failure mode when exposed to untrusted code. The isolation is entirely software-defined, enforced by the very same monolithic kernel that the untrusted code interacts with.2 The Linux kernel exposes a vast user-to-host interface, commonly supporting over 300 highly complex system calls.1 If an AI-generated payload contains a zero-day exploit or leverages a known memory corruption vulnerability (such as a use-after-free or out-of-bounds write) within any of these kernel subsystems, the payload can trigger a container escape.

Because the kernel is simultaneously the entity executing the container and the entity meant to protect the host from the container, a compromised shared kernel immediately grants the attacker root-level privileges to the underlying physical node and, by extension, all co-resident containers.2 Systems security literature points out that over 50% of real-world container escapes are successful precisely because the boundary never moves off the host operating system.3

Even when direct memory corruption is averted, shared kernels remain deeply susceptible to side-channel attacks, covert communication channels, and abstract resource exhaustion. Malicious code can probe the /proc and /sys virtual filesystems to map host topology, detect co-tenants, and infer sensitive data through timing attacks or power consumption counters.3 Furthermore, attackers can intentionally exhaust abstract kernel resources—such as network queues, slab caches, and file descriptors—initiating cross-tenant Denial-of-Service (DoS) conditions.3 Academic attempts to mitigate these shared-kernel flaws include userspace isolation architectures like LITESHIELD, which intercepts and serves most Linux syscalls in userspace via inter-process communication (IPC), reducing the host attack surface to a mere 22 syscalls.1 However, for executing arbitrary, untrusted AI scripts, even hardened shared-kernel membranes are deemed architecturally insufficient.

### **The MicroVM Paradigm: Hardware-Enforced Sovereignty**

To address the sovereignty deficit of standard containers while preserving the operational velocity required for serverless AI agent invocation, systems literature and industry practice have converged on lightweight Virtual Machine Monitors (VMMs), commonly known as microVMs. Leading implementations include AWS Firecracker, Intel's Cloud Hypervisor, and the Kata Containers framework.4

MicroVMs leverage hardware-assisted virtualization extensions (such as Intel VT-x and AMD-V) via the Linux Kernel-based Virtual Machine (KVM) module. In this architecture, each workload is encapsulated within its own dedicated guest operating system and guest kernel, governed by hardware-enforced nested paging (Extended Page Tables).2 If an AI agent executes a payload that successfully exploits a kernel vulnerability, the blast radius is strictly contained within the ephemeral guest OS; the host OS and other tenants remain physically and cryptographically insulated by the CPU's virtualization ring boundary (Root vs. Non-Root mode).2

Firecracker represents the archetypal implementation of this philosophy. Developed at AWS to secure Lambda and Fargate workloads, Firecracker is written in Rust—a systems programming language that guarantees memory and thread safety, thereby eliminating entire classes of buffer overflow and use-after-free vulnerabilities within the hypervisor itself.6

To fully understand Firecracker's contribution to digital sovereignty, one must contrast it with traditional VMMs like QEMU. QEMU was designed for general-purpose virtualization and comprises over 1.4 million lines of C code.4 It achieves broad compatibility by emulating a massive array of legacy hardware, including USB controllers, PCI buses, floppy drives, and complex BIOS routines. This broad functionality yields an unacceptably large attack surface for untrusted workloads.4

Firecracker deliberately abandons compatibility in favor of minimalism. It strips the device model down to the absolute bare minimum required to boot a modern Linux kernel, resulting in a VMM consisting of roughly 50,000 lines of code—a 96% reduction compared to QEMU.4 Firecracker implements no PCI bus, no BIOS, and no display drivers. It provides only five emulated paravirtualized devices: virtio-net for networking, virtio-block for storage, virtio-vsock for host-guest communication, a serial console, and a minimal single-button keyboard controller used solely to signal power resets.4 By moving the security-critical interface from the sprawling Linux system call boundary to this highly restricted, hardware-supported VirtIO boundary, microVMs achieve near-bare-metal security.24

### **The Limits of Sovereignty: Operation Forwarding and Microarchitectural Threats**

Despite the robust mathematical guarantees of KVM/QEMU and microVM architectures, recent security literature explicitly warns that digital sovereignty is never absolute. The hypervisor inherently must provide operational services to the guest, creating a necessary but highly vulnerable bridge.

Research introduced at recent USENIX Security Symposia has demonstrated a novel class of vulnerabilities against microVM-based containers termed "operation forwarding attacks".19 The core vulnerability lies in the fact that certain guest operations—such as hardware timer adjustments or complex network routing—cannot be resolved entirely within the guest and must be forwarded to the host kernel or host userspace daemon for execution.19

Attackers controlling an untrusted AI guest can intentionally generate highly specific, high-frequency operations that force the host kernel to execute out-of-band workloads, exhausting host resources and breaking multi-tenant isolation. For instance, an attacker might write continuously to specific hardware ports (e.g., port 0x43) to manipulate the legacy Programmable Interval Timer (PIT).26 In a standard KVM environment, this triggers a continuous stream of VM-exits, forcing KVM to wake up host kernel threads to inject timer interrupts back into the guest.26

Empirical evaluations of operation forwarding attacks demonstrate devastating efficacy. By forcing kvm-pit threads or vhost-net backends into hyperactive states, malicious containers can consume up to 68% of the host's physical CPU resources.19 This induces a severe Denial-of-Service (DoS) condition across the physical node. Benchmarks indicate that victim microVMs sharing the host suffer a 75% to 86.6% downgrade in CPU performance and a 64.6% downgrade in I/O throughput.19 Furthermore, vulnerabilities in paravirtualized device backends (such as the virtiofsd daemon) can sometimes be exploited to achieve host-level privilege escalation, entirely bypassing the microVM membrane.26

Beyond software-level operation forwarding, microVMs must contend with hardware-level microarchitectural threats. While hardware boundaries stop memory corruption, they are inherently vulnerable to speculative execution vulnerabilities like Spectre and Meltdown.25 Recent findings highlight vulnerabilities such as Branch Predictor Race Conditions (BPRC) and Branch Privilege Injection (BPI).28 These attacks exploit the asynchronous nature of branch resolution and privilege domain feedback in modern Intel processors. By violating the hardware-enforced context separation mechanisms across the indirect branch predictor barriers, an attacker in guest user-mode can inject arbitrary branch predictions tagged with kernel privilege, leaking arbitrary host kernel memory at rates of 5.6 KiB/s across the hypervisor boundary.28

To enforce digital sovereignty against these advanced threats, systems architects must employ defense-in-depth. This involves not only utilizing microVMs but also strictly sandboxing the VMM processes themselves. In production, the Firecracker VMM binary is wrapped in a jailer process that utilizes chroot to isolate the file system, deeply restrictive cgroups to cap host resource consumption, and stringent seccomp-bpf filters that limit the Firecracker process to an infinitesimally small set of permitted host system calls.23 Additionally, the adoption of Confidential Virtual Machines (CVMs) leveraging AMD SEV-SNP (Secure Encrypted Virtualization) or Intel TDX (Trust Domain Extensions) offers a path to encrypt guest memory in hardware, protecting the AI workload even from a fully compromised host hypervisor.31

## ---

**Virtio-fs: Bridging the Divide**

Executing AI-generated code within an isolated microVM necessitates a mechanism for the host and guest to share files. AI agents frequently require access to massive foundation model weights, complex dependency trees (e.g., Python site-packages or Node node\_modules), deeply nested workspace directories, and large structured datasets.34 Copying these files over the network or duplicating them into the ephemeral VM's block device at boot time completely destroys the millisecond-level latency advantages of the microVM architecture.7 Thus, the architectural imperative is a shared file system that bridges the host-guest divide, allowing near-native I/O performance without compromising the KVM isolation boundary.

### **The Bottleneck of Traditional Networked File Systems**

Historically, virtualized environments relied on traditional networked file systems, such as the Network File System (NFS) or the Plan 9 filesystem protocol (9p), to facilitate host-guest directory sharing. However, extensive empirical studies in the systems literature identify these protocols as catastrophic performance bottlenecks in high-throughput, latency-sensitive environments.

The 9p protocol, heavily utilized in legacy configurations of Kata Containers and Google's gVisor, suffers from severe architectural degradation due to heavy virtualization overhead and synchronous request transfers.8 Every file operation in 9p requires the guest kernel to serialize a request, trigger a VM-exit, pass the data through the hypervisor to a host-side daemon (like the gVisor "Gofer"), await the host filesystem operation, and then undergo the reverse process.8 In comprehensive benchmark studies measuring both sequential and random read/write throughput, 9p routinely exhibits the lowest performance across all shared file system variants, rendering it unviable for I/O-intensive AI workloads.8

NFS presents a slightly more complex empirical profile. When configured with the host acting as the NFS server and the microVM guest as the client, all local guest I/O must be dispatched through the virtual network stack and processed via the complex NFS protocol state machine.8 While some synthetic benchmarks using highly threaded tools like fio have shown NFS outperforming naive, unoptimized virtual file systems in strictly sequential large-block throughput over high-bandwidth virtual links (e.g., achieving 700 MiB/s for sequential reads) 35, these raw throughput numbers obscure severe operational deficiencies.

Academic literature highlights that NFS suffers catastrophic performance collapse when handling the metadata-heavy, small-block random access patterns typical of code execution and dependency loading. In empirical tests of 1KB block writes, NFS throughput plummeted to approximately 0.03 Mb/s.8 Furthermore, NFS relies on eventual consistency caching models that fail to guarantee strict POSIX local file system semantics, leading to race conditions and corruption when AI agents attempt to rapidly compile code, lock files, or manipulate SQLite databases across the boundary.7

### **The Architecture and Empirical Superiority of Virtio-fs**

To mitigate these systemic inefficiencies, Red Hat and the KVM community developed virtio-fs specifically to optimize host-to-guest file sharing by exploiting the physical co-location of the virtual machine and the hypervisor.7

The architecture of virtio-fs fundamentally alters the data path, bypassing traditional network protocol stacks entirely. On the guest side, a specialized virtiofs.ko FUSE (Filesystem in Userspace) client driver translates standard Linux VFS operations into virtio queue messages.7 These messages are transported via shared memory rings over the PCI bus to the host. On the host side, a heavily sandboxed daemon (virtiofsd) runs in user space, servicing these requests via the vhost-user protocol.7

However, passing data through virtio queues still incurs the latency of VM-exits and memory copying. The critical, paradigm-shifting innovation of virtio-fs is its integration with Direct Access (DAX). Through the DAX mechanism, the guest FUSE driver can request specific file fragments, and the hypervisor (e.g., QEMU or Cloud Hypervisor) maps these fragments directly into a dedicated PCI-BAR (Base Address Register) accessible to the guest.7

This mechanism creates a direct memory-mapped "window" into the host's unified page cache. By utilizing mmap under the hood, virtio-fs with DAX completely eliminates redundant data copies between host and guest memory, circumvents hypervisor communication (VM-exits) for file data access, and provides true local file system POSIX coherency.7

Furthermore, virtio-fs drastically reduces the memory overhead of high-density multi-tenant environments. If a server is running 100 isolated AI microVMs that all require access to the same 5GB read-only machine learning model or Python standard library, traditional VMs would load that 5GB file into each of the 100 guest page caches, consuming 500GB of RAM. With virtio-fs DAX, the 5GB file is loaded exactly once into the host page cache, and all 100 microVMs map the identical physical memory pages into their virtual address space, effectively reducing the memory footprint by 99%.7

**Table 1: Empirical Consensus on File Sharing Performance Across Virtualization Boundaries**

| Metric / Workload              | 9p (Plan 9 Protocol)        | NFS (Network File System)          | Virtio-fs (with DAX)                | Source Correlation |
| :----------------------------- | :-------------------------- | :--------------------------------- | :---------------------------------- | :----------------- |
| **Small-Block Writes (1KB)**   | Poor                        | Severe degradation (\~0.03 Mb/s)   | **Optimal** (Near bare-metal)       | 8                  |
| **Sequential Raw Throughput**  | Moderate                    | High (with async large blocks)     | Variable (Cache-mode dependent)     | 35                 |
| **Metadata Operations (Stat)** | Extremely Slow              | Network latency bound              | **Fast** (Shared memory versioning) | 7                  |
| **Memory Overhead**            | High (Complete duplication) | High (Duplication in guest & host) | **Low** (Host page cache mapping)   | 7                  |
| **POSIX Semantics**            | Partial                     | Eventual Consistency               | **Strict** (Local file coherency)   | 7                  |

Academic studies confirming the efficacy of virtio-fs demonstrate that when DAX is enabled, it uniformly outperforms both NFS and 9p across diverse benchmark categories, specifically optimizing the latency-sensitive operations inherent to secure containers.8 Modern high-performance iterations, such as the DPFS framework presented at the USENIX FAST conference, have extended virtio-fs by decoupling the host from its file system and virtualizing it onto Data Processing Units (DPUs) or SmartNICs. By offloading nvme-fs operations to the DPU, these systems demonstrate sub-500 microsecond latencies for metadata-heavy file accesses, a 69% reduction in host CPU consumption, and up to a 40% performance increase in heavy compute benchmarks compared to standard kernel architectures.38

## ---

**The Engineering Reality: Navigating Friction**

While the combination of minimal KVM microVMs and virtio-fs establishes a theoretically secure and highly performant baseline, the practical realities of operating an elastic AI agent infrastructure introduce two distinct forms of operational friction: the "metabolic drain" incurred during the aggressive lifecycle provisioning of ephemeral virtual machines, and the opacity of cross-boundary telemetry when debugging deeply isolated, failing code.

### **Metabolic Friction: The Boot-Time Overhead of Ephemeral VMs**

In serverless and AI agentic architectures, workloads are highly ephemeral and fiercely latency-sensitive. A user interacting with an LLM might request a data transformation; the system must instantaneously provision a secure sandbox, execute the generated Python code against a dataset, return the result to the user, and immediately destroy the sandbox to free resources. This "synchronous pacing" requires hypervisors to rapidly spawn and tear down thousands of KVM instances concurrently. The CPU cycles, memory allocations, and latency consumed simply to initialize these isolation environments constitute a massive "metabolic drain" on the host infrastructure.11

Traditional virtual machines exhibit cold start latencies measured in tens of seconds—a delay entirely unacceptable for synchronous API responses.20 Firecracker was explicitly engineered to eradicate this friction, establishing an industry benchmark of booting a minimal Linux kernel to user-space application code in under 125 milliseconds.4 It supports the creation of up to 150 microVMs per second per host, utilizing a RESTful API to configure vCPUs, memory, and TAP network interfaces instantly.4 This extreme metabolic efficiency allows modern datacenters to achieve exceptional workload density, hosting upwards of 8,000 concurrent functions on a standard 1TB RAM commodity server.4

However, as AI workloads become more complex, initializing the software runtime environment (e.g., loading the Python interpreter, mounting file systems, and importing massive machine learning libraries like PyTorch or TensorFlow) takes substantially longer than booting the VM itself, frequently pushing total initialization latency past 1-2 seconds.45 To compress this end-to-end latency back into the single-digit millisecond range, the systems research community has heavily invested in **MicroVM Snapshotting**.

Snapshotting (often branded as SnapStart) involves pre-booting a microVM, fully initializing the runtime environment and heavy libraries, and then pausing the VM. The hypervisor serializes the exact CPU state, device registers, and physical memory of the VM into a file on disk.11 When a function is invoked, the system bypasses the boot process entirely, cloning the snapshot file, mapping it into memory using mmap, and resuming execution.47

Yet, snapshotting merely replaces initialization CPU friction with I/O friction. Because the snapshot memory is mapped using lazy loading (on-demand paging), the newly resumed guest memory is essentially empty. Every time the AI agent attempts to execute an instruction or access a variable on an unmapped memory page, it triggers a page fault. The CPU traps into the hypervisor via a VM-exit, the host operating system locates the specific page in the snapshot file on disk, initiates a DMA transfer into physical RAM, updates the Extended Page Tables (EPT), and resumes the guest.11 This phenomenon, known as a "page fault storm," severely degrades the execution time of the function immediately after restoration, resulting in execution times up to 95% slower than memory-resident functions.12

To navigate this I/O friction, recent academic literature details several novel hypervisor optimizations:

1. **Hardware-Accelerated Memory Decompression (Sabre):** Presented at the USENIX OSDI conference, the Sabre framework addresses the high CPU cost of restoring memory snapshots. Sabre leverages the near-memory analytics accelerators (such as Intel IAA) increasingly embedded in modern datacenter processors to achieve lossless memory page compression.10 By compressing microVM snapshots up to 4.5× and managing the dirty memory pages as contiguous regions, Sabre facilitates highly efficient Direct Memory Access (DMA) operations, accelerating memory restoration by 55% and virtually eliminating the software decompression bottleneck.10
2. **Working Set Prefetching (REAP):** Research indicates that serverless functions access a highly stable "working set" of memory pages across different invocations. The REAP framework profiles guest memory access during an initial execution and records this working set. Upon subsequent snapshot restorations, REAP proactively prefetches these specific pages from disk into memory asynchronously, slashing the page fault storm and reducing cold-start delays by 3.7× compared to baseline lazy loading.12
3. **Persistent Memory Execution (PASS):** Leveraging byte-addressable persistent memory (PMEM), the PASS system acts as a PMEM-aware augmented hypervisor. It constructs a complete address index of the guest memory mapped directly to a single-tier PMEM space. This permits zero-copy, on-demand paging by exploiting PMEM's direct access feature, completely bypassing traditional host page cache layers. Experimental evaluations demonstrate that PASS reduces SnapStart execution times by up to 72% compared to standard Firecracker instances.11

**Table 2: Comparative Analysis of MicroVM Cold-Start Mitigation Strategies**

| Mitigation Strategy        | Primary Mechanism                    | Key Advantage                               | Performance Impact                               | Source |
| :------------------------- | :----------------------------------- | :------------------------------------------ | :----------------------------------------------- | :----- |
| **Baseline Firecracker**   | Stripped VMM + Custom minimal Kernel | No snapshot state required; highly secure   | \~125ms kernel boot, high runtime init cost      | 4      |
| **Lazy-Load Snapshotting** | Pre-booted state mmap'd on demand    | Near-instant resume (<10ms)                 | Severe "Page Fault Storms" (+95% execution time) | 12     |
| **Sabre**                  | Hardware-Accelerated (De)compression | Lowers I/O bottleneck via 4.5x compression  | 55% faster memory restoration                    | 10     |
| **REAP**                   | Proactive Working Set Prefetching    | Masks fault latency by loading stable pages | 3.7x reduction in cold-start delay               | 12     |
| **PASS**                   | Byte-addressable PMEM direct mapping | Zero-copy paging, bypasses OS cache         | 72% reduction in SnapStart execution time        | 11     |

### **Cross-Boundary Telemetry and The Semantic Gap**

The absolute isolation provided by KVM microVMs generates a secondary, equally complex engineering challenge: observability. When an AI-generated script fails, enters an infinite loop, or attempts malicious lateral movement, the orchestration platform requires real-time telemetry, precise stack traces, and granular failure data to debug the agent's behavior and enforce security policies.15 However, directly probing the guest from the host violates the very sovereignty the microVM was built to enforce. Conversely, installing traditional observability agents (like Datadog or Prometheus) inside the untrusted guest consumes valuable memory resources, slows down boot times, and provides a target for malicious code to tamper with the telemetry logs.15

This problem is codified in academic literature as the "Semantic Gap." A hypervisor running on the host views the guest environment purely as an array of raw physical memory pages, CPU registers, and disk blocks. It has no inherent understanding of the guest OS's internal abstractions, such as process IDs, network sockets, active file paths, or function call stacks.14

To safely synchronize telemetry across this hardware boundary without deploying in-guest agents, systems research relies on **Virtual Machine Introspection (VMI)** and Extended Berkeley Packet Filter (eBPF) technologies.15 Frameworks like Goalkeeper demonstrate the viability of asynchronous, stateless VMI to inspect guest data structures from the host hypervisor. By mapping the raw guest physical memory and translating the specific kernel data structures (accounting for "kernel drift" between OS versions), VMI tools can actively monitor process creation and memory allocation in real time, securely hidden from the guest's view\.15 Similarly, tools like vNetTracer encapsulate network tracing logic into eBPF scripts that are injected at specific tracepoints across the virtualization boundary, entirely decoupling the monitoring logic from the untrusted execution environment.52

The most advanced iteration of cross-boundary synchronization currently represented in the literature is the **RosenBridge** framework, presented at the USENIX FAST conference. RosenBridge elegantly bridges the semantic gap by introducing a new paravirtualized device called virtio-ndp paired with userspace BPF (uBPF).14

Historically, running eBPF programs required injecting code into the highly privileged host kernel, presenting severe security risks if the BPF bytecode was malformed or actively malicious. RosenBridge mitigates this by executing uBPF programs in a secure, isolated sandbox within the host userspace hypervisor (e.g., QEMU or Firecracker).14 By connecting the virtio-ndp backend directly to the host's high-performance asynchronous I/O stack (io\_uring), RosenBridge allows the guest to safely offload telemetry logic, packet tracing, and Near-Data Processing (NDP) operations directly to the hypervisor.14

To definitively resolve the semantic gap, RosenBridge shares a strict memory region containing contextual guest metadata and utilizes specialized uBPF helper functions to execute secure Guest-Physical-Address (GPA) to Host-Physical-Address (HPA) translations.14 This architecture represents the apex of current telemetry literature: it synchronizes real-time execution states and I/O routing logic across the hypervisor boundary, strictly metering resource quotas via collaborative multi-path throttling to ensure multi-tenant fairness, all without ever piercing the cryptographic and hardware isolation of the guest VM.14

## **Annotated Selection of Key Academic Sources**

Below is a curated selection of the most relevant peer-reviewed academic literature outlining the foundational trade-offs in microVM isolation, virtio-fs bridging, and hypervisor telemetry.

**1. "Firecracker: Lightweight Virtualization for Serverless Applications"**
*Agache et al., USENIX Symposium on Networked Systems Design and Implementation (NSDI), 2020.*

4

**Relevance:** This is the seminal industry paper defining the architecture and operational parameters of the Firecracker microVM. It explicitly details the reduction of the VMM attack surface (utilizing roughly 50,000 lines of memory-safe Rust), the elimination of legacy QEMU device bloat, and provides the empirical benchmarks proving sub-125ms boot times and <5MB memory overheads. This work established the current baseline for digital sovereignty in highly concurrent serverless and AI contexts.

**2. "Attacks are Forwarded: Breaking the Isolation of MicroVM-based Containers Through Operation Forwarding"**
*Xiao et al., 32nd USENIX Security Symposium, 2023.*

19

**Relevance:** Acting as a critical counter-weight to the assumption that microVMs are impenetrable, this vital security research highlights the limits of hypervisor isolation. It proves that the necessary bridging of virtualized resources (via KVM HPET, PIT timers, or vhost-net) enables untrusted guests to launch "operation forwarding attacks," forcing the host kernel into out-of-band resource exhaustion and breaking multi-tenant performance guarantees.

**3. "RosenBridge: A Framework for Enabling Express I/O Paths Across the Virtualization Boundary"**
*Qiu et al., USENIX Conference on File and Storage Technologies (FAST), 2026.*

14

**Relevance:** Highly relevant for resolving the "semantic gap" and mitigating cross-boundary telemetry friction. This paper introduces the paravirtualized virtio-ndp device paired with userspace BPF (uBPF), allowing safe, hardware-isolated guests to offload complex tracing, debugging, and near-data processing logic directly to the host's asynchronous I/O stack (io\_uring) without compromising the security posture of the host kernel.

**4. "Sabre: Hardware-Accelerated Snapshotting for Serverless Applications"**
*Lazarev et al., USENIX Symposium on Operating Systems Design and Implementation (OSDI), 2024.*

10

**Relevance:** Directly addresses the "metabolic friction" of rapidly restoring ephemeral virtual machines. The paper demonstrates how leveraging near-memory hardware accelerators for lossless memory page compression can mitigate the devastating page-fault latency storms associated with microVM snapshot restoration, speeding up memory restoration by 55% for short-lived workloads.

**5. "REAP: Prefetching Working Sets for Serverless Hosts"**
*Ustiugov et al., arXiv / vHive Framework Research, 2021.*

12

**Relevance:** Provides deep empirical evaluation of the severe latency tax incurred when booting Firecracker instances from memory snapshots via lazy loading. By profiling guest memory access patterns and building a software mechanism to proactively prefetch the "stable working set" of memory pages from disk, this research demonstrates how to cut snapshot cold-start delays by 3.7x, proving vital for the synchronous pacing required by interactive AI agents.

**6. "Fisc: A Large-scale Cloud-native-oriented File System"**
*Li et al., 21st USENIX Conference on File and Storage Technologies (FAST), 2023.*

38

**Relevance:** Extends the empirical evaluation of the virtio-fs bridging protocol. By adapting virtio-fs paravirtualization to run over modern Data Processing Units (DPUs) and SmartNICs, this paper proves the technology's superiority in multi-tenant cloud environments, demonstrating sub-500 microsecond latencies for metadata-heavy file accesses and providing a highly scalable blueprint for AI workload storage routing.

#### **Works cited**

1. LITESHIELD: Secure Containers via Lightweight, Composable Userspace μKernel Services - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/atc25-manakkal.pdf](https://www.usenix.org/system/files/atc25-manakkal.pdf)
2. Virtualization security in cloud computing: A comprehensive guide - Infosec, accessed March 7, 2026, [https://www.infosecinstitute.com/resources/cloud/virtualization-security/](https://www.infosecinstitute.com/resources/cloud/virtualization-security/)
3. Secure Container Runtimes. VMs for isolation. Containers for… | by ijlal | Medium, accessed March 7, 2026, [https://medium.com/@sekyourityblog/secure-container-runtimes-df440e2b456e](https://medium.com/@sekyourityblog/secure-container-runtimes-df440e2b456e)
4. Firecracker: Lightweight Virtualization for Serverless Applications - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/nsdi20-paper-agache.pdf](https://www.usenix.org/system/files/nsdi20-paper-agache.pdf)
5. How AWS's Firecracker virtual machines work - Amazon Science, accessed March 7, 2026, [https://www.amazon.science/blog/how-awss-firecracker-virtual-machines-work](https://www.amazon.science/blog/how-awss-firecracker-virtual-machines-work)
6. What is AWS Firecracker? The microVM technology, explained | Blog - Northflank, accessed March 7, 2026, [https://northflank.com/blog/what-is-aws-firecracker](https://northflank.com/blog/what-is-aws-firecracker)
7. virtio-fs - Stefan Hajnoczi, accessed March 7, 2026, [https://vmsplice.net/\~stefan/virtio-fs\_%20A%20Shared%20File%20System%20for%20Virtual%20Machines.pdf](https://vmsplice.net/~stefan/virtio-fs_%20A%20Shared%20File%20System%20for%20Virtual%20Machines.pdf)
8. A Study of Performance and Security Across the Virtualization Spectrum - SciSpace, accessed March 7, 2026, [https://scispace.com/pdf/a-study-of-performance-and-security-across-the-2awjyf9gwe.pdf](https://scispace.com/pdf/a-study-of-performance-and-security-across-the-2awjyf9gwe.pdf)
9. VirtIO-FS: A Proposed Better Approach For Sharing Folders/Files With Guest VMs - Phoronix, accessed March 7, 2026, [https://www.phoronix.com/news/VirtIO-FS-Folder-Sharing-VM](https://www.phoronix.com/news/VirtIO-FS-Folder-Sharing-VM)
10. Sabre: Hardware-Accelerated Snapshot Compression for Serverless MicroVMs | USENIX, accessed March 7, 2026, [https://www.usenix.org/conference/osdi24/presentation/lazarev](https://www.usenix.org/conference/osdi24/presentation/lazarev)
11. Expeditious High-Concurrency MicroVM SnapStart in Persistent Memory with an Augmented Hypervisor - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/atc24-pang.pdf](https://www.usenix.org/system/files/atc24-pang.pdf)
12. Benchmarking, Analysis, and Optimization of Serverless Function Snapshots - arXiv, accessed March 7, 2026, [https://arxiv.org/abs/2101.09355](https://arxiv.org/abs/2101.09355)
13. Sabre: Hardware-Accelerated Snapshot Compression for Serverless MicroVMs - Computer Systems Laboratory, accessed March 7, 2026, [https://www.csl.cornell.edu/\~zhiruz/pdfs/sabre-osdi2024.pdf](https://www.csl.cornell.edu/~zhiruz/pdfs/sabre-osdi2024.pdf)
14. RosenBridge: A Framework for Enabling Express I/O Paths Across the Virtualization Boundary - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/fast26-qiu.pdf](https://www.usenix.org/system/files/fast26-qiu.pdf)
15. Cloud-Ready Hypervisor-Based Security - DTIC, accessed March 7, 2026, [https://apps.dtic.mil/sti/trecms/pdf/AD1056543.pdf](https://apps.dtic.mil/sti/trecms/pdf/AD1056543.pdf)
16. Hyperlight Nanvix: POSIX support for Hyperlight Micro-VMs - Microsoft Open Source, accessed March 7, 2026, [https://opensource.microsoft.com/blog/2026/1/28/hyperlight-nanvix-bringing-multi-language-support-for-extremely-fast-hardware-isolated-micro-vms](https://opensource.microsoft.com/blog/2026/1/28/hyperlight-nanvix-bringing-multi-language-support-for-extremely-fast-hardware-isolated-micro-vms)
17. Daytona vs E2B in 2026: which sandbox for AI code execution? | Blog - Northflank, accessed March 7, 2026, [https://northflank.com/blog/daytona-vs-e2b-ai-code-execution-sandboxes](https://northflank.com/blog/daytona-vs-e2b-ai-code-execution-sandboxes)
18. Container Escape Vulnerabilities: AI Agent Security for 2026 | Blaxel Blog, accessed March 7, 2026, [https://blaxel.ai/blog/container-escape](https://blaxel.ai/blog/container-escape)
19. Attacks are Forwarded: Breaking the Isolation of MicroVM-based Containers Through Operation Forwarding - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/sec23fall-prepub-591-xiao-jietao.pdf](https://www.usenix.org/system/files/sec23fall-prepub-591-xiao-jietao.pdf)
20. GRP-0176 A Comparative Analysis of Traditional Virtual Machines and Micro Virtual Machines - Digital Commons\@Kennesaw State University, accessed March 7, 2026, [https://digitalcommons.kennesaw.edu/cgi/viewcontent.cgi?article=1633\&context=cday](https://digitalcommons.kennesaw.edu/cgi/viewcontent.cgi?article=1633\&context=cday)
21. How to sandbox AI agents in 2026: MicroVMs, gVisor & isolation strategies | Blog, accessed March 7, 2026, [https://northflank.com/blog/how-to-sandbox-ai-agents](https://northflank.com/blog/how-to-sandbox-ai-agents)
22. Hypervisor-assisted Debugging - sanctuary.dev, accessed March 7, 2026, [https://sanctuary.dev/en/blog/hypervisor-assisted-debugging/](https://sanctuary.dev/en/blog/hypervisor-assisted-debugging/)
23. Announcing the Firecracker Open Source Technology: Secure and Fast microVM for Serverless Computing - AWS, accessed March 7, 2026, [https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/](https://aws.amazon.com/blogs/opensource/firecracker-open-source-secure-fast-microvm-serverless/)
24. Tech Boundary Between MicroVMs and Containers | by AgentBox - Medium, accessed March 7, 2026, [https://medium.com/@AgentBox/tech-boundary-between-microvms-and-containers-4dda72965cdc](https://medium.com/@AgentBox/tech-boundary-between-microvms-and-containers-4dda72965cdc)
25. Paper Reading Questions - MIT CSAIL Computer Systems Security Group, accessed March 7, 2026, [https://css.csail.mit.edu/6.5660/2024/questions.html?q=q-firecracker\&lec=2](https://css.csail.mit.edu/6.5660/2024/questions.html?q=q-firecracker\&lec=2)
26. Breaking the Isolation of MicroVM-based Containers Through Operation Forwarding - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/usenixsecurity23-xiao-jietao.pdf](https://www.usenix.org/system/files/usenixsecurity23-xiao-jietao.pdf)
27. Microarchitectural Security of AWS Firecracker VMM for Serverless Cloud Platforms - arXiv.org, accessed March 7, 2026, [https://arxiv.org/pdf/2311.15999](https://arxiv.org/pdf/2311.15999)
28. USENIX Security '25 Technical Sessions, accessed March 7, 2026, [https://www.usenix.org/conference/usenixsecurity25/technical-sessions](https://www.usenix.org/conference/usenixsecurity25/technical-sessions)
29. Study of Firecracker MicroVM - arXiv, accessed March 7, 2026, [https://arxiv.org/pdf/2005.12821](https://arxiv.org/pdf/2005.12821)
30. Firecracker – Lightweight Virtualization for Serverless Computing | AWS News Blog, accessed March 7, 2026, [https://aws.amazon.com/blogs/aws/firecracker-lightweight-virtualization-for-serverless-computing/](https://aws.amazon.com/blogs/aws/firecracker-lightweight-virtualization-for-serverless-computing/)
31. Confidential VMs Explained: An Empirical Analysis of AMD SEV-SNP and Intel TDX - Systems Research Group, accessed March 7, 2026, [https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf](https://dse.in.tum.de/wp-content/uploads/2024/11/sigmetrics25summer-CVM-Explained.pdf)
32. Confidential Kubernetes: Use Confidential Virtual Machines and Enclaves to improve your cluster security, accessed March 7, 2026, [https://kubernetes.io/blog/2023/07/06/confidential-kubernetes/](https://kubernetes.io/blog/2023/07/06/confidential-kubernetes/)
33. Serverless Functions Made Confidential and Efficient with Split Containers - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/usenixsecurity25-shi-jiacheng.pdf](https://www.usenix.org/system/files/usenixsecurity25-shi-jiacheng.pdf)
34. Secure Code Execution for the Age of Autonomous AI Agents | by Vlad Kolesnikov - Medium, accessed March 7, 2026, [https://medium.com/google-cloud/secure-code-execution-for-the-age-of-autonomous-ai-agents-d52e7acd6c5d](https://medium.com/google-cloud/secure-code-execution-for-the-age-of-autonomous-ai-agents-d52e7acd6c5d)
35. Poor VirtioFS Performance : r/Proxmox - Reddit, accessed March 7, 2026, [https://www.reddit.com/r/Proxmox/comments/17oi5rx/poor\_virtiofs\_performance/](https://www.reddit.com/r/Proxmox/comments/17oi5rx/poor_virtiofs_performance/)
36. I want to like VirtIOFS, but... - Proxmox Support Forum, accessed March 7, 2026, [https://forum.proxmox.com/threads/i-want-to-like-virtiofs-but.164833/](https://forum.proxmox.com/threads/i-want-to-like-virtiofs-but.164833/)
37. VirtIO-FS Sent In For Linux 5.4 With Better Performance Over VirtIO-9P - Phoronix, accessed March 7, 2026, [https://www.phoronix.com/news/Linux-5.4-VirtIO-FS](https://www.phoronix.com/news/Linux-5.4-VirtIO-FS)
38. Fisc - A Large-Scale Cloud-native-Oriented File System | PDF | Computer Network - Scribd, accessed March 7, 2026, [https://www.scribd.com/document/656321043/Fisc-A-Large-scale-Cloud-native-Oriented-File-System](https://www.scribd.com/document/656321043/Fisc-A-Large-scale-Cloud-native-Oriented-File-System)
39. This paper is included in the Proceedings of the 21st USENIX Conference on File and Storage Technologies. Fisc: A Large-scale, accessed March 7, 2026, [https://www.usenix.org/system/files/fast23-li-qiang.pdf](https://www.usenix.org/system/files/fast23-li-qiang.pdf)
40. A survey on heterogeneous computing using SmartNICs and emerging data processing units - Scholars' Mine, accessed March 7, 2026, [https://scholarsmine.mst.edu/cgi/viewcontent.cgi?article=3134\&context=comsci\_facwork](https://scholarsmine.mst.edu/cgi/viewcontent.cgi?article=3134\&context=comsci_facwork)
41. A Survey on Heterogeneous Computing Using SmartNICs and Emerging Data Processing Units (Expanded Preprint) - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2504.03653v1](https://arxiv.org/html/2504.03653v1)
42. Changes in fitness-associated traits due to the stacking of transgenic glyphosate resistance and insect resistance in Brassica napus L - PMC, accessed March 7, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC3182500/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3182500/)
43. Transgenesis in Animal Agriculture: Addressing Animal Health and Welfare Concerns - WBI Studies Repository, accessed March 7, 2026, [https://www.wellbeingintlstudiesrepository.org/cgi/viewcontent.cgi?article=1001\&context=acwp\_tzd](https://www.wellbeingintlstudiesrepository.org/cgi/viewcontent.cgi?article=1001\&context=acwp_tzd)
44. Performance analysis of KVM-based microVMs orchestrated by Firecracker and QEMU - Philipp Mieden, accessed March 7, 2026, [https://dreadl0ck.net/papers/Firebench.pdf](https://dreadl0ck.net/papers/Firebench.pdf)
45. Sabre: Hardware-Accelerated Snapshot Compression for Serverless MicroVMs - USENIX, accessed March 7, 2026, [https://www.usenix.org/system/files/osdi24-lazarev\_1.pdf](https://www.usenix.org/system/files/osdi24-lazarev_1.pdf)
46. \[2102.12892] Restoring Uniqueness in MicroVM Snapshots - ar5iv - arXiv, accessed March 7, 2026, [https://ar5iv.labs.arxiv.org/html/2102.12892](https://ar5iv.labs.arxiv.org/html/2102.12892)
47. FaaS in the Age of (sub-)μs I/O: A Performance Analysis of Snapshotting, accessed March 7, 2026, [https://cgi.di.uoa.gr/\~vkarakos/papers/systor22\_snapshotting\_performance.pdf](https://cgi.di.uoa.gr/~vkarakos/papers/systor22_snapshotting_performance.pdf)
48. Benchmarking, Analysis, and Optimization of Serverless Function Snapshots - Marios Kogias, accessed March 7, 2026, [https://marioskogias.github.io/docs/reap.pdf](https://marioskogias.github.io/docs/reap.pdf)
49. FINOS AI Governance Framework:, accessed March 7, 2026, [https://air-governance-framework.finos.org/](https://air-governance-framework.finos.org/)
50. Analytics - MITRE ATT\&CK®, accessed March 7, 2026, [https://attack.mitre.org/analytics/](https://attack.mitre.org/analytics/)
51. Right to History: A Sovereignty Kernel for Verifiable AI Agent Execution - arXiv.org, accessed March 7, 2026, [https://arxiv.org/html/2602.20214v1](https://arxiv.org/html/2602.20214v1)
52. A Practical, Lightweight, and Flexible Confinement Framework in eBPF - Carleton University, accessed March 7, 2026, [https://people.scs.carleton.ca/\~soma/pubs/students/william-findlay-mcs.pdf](https://people.scs.carleton.ca/~soma/pubs/students/william-findlay-mcs.pdf)
53. vNetTracer: Efficient and Programmable Packet Tracing in Virtualized Networks - The University of Texas at Arlington, accessed March 7, 2026, [https://ranger.uta.edu/\~jrao/papers/ICDCS18.pdf](https://ranger.uta.edu/~jrao/papers/ICDCS18.pdf)
54. Dipartimento di Informatica, Bioingegneria, Robotica ed Ingegneria dei Sistemi - IRIS UniGe, accessed March 7, 2026, [https://unige.iris.cineca.it/retrieve/4aa1eeb7-76ba-4a7f-a8f9-be1588425755/phdunige\_4073181.pdf](https://unige.iris.cineca.it/retrieve/4aa1eeb7-76ba-4a7f-a8f9-be1588425755/phdunige_4073181.pdf)
