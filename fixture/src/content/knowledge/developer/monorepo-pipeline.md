---
title: "Chapter 11 Monorepo Pipeline"
---

# Chapter 11 Monorepo Pipeline

`Core.MonorepoPipeline` is the canonical engine-versus-target-workspace contract.

Rules:

- The repository root is the engine workspace and is treated as read-only control plane state.
- Localized execution limbs must live outside the engine tree.
- `.nexical/plan.yml` blueprints are only emitted into validated target workspaces.
- `Sandbox.WRS` refuses `execute_plan` intents that omit a target workspace or point back at the engine tree.
- Firecracker execution manifests now record both the engine manifest and the validated target workspace root.

Validation entry points:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix compile
cd /home/adrian/Projects/nexical/karyon/app/core && mix test test/core/monorepo_pipeline_test.exs test/core/objective_manifest_test.exs
cd /home/adrian/Projects/nexical/karyon/app/sandbox && mix test test/sandbox/wrs_test.exs test/sandbox/executor_test.exs test/sandbox/provisioner_test.exs
```
