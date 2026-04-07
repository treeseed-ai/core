---
title: "Health And Response Runbook"
---

# Health And Response Runbook

This runbook covers the operator-facing health surfaces exposed by the dashboard service.

## Endpoints

### Liveness

```bash
curl -s http://127.0.0.1:4000/health/live
```

Expected response:

- HTTP `200`
- `status: "ok"`
- release metadata
- node identity

This only proves the web process is running and able to serve requests.

### Readiness

```bash
curl -s http://127.0.0.1:4000/health/ready
```

Expected response:

- HTTP `200` when Memgraph, XTDB, and NATS probes are all up
- HTTP `503` when any required dependency is down

Payload includes per-service status and probe detail from `Core.ServiceHealth`.

### Full Status

```bash
curl -s http://127.0.0.1:4000/health/status | jq
```

Expected payload:

- release metadata
- dependency status for `memgraph`, `xtdb`, and `nats`
- runtime fields:
  - `beam_schedulers`
  - `uptime_ms`
  - `dashboard_server`

## Response Guide

### `live` is `200`, `ready` is `503`

The dashboard is running, but the organism is not dependency-ready.

Check:

```bash
docker ps
docker logs karyon_memgraph
docker logs karyon_xtdb
docker logs karyon_nats
```

Then verify configured endpoints:

```bash
env | grep '^KARYON_'
```

Most likely causes:

- Memgraph unavailable or wrong Bolt URL
- XTDB unavailable or wrong PG-wire URL
- NATS unavailable or wrong client URL

### `status.services.xtdb.status == "down"`

Likely XTDB outage or schema/query-path failure.

Actions:

```bash
docker logs karyon_xtdb
curl -i http://127.0.0.1:8080/
```

If XTDB is healthy but readiness is still failing, inspect the configured `KARYON_XTDB_URL`.

### `status.services.memgraph.status == "down"`

Likely Memgraph outage or wrong credentials.

Actions:

```bash
docker logs karyon_memgraph
```

Verify:

- `KARYON_MEMGRAPH_URL`
- `KARYON_MEMGRAPH_USERNAME`
- `KARYON_MEMGRAPH_PASSWORD`

### `status.services.nats.status == "down"`

Likely NATS unreachable or listener not accepting connections.

Actions:

```bash
docker logs karyon_nats
```

Verify:

- `KARYON_NATS_URL`
- nociception/endocrine connectivity if the process is up but messaging still fails

## Release Context

When running from the packaged release:

```bash
app/_build/prod/rel/karyon/bin/karyon start
```

the health endpoints are served by the dashboard endpoint if:

```bash
export KARYON_DASHBOARD_SERVER=true
```

If the dashboard server is disabled, release processes may still be alive while the HTTP health surface is intentionally absent.
