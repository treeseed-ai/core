---
title: "Chapter 11 Conformance"
---

# Chapter 11 Conformance

This document captures the Chapter 11 genesis gate for:

- `docs/src/content/knowledge/part-6/chapter-11/1-introduction.md`
- `docs/src/content/knowledge/part-6/chapter-11/2-the-monorepo-pipeline.md`
- `docs/src/content/knowledge/part-6/chapter-11/3-visualizing-the-rhizome.md`
- `docs/src/content/knowledge/part-6/chapter-11/4-the-distributed-experience-engram.md`
- `docs/src/content/knowledge/part-6/chapter-11/5-chapter-wrap-up.md`

Chapter 11 conformance requires these behaviors:

- Operational maturity exists as an explicit contract with build, deploy, observe, and distribute evidence.
- The engine workspace remains read-only while localized target workspaces carry execution plans and mutation work.
- Engrams are portable, selective, compatibility-checked memory products rather than opaque full-state dumps.
- Dashboard observability reflects real Rhizome topology, temporal archive state, active cells, and sovereignty priorities.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter11.conformance
```

This suite is expected to fail when:

- Operational maturity stops surfacing blockers or stops exposing release evidence.
- The monorepo pipeline allows execution work to target the engine workspace directly.
- Engrams stop supporting selective capture, compatibility validation, or partial hydration.
- The dashboard drifts back to metabolic-only snapshots and stops exposing organism observability.

The GitHub Actions workflow `chapter11-conformance.yml` must pass on pushes and pull requests.
