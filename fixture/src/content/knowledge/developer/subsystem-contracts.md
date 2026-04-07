---
title: "Subsystem Contracts"
---

# Subsystem Contracts

This document captures the subsystem ownership model required by Part II Chapter 3 Section 1 of the Karyon book source at `docs/src/content/knowledge/part-2/chapter-3/1-introduction.md`.

## Ownership

- `core` is the nucleus and cytoplasm boundary.

  It owns sterile planning contracts, actor lifecycle, DNA transcription, BEAM process-group boot, and metabolic coordination.

- `rhizome` is the memory and organelle boundary.

  It owns Rustler-backed graph and temporal memory operations, consolidation, optimization, and XTDB/Memgraph interfaces.

- `sandbox` is the membrane boundary.

  It owns Firecracker embodiment, VM provisioning, VMM supervision, and host isolation mechanics.

- `nervous_system` is the nervous-system boundary.

  It owns synaptic transport, endocrine signals, and nociception routing.

- `dashboard` is observability only.

  It must not take ownership of planning, memory mutation, or Firecracker embodiment.

## Boundary Rules

- The nucleus must not own Firecracker, dashboard routing, or direct memory-engine implementation details.
- The membrane must not own planning, graph-memory mutation logic, or dashboard responsibilities.
- The nervous system must not own planner logic or memory-optimizer logic.
- Organelles must stay behind Rhizome boundaries and must not absorb sandbox or dashboard behavior.

## Enforcement

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix subsystem.contracts
```

The umbrella test `app/test/subsystem_contracts_test.exs` is the executable contract for this section.
