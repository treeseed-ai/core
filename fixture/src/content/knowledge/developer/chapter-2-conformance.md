---
title: "Chapter 2 Conformance"
---

# Chapter 2 Conformance

This document defines the regression boundaries derived from Part 1 Chapter 2 of the Karyon book source at `docs/src/content/knowledge/part-1/chapter-2/**`.

## Forbidden Regressions

Do not introduce any of the following into the Chapter 2 cognition loop:

- Centralized cell discovery that bypasses structured `:pg` routing.
- Prediction-error handling that ignores expectation lineage, objective weights, or nociception metadata.
- Planning that collapses abstract states back into flat string goals without typed target-state or predicted-state contracts.
- Pointer-based placeholder plasticity in the active cell loop instead of explicit reinforce/prune pathway operations.
- Global retraining-style shortcuts that bypass local, forward-only pathway mutation.

## Required Invariants

Chapter 2 conformance requires these behaviors:

- Cells advertise and discover peers through structured `:pg` topics.
- Predictive processing uses typed expectations, weighted surprise, and persisted expectation lineage.
- Plans carry typed abstract states, weighted needs, weighted values, and objective priors.
- The pain receptor filters recursive pain signals and emits enriched nociception metadata.
- Plasticity uses explicit `reinforce_pathway/1` and `prune_pathway/1` mutations at the Rhizome boundary.

## Enforcement

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter2.conformance
```

CI requirement:

- The GitHub Actions workflow `chapter2-conformance.yml` must pass on pushes and pull requests that touch the repository.
