---
title: "Phase 6 Baseline Measurements"
---

# Phase 6 Baseline Measurements

This document records the local baseline harness used for Phase 6.

## Harness

Run from the repository root:

```bash
cd app
mix karyon.baseline
```

The command writes a JSON artifact under:

```text
artifacts/benchmarks/
```

Measured workloads:

- cell spawn throughput via `Core.StressTester`
- local synapse messaging throughput and end-to-end latency
- sensory `parse_to_graph/2` throughput
- consolidation control-plane cost via `Rhizome.ConsolidationManager.run_once/1`

## Notes

- The consolidation metric is a control-plane baseline using a stubbed native module.
- It measures consolidation orchestration cost, not external Memgraph or XTDB service latency.
- Messaging is measured on localhost through the current ZeroMQ path.
- Spawn throughput depends on the current BEAM scheduler count and host pressure.

## Latest Baseline

Artifact:

```text
app/artifacts/benchmarks/phase6_baseline_20260317.json
```

Environment:

- recorded at `2026-03-17T05:32:58.906102Z`
- host architecture `x86_64-pc-linux-gnu`
- OTP `28`
- Elixir `1.19.5`
- `MIX_ENV=dev`
- schedulers online `4`

Results:

| Workload                         | Configuration                                  | Result                                                               |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| Cell spawn throughput            | `spawn_count=100`                              | `29.74 cells/s` over `3362 ms`                                       |
| Messaging throughput             | `message_count=500`                            | `7085.46 msg/s`, `141.13 us` average end-to-end latency over `71 ms` |
| Sensory parse throughput         | `parse_iterations=100`, `sample_size_bytes=32` | `3147.62 ops/s`, `0.318 ms` average latency over `32 ms`             |
| Consolidation control-plane cost | `consolidation_iterations=20`                  | `0.15 ms` average cycle, `2 ms` max, `0 ms` min, `21 ms` total       |

Run notes:

- `Core.StressTester` spawned all `100` requested cells.
- Spawn pressure after completion was `medium` with run queue `1`.
- Consolidation ran in `stubbed_control_plane` mode to isolate orchestration cost from external service latency.
- The run emitted non-blocking local-environment warnings for unbound scheduler binding, missing `inotify-tools`, and dashboard asset version drift. Those warnings did not prevent artifact generation.
