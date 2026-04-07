---
title: "Chapter 3 Conformance"
---

# Chapter 3 Conformance

This document captures the Chapter 3 conformance gate for:

- `docs/src/content/knowledge/part-2/chapter-3/1-introduction.md`
- `docs/src/content/knowledge/part-2/chapter-3/2-the-microkernel-philosophy.md`
- `docs/src/content/knowledge/part-2/chapter-3/3-why-erlang-beam-is-the-perfect-cytoplasm.md`
- `docs/src/content/knowledge/part-2/chapter-3/4-why-rust-nifs-are-the-perfect-organelles.md`
- `docs/src/content/knowledge/part-2/chapter-3/5-the-membrane-firecracker-qemu-and-kvm.md`
- `docs/src/content/knowledge/part-2/chapter-3/6-the-nervous-system-distributed-cognition.md`
- `docs/src/content/knowledge/part-2/chapter-3/7-chapter-wrap-up.md`

Chapter 3 conformance requires these behaviors:

- The subsystem boundary contract keeps nucleus, cytoplasm, organelles, membrane, nervous system, and Rhizome ownership explicit.
- The microkernel stays sterile and uses declarative DNA executor contracts instead of embedding membrane logic directly in core cells.
- The cytoplasm preserves supervised, crash-oriented actor churn and decentralized discovery.
- Rust organelles remain dirty-scheduler-safe, typed, and panic-contained at the BEAM boundary.
- The Firecracker membrane uses the resolved `virtio-blk` plus overlay workspace contract.
- The nervous system preserves ZeroMQ and NATS transport separation with explicit runtime transport telemetry.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter3.conformance
```

This suite is expected to fail when:

- Subsystem ownership drifts back into ambiguous or overlapping boundaries.
- Core cells start depending directly on sandbox or Firecracker implementation details.
- Supervision, process-group routing, or churn resilience regresses.
- NIFs block schedulers or reintroduce panic-prone boundary behavior.
- The membrane stops honoring the `virtio-blk` workspace contract.
- The nervous system loses runtime transport descriptors, telemetry, or broker separation.

The GitHub Actions workflow `chapter3-conformance.yml` must pass on pushes and pull requests.
