# @treeseed/core

`@treeseed/core` is the Treeseed web framework package for Astro/Starlight sites. It contains the published web runtime, tenant site configuration, shared components and styles, the knowledge-factory content model, and the forms stack used by Treeseed tenants.

The Treeseed backend API and Treeseed operations runner are owned by `@treeseed/api`. Capacity-provider runtime, provider manager/runner, and workday processing services are owned by `@treeseed/agent`.

Core/root web hosting is web-only desired state: Cloudflare web resources, generated web config, cache/content/email web settings, and API connection/proxy metadata. It must not deploy or mutate API-owned Railway services, PostgreSQL, operations runners, or public TreeDX federation. Hosting and local runtime infrastructure flow through the SDK-owned reconciliation platform documented in the root workspace `docs/reconciliation-platform.md`.

This repository is the package root. Run package commands from [`core`](./), not from the top-level `treeseed` workspace.

## Requirements

- Node `>=22`
- npm `>=10`

## Install

For package contributors:

```bash
git submodule update --init --recursive
npm install
```

This creates `package-lock.json`, installs dependencies, and runs the package `prepare` step to build `dist/`.

For CI or any fresh reproducible checkout:

```bash
npm ci
```

## Package Layout

- `src/`: package source
- `scripts/`: build, release, and verification scripts
- `test/`: unit tests run by Vitest
- `.fixtures/treeseed-fixtures/`: pinned shared fixtures submodule
- `.github/workflows/`: CI and publish workflows for this package repo
- `templates/github/deploy-web.workflow.yml`: downstream tenant web deploy workflow template

The package builds directly against the canonical shared working-site fixture in `treeseed-fixtures`.

## Shared Fixture Usage

`@treeseed/core` validates itself against the integrated shared fixture, not a Core-specific fork.

That means the fixture may reference package surfaces owned by `sdk`, `core`, `agent`, `api`, and `cli`, and isolated Core verification links the real local `core` package into the shared fixture instead of maintaining package-specific fixture forks.

## Commands

### Core development

```bash
npm run dev
npm run dev:web
npm run fixtures:check
npm run build:dist
npm run test:unit
npm run check
npm run build
npm run test:smoke
```

What they do:

- `dev`: starts the Astro UI local runtime from `core`
- `dev:web`: starts only the Astro UI dev surface through the `core` runtime
- `fixtures:check`: verifies that the pinned shared fixture is initialized and usable
- `build:dist`: builds the publishable `dist/` package output
- `test:unit`: runs package unit tests with Vitest
- `check`: runs `astro check` against the internal fixture app
- `build`: builds the internal fixture app in production-like mode
- `test:smoke`: runs the packed-install smoke test

### Integrated managed dev

The published Core runtime also owns the integrated Treeseed dev supervisor used by the installable CLI:

```bash
npx trsd dev
npx trsd dev start --web-runtime local --json
npx trsd dev status --all --json
npx trsd dev logs --follow
npx trsd dev stop --json
```

`trsd dev` delegates to Core and runs the foreground supervisor. `trsd dev start` launches the same runtime as a worktree-scoped managed background instance, writing authoritative instance state under `.treeseed/dev/instances`, PID files under `.treeseed/dev/pids`, and logs under `.treeseed/logs`. The repository-family index under the git common dir is discovery-only and points back to those worktree-local records.

For the Treeseed workspace, the web process runs from the root repo and the API plus operations runner run from `packages/api`. A plan should show:

```text
web cwd: .
api cwd: packages/api
operations-runner cwd: packages/api
```

Core should keep this runtime reusable by the CLI and by the root web workspace. Do not duplicate process, port, PID, or log management in package-local callers.

### Full verification

```bash
npm run verify
npm run verify:local
npm run verify:action
```

`npm run verify` uses the shared Treeseed SDK verify driver in auto mode.

- `npm run verify` auto-selects between local direct verification and the `gh act` workflow path
- `npm run verify:local` forces local direct verification against the current repo state
- `npm run verify:action` forces the isolated workflow path through `gh act`
- `npm run verify:direct` is the raw package verification chain used by the driver

The direct verification chain is:

1. `npm run build:dist`
2. `npm run test:unit`
3. `npm run check`
4. `npm run build`
5. `npm run test:smoke`

If this command passes, the package is in the same state expected by CI and the publish workflow.

### Release commands

```bash
npm run release:check-tag -- 0.0.1
npm run release:publish
```

- `release:check-tag` validates that a git tag matches the version in [`package.json`](./package.json)
- `release:publish` publishes the package to npm

## GitHub Actions

This repo ships two package workflows:

- [`ci.yml`](./.github/workflows/ci.yml): runs on push and pull request, installs with `npm ci`, then runs `npm run verify`
- [`publish.yml`](./.github/workflows/publish.yml): runs on `workflow_dispatch` and on plain semver tags like `0.1.0`; it installs with `npm ci`, validates the tag with `release:check-tag`, runs `npm run verify`, and publishes with `NPM_TOKEN`

The deploy workflow template at [`templates/github/deploy-web.workflow.yml`](./templates/github/deploy-web.workflow.yml) is for downstream Treeseed web repositories, not for publishing this package. Processing host deploy assets are owned by `@treeseed/agent`.

## Consumer Contract

The package publishes built artifacts from `dist/` and exposes runtime entrypoints through [`package.json`](./package.json) `exports`.

The published package includes:

- `dist/`
- `tsconfigs/`
- `templates/`
- `style/`
- `utils/`
- `README.md`

The package currently depends on `@treeseed/sdk` plus the runtime packages needed for its web surfaces. It does not depend on `@treeseed/cli` or `@treeseed/agent`.

## Contributor Workflow

Typical local workflow:

```bash
npm install
npm run verify
```

If you only need one stage:

```bash
npm run test:unit
npm run check
npm run build
```

When changing exported package code, rerun `npm run build:dist` and then `npm run verify`.

## Publishing

Release flow for this repo:

1. Update the package version in [`package.json`](./package.json).
2. Run `npm run verify`.
3. Create a matching tag: `<version>` such as `0.1.0`.
4. Push the tag or run the publish workflow manually.

The publish workflow expects the npm auth token in `NPM_TOKEN`.
