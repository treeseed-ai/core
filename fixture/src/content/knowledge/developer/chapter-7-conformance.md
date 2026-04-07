---
title: "Chapter 7 Conformance"
---

# Chapter 7 Conformance

This document captures the Chapter 7 sensory gate for:

- `docs/src/content/knowledge/part-4/chapter-7/1-introduction.md`
- `docs/src/content/knowledge/part-4/chapter-7/2-the-eyes-deterministic-parsing.md`
- `docs/src/content/knowledge/part-4/chapter-7/3-the-ears-telemetry-events.md`
- `docs/src/content/knowledge/part-4/chapter-7/4-the-skin-spatial-poolers.md`
- `docs/src/content/knowledge/part-4/chapter-7/5-chapter-wrap-up.md`

Chapter 7 conformance requires these behaviors:

- The sensory perimeter remains explicit, bounded, and enforced by policy.
- The Eyes deterministically parse repositories and project repository/file/AST topology without hallucinated structure.
- The Ears normalize telemetry, logs, and webhook payloads into typed sensory events before Rhizome projection.
- The Skin discovers repeated structure in opaque text or binary payloads through generic pooling rather than ad hoc parsing shortcuts.
- The stream boundary remains non-blocking and rejects unsupported sensory ingress at startup.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter7.conformance
```

This suite is expected to fail when:

- Unsupported sensory organs, surfaces, or transports bypass the perimeter contract.
- Repository parsing becomes non-deterministic or stops projecting typed topology.
- Telemetry ingestion regresses into untyped event handling or skips the Rhizome projection boundary.
- Unknown payload discovery collapses back into raw quantization without pooled structural abstractions.
- Listener startup stops rejecting invalid subscriptions and allows unsupported ingest surfaces.

The GitHub Actions workflow `chapter7-conformance.yml` must pass on pushes and pull requests.
