---
title: "Chapter 12 Conformance"
---

# Chapter 12 Conformance

This document captures the Chapter 12 maturation gate for:

- `docs/src/content/knowledge/part-6/chapter-12/1-introduction.md`
- `docs/src/content/knowledge/part-6/chapter-12/2-the-baseline-diet.md`
- `docs/src/content/knowledge/part-6/chapter-12/3-execution-telemetry.md`
- `docs/src/content/knowledge/part-6/chapter-12/4-the-synthetic-oracle-curriculum-the-teacher-daemon.md`
- `docs/src/content/knowledge/part-6/chapter-12/5-abstract-intent.md`
- `docs/src/content/knowledge/part-6/chapter-12/6-chapter-wrap-up.md`

Chapter 12 conformance requires these behaviors:

- Maturation exists as an explicit lifecycle contract instead of ad hoc curriculum logic.
- Baseline diet intake establishes deterministic structural grammar and persists curriculum evidence.
- Execution telemetry is standardized, replayable, and reusable as training input.
- The teacher daemon generates bounded exams from real documentation or specs, routes them through sandbox execution, and persists the resulting curriculum evidence.
- Abstract intent ingests documentation plus git history, then persists implementation drift as a queryable memory surface.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter12.conformance
```

This suite is expected to fail when:

- The maturation lifecycle stops exposing blockers, evidence, or next-phase links.
- Baseline intake stops rejecting weak structural input or stops persisting accepted curriculum artifacts.
- Execution telemetry stops emitting replayable curriculum records.
- Teacher-daemon exams stop flowing through the sandbox membrane or stop persisting teacher events.
- Abstract intent stops emitting implementation-drift records from documentation and history evidence.

The GitHub Actions workflow `chapter12-conformance.yml` must pass on pushes and pull requests.
