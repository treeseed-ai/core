---
title: "Chapter 5 Conformance"
---

# Chapter 5 Conformance

This document captures the Chapter 5 temporal graph gate for:

- `docs/src/content/knowledge/part-3/chapter-5/1-introduction.md`
- `docs/src/content/knowledge/part-3/chapter-5/2-graph-vs-matrix.md`
- `docs/src/content/knowledge/part-3/chapter-5/3-working-memory-vs-archive.md`
- `docs/src/content/knowledge/part-3/chapter-5/4-multi-version-concurrency-control.md`
- `docs/src/content/knowledge/part-3/chapter-5/5-chapter-wrap-up.md`

Chapter 5 conformance requires these behaviors:

- The Rhizome exposes an explicit topology contract for working memory, archive, and projection.
- The high-level memory boundary rejects opaque graph and archive shortcuts in favor of typed graph and archive operations.
- Working-memory operations, archive operations, and bridge operations remain distinct APIs.
- Archive writes append revisions with `xt/id`, `xt/revision`, `xt/valid_time`, and `xt/tx_time` metadata.
- Archive queries resolve latest-state by default and can expose full history or `as_of` temporal views when requested.
- Service-backed temporal validation must run when Memgraph and XTDB are reachable.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter5.conformance
```

This suite is expected to fail when:

- Working-memory and archive semantics collapse back into store-specific or blob-oriented helper calls.
- The Rhizome starts accepting opaque Cypher strings or archive JSON blobs through the high-level memory boundary.
- Archive writes regress into destructive update assumptions rather than revisioned append semantics.
- Latest-state, history, or `as_of` temporal reads stop matching the revision stream.

The GitHub Actions workflow `chapter5-conformance.yml` must pass on pushes and pull requests. It runs the service-backed temporal suites automatically when Memgraph and XTDB are reachable in the current environment.
