---
title: "Metabolic Operations Playbook"
---

# Metabolic Operations Playbook

This playbook provides operational guidance for monitoring the health, survival, and performance of the Karyon organism.

## Core Metrics

Monitoring the Metabolic layer requires tracking three primary signals:

### 1. Scheduler Run Queue (`run_queue_wait`)

- **Signal**: The number of processes waiting to execute on the BEAM.
- **Threshold**: Sustained spikes above 10 (per scheduler) trigger `MetabolicDaemon` apoptosis.
- **Action**: If loops occur, check for non-yielding Rustler NIFs or high-frequency synaptic floods.

### 2. L3 Cache Pressure (`cache_constriction`)

- **Signal**: Memory bandwidth utilization monitoring (via `perf` or native NIF proxies).
- **Threshold**: High pressure indicates NUMA traversal penalties.
- **Action**: Verify that `#[repr(align(64))]` is properly applied to new native structs.

### 3. XTDB/Memgraph Starvation (`io_torpor`)

- **Signal**: Transaction submission latency in the `Rhizome.Memory` layer.
- **Threshold**: Latency > 100ms.
- **Action**: Manually trigger `Rhizome.Optimizer` (Sleep Cycle) to prune version-chain bloat or consolidate episodic nodes.

## Apoptosis Debugging

### Cascade Failures

If the `ChaosMonkey` and `MetabolicDaemon` interact poorly, you may see high-frequency "Kill/Spawn" cycles.

- **Detection**: Check `Core.Application` logs for `[EpigeneticSupervisor] Cell Death: :killed`.
- **Mitigation**: Temporarily disable the `ChaosMonkey` to allow the Metabolic layer to stabilize the run queues.

## Dashboard definitions

Use the following Grafana/Prometheus mappings:

- `beam_run_queue_length`: Holistic VM load.
- `rhizome_tx_latency_ms`: Memory health.
- `karyon_apoptosis_total`: Cellular turnover rate.
