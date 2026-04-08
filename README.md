# @treeseed/core

`@treeseed/core` is the Treeseed runtime package for Astro/Starlight sites. It contains the published runtime, shared components and styles, forms and deploy helpers, plugin runtime wiring, and agent-facing utilities used by Treeseed tenants.

This repository is the package root. Run package commands from [`core`](./), not from the top-level `treeseed` workspace.

## Requirements

- Node `>=20`
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
- `fixture/`: synchronized local mirror of the canonical working-site fixture used for `check`, `build`, and smoke verification
- `.github/workflows/`: CI and publish workflows for this package repo
- `templates/github/deploy.workflow.yml`: downstream tenant deploy workflow template

The canonical fixture source lives in `treeseed-fixtures`. `core/fixture` is the checked-in local mirror that package scripts build against.

## Commands

### Core development

```bash
npm run fixtures:check
npm run build:dist
npm run test:unit
npm run check
npm run build
npm run test:smoke
```

What they do:

- `fixtures:check`: verifies that `core/fixture` matches the pinned shared fixture when the submodule is initialized
- `build:dist`: builds the publishable `dist/` package output
- `test:unit`: runs package unit tests with Vitest
- `check`: runs `astro check` against the internal fixture app
- `build`: builds the internal fixture app in production-like mode
- `test:smoke`: runs the packed-install smoke test

To refresh the local mirror from the shared fixture:

```bash
npm run fixtures:sync
```

### Full verification

```bash
npm run verify
```

`npm run verify` is an alias for `npm run release:verify`. The verification chain is:

1. `npm run build:dist`
2. `npm run test:unit`
3. `npm run check`
4. `npm run build`
5. `npm run test:smoke`

If this command passes, the package is in the same state expected by CI and the publish workflow.

### Release commands

```bash
npm run release:check-tag -- treeseed-core-v0.0.1
npm run release:publish
```

- `release:check-tag` validates that a git tag matches the version in [`package.json`](./package.json)
- `release:publish` publishes the package to npm

## GitHub Actions

This repo ships two package workflows:

- [`ci.yml`](./.github/workflows/ci.yml): runs on push and pull request, installs with `npm ci`, then runs `npm run verify`
- [`publish.yml`](./.github/workflows/publish.yml): runs on `workflow_dispatch` and on tags matching `treeseed-core-v*`; it installs with `npm ci`, validates the tag with `release:check-tag`, runs `npm run verify`, and publishes with `NPM_TOKEN`

The deploy workflow template at [`templates/github/deploy.workflow.yml`](./templates/github/deploy.workflow.yml) is for downstream Treeseed site repositories, not for publishing this package.

## Consumer Contract

The package publishes built artifacts from `dist/` and exposes runtime entrypoints through [`package.json`](./package.json) `exports`.

The published package includes:

- `dist/`
- `tsconfigs/`
- `templates/`
- `style/`
- `utils/`
- `README.md`

The package currently depends on:

- `@treeseed/sdk`
- Astro and Starlight runtime packages
- Tailwind/Vite integration used by the site runtime
- Wrangler for Cloudflare-oriented runtime and deploy support

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
3. Create a matching tag: `treeseed-core-v<version>`.
4. Push the tag or run the publish workflow manually.

The publish workflow expects the npm auth token in `NPM_TOKEN`.
