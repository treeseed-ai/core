---
title: "Genetic Blueprint Guide"
---

# Genetic Blueprint Guide

This guide details the process of authoring and managing Karyon "DNA"—the declarative YAML configurations that define cellular behavior and constraints.

## YAML Schema Overview

Karyon DNA files are stored in `app/config/genetics/`. Each file defines the structural and behavioral properties of a cell.

```yaml
version: "1.0"
cell_type: "motor" # [stem, sensory, motor]
capabilities:
  - "io_execution"
  - "graph_access"
synapses:
  - topic: "prediction_errors"
    hwm: 1 # Zero-buffer constraint
  - topic: "telemetry"
    hwm: 10
metabolics:
  cpu_limit_ms: 50
  mem_limit_mb: 128
  apoptosis_on_starvation: true
```

### Hierarchy of Identity

1. **cell\_type**: Defines the basic behavioral template (`Core.StemCell`).
2. **capabilities**: Logic gates that enable or disable specific operational modules (e.g., `Sensory.Native`).
3. **synapses**: ZeroMQ topics the cell subscribes to. Note that `hwm: 1` is mandated for standard predictive coding synapses.

## Differentiation Strategies

### Sensory Cells

Sensory cells ingest external data (code, logs) and convert them into graph topologies.

- **DNA Requirement**: Must include `sensory_perception` capability.
- **Synapse Target**: Usually publishes to `topology_updates`.

### Motor Cells

Motor cells execute sovereign code within Firecracker microVMs.

- **DNA Requirement**: Must include `io_execution` and strict `cpu_limit_ms`.
- **Constraint**: Should never have `graph_access` enabled during active execution phases.

## Validation Bounds

The `Core.YamlParser` enforces strict validation. Corrupted or out-of-bounds configurations will trigger immediate cellular termination on boot to prevent structural instability in the Rhizome.
