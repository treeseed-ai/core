---
title: "Learning Loop Contract"
---

# Learning Loop Contract

This document captures the explicit learning loop introduced for:

- `docs/src/content/knowledge/part-3/chapter-6/1-introduction.md`

The learning loop is now modeled as five ordered phases:

1. `perception`
2. `action_feedback`
3. `prediction_error`
4. `plasticity`
5. `consolidation`

The current implementation binds those phases across the organism like this:

- `Core.StemCell` forms expectations and drives action execution.
- `Rhizome.Memory` persists action outcomes and prediction errors into durable memory.
- `NervousSystem.PainReceptor` emits typed nociception for structural failure.
- `Core.StemCell` prunes or reinforces Rhizome pathways based on prediction error or success.
- `Rhizome.ConsolidationManager` bridges working memory into the archive and performs the sleep-cycle consolidation pass.

Local validation commands:

```bash
cd /home/adrian/Projects/nexical/karyon/app/core && mix test test/core/learning_loop_contract_test.exs test/core/stem_cell_test.exs
cd /home/adrian/Projects/nexical/karyon/app/nervous_system && mix test test/nervous_system/pain_receptor_test.exs
cd /home/adrian/Projects/nexical/karyon/app/rhizome && mix test test/rhizome/consolidation_manager_test.exs
```
