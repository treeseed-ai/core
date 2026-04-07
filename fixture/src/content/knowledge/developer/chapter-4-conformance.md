---
title: "Chapter 4 Conformance"
---

# Chapter 4 Conformance

This document captures the Chapter 4 regulation gate for:

- `docs/src/content/knowledge/part-2/chapter-4/1-introduction.md`
- `docs/src/content/knowledge/part-2/chapter-4/2-declarative-genetics.md`
- `docs/src/content/knowledge/part-2/chapter-4/3-the-epigenetic-supervisor.md`
- `docs/src/content/knowledge/part-2/chapter-4/4-apoptosis-digital-torpor.md`
- `docs/src/content/knowledge/part-2/chapter-4/5-chapter-wrap-up.md`

Chapter 4 conformance requires these behaviors:

- DNA remains the authoritative schema for role, policy, inheritance, and executor bounds.
- The epigenetic supervisor selects differentiated DNA variants from environmental pressure and role context instead of uniformly spawning a single generic cell.
- Differentiation decisions are persisted through the Rhizome boundary.
- Lifecycle state is explicit across `:active`, `:torpor`, `:revived`, `:shed`, and `:terminated`.
- Safety-critical cells are preserved under high pressure, while speculative or lower-priority cells are shed or pruned deterministically.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter4.conformance
```

This suite is expected to fail when:

- DNA validation becomes partial, ad hoc, or bypassable.
- Supervisor differentiation ignores environmental pressure or requested role context.
- Differentiation decisions stop being persisted into the Rhizome.
- Torpor, revival, shed, or termination semantics regress into implicit or inconsistent behavior.

The GitHub Actions workflow `chapter4-conformance.yml` must pass on pushes and pull requests that touch the repository.
