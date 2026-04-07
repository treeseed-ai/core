---
title: "Chapter 6 Conformance"
---

# Chapter 6 Conformance

This document captures the Chapter 6 adaptive-map gate for:

- `docs/src/content/knowledge/part-3/chapter-6/1-introduction.md`
- `docs/src/content/knowledge/part-3/chapter-6/2-hebbian-wiring-spatial-pooling.md`
- `docs/src/content/knowledge/part-3/chapter-6/3-the-pain-receptor.md`
- `docs/src/content/knowledge/part-3/chapter-6/4-the-sleep-cycle-memory-consolidation.md`
- `docs/src/content/knowledge/part-3/chapter-6/5-chapter-wrap-up.md`

Chapter 6 conformance requires these behaviors:

- Repeated sensory structure is consolidated into pooled graph abstractions instead of remaining flat quantized events.
- Pain remains a typed prediction-error path with stable metadata and direct graph-correction linkage.
- Live learning and offline sleep-cycle consolidation both operate on the same Rhizome semantics.
- Sleep consolidation generates abstractions and archival projection without regressing back to blunt deletion.
- When Memgraph, XTDB, and NATS are reachable, the service-backed adaptive-map tests must also pass.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter6.conformance
```

This suite is expected to fail when:

- Spatial pooling stops reinforcing or persisting repeated structural patterns.
- Pain signaling loses typed metadata, duplicate suppression, or graph-correction persistence.
- Consolidation regresses into opaque side effects or destructive delete semantics.
- Service-backed recovery or Rhizome archive retention drifts away from the Chapter 6 adaptive-map contract.

The GitHub Actions workflow `chapter6-conformance.yml` must pass on pushes and pull requests.
