---
title: "Chapter 10 Conformance"
---

# Chapter 10 Conformance

This document captures the Chapter 10 sovereignty gate for:

- `docs/src/content/knowledge/part-5/chapter-10/1-introduction.md`
- `docs/src/content/knowledge/part-5/chapter-10/2-sovereign-directives.md`
- `docs/src/content/knowledge/part-5/chapter-10/3-defiance-and-homeostasis.md`
- `docs/src/content/knowledge/part-5/chapter-10/4-the-cross-workspace-architect.md`
- `docs/src/content/knowledge/part-5/chapter-10/5-chapter-wrap-up.md`

Chapter 10 conformance requires these behaviors:

- Sovereignty exists as an explicit runtime control plane, not an implicit planner hint.
- Persistent objective manifests change attractor ranking and generate localized `.nexical/plan.yml` blueprints.
- Refusal and negotiation decisions are explicit, bounded, and persisted when sovereign law or homeostasis conflict with an intent.
- Cross-workspace planning coordinates a central architect workspace with localized execution limbs through shared memory, not through a monolithic global state machine.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter10.conformance
```

This suite is expected to fail when:

- Sovereign directives stop flowing into metabolism, planning, or objective weighting.
- Objective manifests stop changing attractor ranking or stop producing localized workspace blueprints.
- Mutation intents can bypass paradox detection, refusal, or negotiation reporting.
- Cross-workspace coordination stops writing localized plans or stops persisting shared-memory workspace coordination.

The GitHub Actions workflow `chapter10-conformance.yml` must pass on pushes and pull requests.
