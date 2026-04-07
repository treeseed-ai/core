---
title: "Chapter 9 Conformance"
---

# Chapter 9 Conformance

This document captures the Chapter 9 drive gate for:

- `docs/src/content/knowledge/part-5/chapter-9/1-introduction.md`
- `docs/src/content/knowledge/part-5/chapter-9/2-the-atp-analogue.md`
- `docs/src/content/knowledge/part-5/chapter-9/3-epistemic-foraging-curiosity.md`
- `docs/src/content/knowledge/part-5/chapter-9/4-the-simulation-daemon-dreams.md`
- `docs/src/content/knowledge/part-5/chapter-9/5-chapter-wrap-up.md`

Chapter 9 conformance requires these behaviors:

- ATP scarcity changes real admission and scheduling outcomes across spawn, planning, execution, and sandbox routing.
- Idle curiosity probes only low-confidence candidates and only through the sandbox membrane.
- Dream-state permutations replay historical execution outcomes through isolated `execute_plan` intents and persist simulation results back into Rhizome.
- The drive surface stays coherent across metabolism policy, curiosity, and dreaming instead of drifting into disconnected subsystems.

Local command:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix chapter9.conformance
```

This suite is expected to fail when:

- ATP pressure stops affecting real spawn, plan, execution, or sandbox admission outcomes.
- Curiosity probes run while the organism is not idle, or bypass typed sandbox execution.
- Dream-state permutations stop sourcing historical execution outcomes or stop projecting simulation events into Rhizome.
- The Rhizome memory contract no longer exposes the bounded low-confidence, recent-outcome, or simulation-event surfaces required by Chapter 9.

The GitHub Actions workflow `chapter9-conformance.yml` must pass on pushes and pull requests.
