---
title: "Chapter 11 Operational Maturity"
---

# Chapter 11 Operational Maturity

`Core.OperationalMaturity` is the canonical Chapter 11 introduction contract.

It defines four explicit targets:

- `build`: sterile engine boot evidence, preflight status, and release environment.
- `deploy`: dependency readiness and admission posture for runnable releases.
- `observe`: bounded operator visibility through the existing health and operator-output surface.
- `distribute`: persistent objective ingestion and cross-workspace blueprint readiness.

Validation entry points:

```bash
cd /home/adrian/Projects/nexical/karyon/app && mix compile
cd /home/adrian/Projects/nexical/karyon/app/core && mix test test/core/operational_maturity_test.exs test/core/service_health_test.exs
cd /home/adrian/Projects/nexical/karyon/app/dashboard && env PATH=/tmp/protoc/bin:$PATH mix test test/dashboard_web/controllers/health_controller_test.exs
```

This contract is introductory on purpose. Later Chapter 11 and 12 phases should extend the evidence behind each target instead of inventing parallel maturity models.
