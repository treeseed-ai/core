---
title: "Karyon Release Workflow"
---

# Karyon Release Workflow

## Build

Build the production-shaped umbrella release from the repository root:

```bash
bin/build_release.sh
```

That script:

- runs `mix deps.get` for the dashboard and umbrella
- builds dashboard static assets with `MIX_ENV=prod`
- builds the umbrella release as `karyon`

Default release output:

```text
app/_build/prod/rel/karyon
```

You can override the output path:

```bash
bin/build_release.sh /tmp/karyon-rel
```

## Required Runtime Environment

Minimum production environment:

```bash
export SECRET_KEY_BASE="$(cd app/dashboard && mix phx.gen.secret)"
export KARYON_DASHBOARD_SERVER=true
```

Common service overrides:

```bash
export KARYON_MEMGRAPH_URL=bolt://memgraph.internal:7687
export KARYON_XTDB_URL=postgres://xtdb.internal:5432/xtdb
export KARYON_NATS_URL=nats://nats.internal:4222
export KARYON_NOCICEPTION_PORT=5555
```

Sandbox/Firecracker host overrides:

```bash
export KARYON_FIRECRACKER_BINARY=/usr/local/bin/firecracker
export KARYON_FIRECRACKER_KERNEL=/opt/karyon/firecracker/vmlinux
export KARYON_FIRECRACKER_ROOTFS=/opt/karyon/firecracker/rootfs.ext4
export KARYON_NET_HELPER=/usr/local/bin/karyon-net-helper
export KARYON_BRIDGE_DEVICE=karyon0
```

Optional safety/runtime flags:

```bash
export KARYON_STRICT_PREFLIGHT=true
export PHX_HOST=karyon.example.com
export PORT=4000
export DNS_CLUSTER_QUERY=karyon.internal
```

## Start

```bash
app/_build/prod/rel/karyon/bin/karyon start
```

Foreground:

```bash
app/_build/prod/rel/karyon/bin/karyon foreground
```

Remote shell:

```bash
app/_build/prod/rel/karyon/bin/karyon remote
```

## Air-Gapped Package

To create the packaged bootstrap artifact:

```bash
cd app
scripts/bootstrap_airgap.sh
```

This now builds the real `karyon` release and archives it into the bootstrap bundle instead of creating a placeholder tarball.
