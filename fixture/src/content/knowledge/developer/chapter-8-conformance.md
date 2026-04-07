---
title: "Chapter 8 Conformance"
---

# Chapter 8 Conformance

This document captures the Chapter 8 action gate for:

- `docs/src/content/knowledge/part-4/chapter-8/1-introduction.md`
- `docs/src/content/knowledge/part-4/chapter-8/2-linguistic-motor-cells.md`
- `docs/src/content/knowledge/part-4/chapter-8/3-the-sandbox.md`
- `docs/src/content/knowledge/part-4/chapter-8/4-friction-mirror-neurons.md`
- `docs/src/content/knowledge/part-4/chapter-8/5-chapter-wrap-up.md`

Chapter 8 conformance requires these behaviors:

- Planning crosses the action membrane through a typed execution-intent contract.
- Human-facing status output is rendered by a bounded operator-language surface rather than free-form generation.
- Irreversible sandbox action is gated by WRS, isolated in the Firecracker membrane, and returned with audit plus telemetry artifacts.
- Operator friction and approval events affect only socio-linguistic template pathways and cannot target protected architectural domains.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter8.conformance
```

This suite is expected to fail when:

- Plans dispatch raw action maps instead of validated execution intents.
- Operator-facing output stops carrying deterministic template identity and bounded phrasing.
- Sandbox execution bypasses WRS, loses audit provenance, or stops returning telemetry.
- Dashboard or core feedback capture can mutate protected planning, execution, or sandbox-policy domains.

The GitHub Actions workflow `chapter8-conformance.yml` must pass on pushes and pull requests.
