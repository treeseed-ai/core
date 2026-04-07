---
title: "Chapter 1 Conformance"
---

# Chapter 1 Conformance

This document captures the Chapter 1 conformance gate for:

- `docs/src/content/knowledge/part-1/chapter-1/1-introduction.md`
- `docs/src/content/knowledge/part-1/chapter-1/2-the-statistical-dead-end.md`
- `docs/src/content/knowledge/part-1/chapter-1/3-catastrophic-forgetting-and-hardware-economics.md`
- `docs/src/content/knowledge/part-1/chapter-1/4-why-current-ai-fails-predictive-coding-and-active-inference.md`
- `docs/src/content/knowledge/part-1/chapter-1/5-chapter-wrap-up.md`

Chapter 1 conformance requires these behaviors:

- Planning is graph-backed and uses typed attractor and step contracts.
- Cells retain and recover lineage state from durable memory.
- Execution respects DNA `atp_requirement` before action.
- Nociception and execution failures persist typed prediction errors through the memory pipeline.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter1.conformance
```

This suite is expected to fail when:

- Prompt-response orchestration reappears inside the planning boundary.
- Cells stop checkpointing durable state or fail to recover lineage state after restart.
- Execution bypasses ATP admission or prediction errors bypass typed persistence.
- New prompt, completion, or chat-style APIs enter the planning, execution, or memory boundary.

The GitHub Actions workflow `chapter1-conformance.yml` must pass on pushes and pull requests.
