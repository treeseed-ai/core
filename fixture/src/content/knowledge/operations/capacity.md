---
title: "Production Capacity And SLOs"
---

# Production Capacity And SLOs

This document defines the current validated operating envelope for Karyon based on the Phase 6 baseline and recovery artifacts.

It is intentionally conservative. The current measurements come from a single-node local environment and should be treated as the minimum proven envelope, not an upper bound.

## Validated Environment

The current envelope is based on these measured runs:

- baseline throughput artifact: `app/artifacts/benchmarks/phase6_baseline_20260317.json`
- recovery artifact: `app/artifacts/benchmarks/phase6_recovery_20260317.json`

Measured host/runtime context:

- architecture: `x86_64-pc-linux-gnu`
- OTP: `28`
- Elixir: `1.19.5`
- schedulers online: `4`
- environment: `MIX_ENV=dev`

Dependencies validated during service-backed runs:

- Memgraph
- XTDB v2 over PG-wire
- NATS
- Firecracker host toolchain and network helper

## Current Operating Envelope

The following is the current minimum proven envelope for one node with four online schedulers:

| Area                         | Current validated level | Notes                                                                                                  |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Cell spawn throughput        | `29.74 cells/s`         | measured from `100` spawns over `3362 ms`                                                              |
| Local synapse messaging      | `7085.46 msg/s`         | average end-to-end latency `141.13 us` for `500` messages                                              |
| Sensory parse throughput     | `3147.62 ops/s`         | average parse latency `0.318 ms` for `100` iterations                                                  |
| Consolidation orchestration  | `0.15 ms` average cycle | stubbed control-plane only, excludes Memgraph and XTDB service latency                                 |
| Supervised component restart | `51 ms`                 | validated for `Core.MetabolicDaemon`, `NervousSystem.PainReceptor`, and `Rhizome.ConsolidationManager` |
| Cell apoptosis recovery      | `51 ms`                 | includes XTDB-backed belief rehydration                                                                |

## Initial SLOs

These SLOs are the current production targets. They should be met before calling a node healthy for steady-state operation.

### Availability

- Dashboard liveness: `>= 99.9%`
- Dashboard readiness when dependencies are healthy: `>= 99.5%`
- Dependency-ready organism state for Memgraph, XTDB, and NATS: `>= 99.5%`

### Recovery

- supervised child restart time: `p95 <= 250 ms`
- cell apoptosis plus belief recovery time: `p95 <= 250 ms`
- readiness recovery after a single supervised child failure: `<= 5 s`

These targets leave headroom over the currently measured `51 ms` recovery time while remaining strict enough to catch regressions.

### Throughput And Latency

- cell spawn throughput floor: `>= 20 cells/s`
- local synapse throughput floor: `>= 5000 msg/s`
- average local synapse end-to-end latency: `<= 1 ms`
- sensory parse throughput floor: `>= 2000 ops/s`
- average sensory parse latency: `<= 1 ms`

These are release gates, not saturation goals. Falling below them means the node should be treated as degraded.

## Alert Thresholds

Operators should page or take the node out of rotation when any of the following occurs:

- `/health/ready` returns `503` for more than `5 minutes`
- supervised component restart exceeds `250 ms` in repeated recovery tests
- cell recovery exceeds `250 ms` in repeated recovery tests
- average synapse latency exceeds `1 ms` under the baseline workload
- sensory parse average latency exceeds `1 ms` under the baseline workload
- cell spawn throughput drops below `20 cells/s` under the baseline workload

## Known Constraints

The current envelope is limited by the quality of the measured environment:

- baseline throughput was measured in `dev`, not a packaged prod release
- consolidation timing excludes real optimizer and external graph-service latency
- the recovery suite does not currently invoke `Rhizome.Native.optimize_graph/0` because the current NIF can panic on live graph data
- `PainReceptor` restart currently emits a transient `:eaddrinuse` retry before the replacement `:pain_synapse` binds successfully
- no multi-node or cross-host network envelope has been measured yet

## How To Re-Measure

Baseline throughput:

```bash
cd app
env PATH=/tmp/protoc/bin:$PATH mix karyon.baseline \
  --spawn-count 100 \
  --message-count 500 \
  --parse-iterations 100 \
  --consolidation-iterations 20 \
  --output artifacts/benchmarks/phase6_baseline_$(date +%Y%m%d).json
```

Recovery validation:

```bash
cd app/core
mix test test/core/recovery_chaos_integration_test.exs --include external
```

After re-measuring, update this document and the referenced artifact paths before changing the published SLOs.
