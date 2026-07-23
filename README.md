# @treeseed/core

`@treeseed/core` is the Treeseed web runtime for Astro/Starlight sites. Use it when you want a Treeseed-compatible site that can load tenant configuration, compose package plugins, render content, run local development, and participate in Treeseed web hosting workflows.

Core is not the admin portal, the reusable component library, the agent runtime, or the capacity provider runtime. `@treeseed/admin` contributes admin routes, `@treeseed/ui` contributes layout-down components and styles, and `@treeseed/agent` owns AgentKernel execution and provider runtime.

## What You Can Build With Core

- Treeseed-compatible Astro/Starlight sites
- host applications that layer packages through `treeseed.site.yaml`
- local development sessions through `trsd dev`
- web-only Cloudflare hosting surfaces
- content and site runtime integration for Treeseed tenants

## Install

```bash
npm install @treeseed/core @treeseed/sdk @treeseed/ui
```

For package development from this repository:

```bash
npm install
npm run verify:local
```

## Use Core In A Site

A host site declares plugins in `treeseed.site.yaml`:

```yaml
plugins:
  - package: "@treeseed/core/plugin-default"
  - package: "@treeseed/admin/plugin"
```

Core loads site layers, resolves routes, merges plugin hooks, and builds the Astro config used by the host app. The host app still owns deployment, tenant config, content, and branding.

Core public and content routes compose through UI public layouts and public shell behavior. Knowledge Hub, book, documentation, profile-like content, and generated content pages must remain public single-column or reader experiences; they must not adopt authenticated app chrome, team operations, operational market drawers, or admin control surfaces. Authenticated app, operational market, auth/session, and admin view-model behavior belongs in `@treeseed/admin` and the host Market app.

## Local Development

The installable CLI delegates local web runtime orchestration to Core:

```bash
npx trsd dev
npx trsd dev start --web-runtime local --json
npx trsd dev status --all --json
npx trsd dev logs --follow
npx trsd dev stop --json
```

In the Treeseed market workspace, the web process runs from the root repo, while API and operations-runner processes run from `packages/api`.

## How Core Fits With Other Packages

- `@treeseed/ui` owns reusable components and styles.
- `@treeseed/admin` owns admin routes, middleware, view models, and admin behavior.
- `@treeseed/market` hosts the concrete Treeseed public site, authenticated operational marketplace, and Commons participant pages.
- `@treeseed/api` owns backend API, PostgreSQL, migrations, and operations runner.
- `@treeseed/sdk` owns reconciliation, config, workflow, graph, and shared platform contracts.
- `@treeseed/agent` owns capacity-provider runtime, AgentKernel execution, mode scheduling, and provider-local lifecycle.
- TreeDX is consumed through SDK/API integration when repository intelligence is configured.

Core should stay reusable as a web runtime package and should not duplicate admin, API, agent, or market business logic.

## Package Layout

- `src/`: package source
- `scripts/`: build, release, and verification scripts
- `tests/`: package tests organized by unit, integration, contract, fixtures, and support responsibilities
- `.fixtures/treeseed-fixtures/`: shared integrated fixture
- `.github/workflows/`: package CI and publish workflows
- `templates/github/deploy-web.workflow.yml`: downstream tenant web deploy workflow template

## Commands

```bash
npm run dev
npm run dev:web
npm run fixtures:check
npm run build:dist
npm run test:unit
npm run check
npm run build
npm run test:smoke
npm run verify:local
```

The direct verification chain is:

1. build distributable `dist/`
2. run unit tests
3. run Astro check against the shared fixture
4. build the fixture app
5. run packed-install smoke tests

## Shared Fixture

Core validates itself against the integrated shared fixture rather than a Core-specific fork. The fixture may reference SDK, Core, Admin, UI, API, CLI, and Agent surfaces where the canonical integrated project genuinely uses them. Package verification adapts to the fixture; it must not rewrite the fixture to satisfy one package.

## GitHub Actions And Release

Package workflows verify and publish the package from this repository. The downstream web deploy workflow template is for host applications, not for publishing Core.

```bash
npm run release:check-tag -- 0.1.0
npm run release:publish
```

The publish workflow expects `NPM_TOKEN` in the package repository GitHub `production` environment.

## What Core Does Not Own

- reusable layout-down UI primitives; use `@treeseed/ui`
- admin routes, auth/session UI, admin middleware, or admin view models; use `@treeseed/admin`
- backend API implementation, PostgreSQL, operations runner, or migrations; use `@treeseed/api`
- capacity provider runtime; use `@treeseed/agent`
- AgentKernel execution, mode scheduling, and provider assignment runtime; use `@treeseed/agent` with SDK/API contracts
- checkout, billing, licensing, backend ecommerce state, PostgreSQL migrations, operations-runner behavior, or marketplace policy; use root market for authenticated operational marketplace/cart/checkout/service/capacity/Commons surfaces and `@treeseed/api` for backend state
- TreeDX service implementation

See the root [Package Ownership](../../docs/package-ownership.md) guide for the full package map.
