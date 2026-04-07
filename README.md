# @treeseed/core

`@treeseed/core` is the Treeseed platform runtime package for content-driven sites deployed as:

- a static Astro site
- a tiny Cloudflare Worker for runtime API concerns
- one D1 database per site
- two KV namespaces per site

The package is designed to be installed from npm by downstream tenant repositories. Its current location inside this monorepo is temporary and exists only so the Karyon tenant and the package can be developed together while the platform stabilizes.

## Consumer Contract

- Node `>=20`
- install alongside `@treeseed/cli` in a tenant repository
- the package root exports Node-safe runtime utilities only
- Astro and Starlight integration is available through explicit subpath exports

## What The Package Owns

`@treeseed/core` is intended to own Treeseed framework and platform runtime behavior for a tenant site:

- Astro and Starlight integration
- shared layouts, components, routes, and styles
- forms runtime and Cloudflare Worker implementation
- plugin contracts and built-in provider/runtime behavior
- shared deploy/site/content/forms runtime behavior
- generated book exports
- agent-facing plugin contracts, handler/runtime types, and built-in adapter behavior
- starter/template assets consumed by `@treeseed/cli`

A tenant repository should mainly keep:

- `treeseed.site.yaml`
- `src/config.yaml`
- `src/manifest.yaml`
- `src/content/**`
- `src/agents/*.ts`
- `public/`
- `src/env.d.ts`
- `migrations/`
- thin `astro.config.mjs` and `src/content.config.ts` wrappers

## Installation

In a normal consumer repository:

```bash
npm install @treeseed/core @treeseed/cli
```

A typical tenant `package.json` is expected to expose Treeseed through scripts like:

```json
{
  "scripts": {
    "dev": "treeseed dev",
    "dev:watch": "treeseed dev --watch",
    "build": "treeseed build",
    "check": "treeseed check",
    "deploy": "treeseed deploy",
    "destroy": "treeseed destroy",
    "preview": "treeseed preview"
  }
}
```

Inside this monorepo, contributors develop through the npm workspace rooted at `docs/`. The Karyon tenant resolves `@treeseed/core` locally through workspace linking, but downstream consumers are still expected to install from npm.

## Initialization Process

This section describes the practical initialization flow for a brand-new Treeseed site or a fresh machine setup. The goal is simple: get from zero to editing content with as little guesswork as possible.

### What A Minimal Treeseed Site Needs

A working tenant repository needs four things:

1. the Treeseed packages installed
2. a valid tenant file layout
3. a local environment file
4. a small set of commands the contributor can rely on every day

At minimum, a tenant should contain:

- `package.json`
- `treeseed.site.yaml`
- `src/config.yaml`
- `src/manifest.yaml`
- `src/content/**`
- `public/`
- `migrations/`
- `astro.config.mjs`
- `src/content.config.ts`
- `src/env.d.ts`

Treeseed deliberately keeps framework internals in the packages and project payload in the tenant.

### Fastest Setup Path For A New Tenant Repo

In a new repo:

```bash
npm install @treeseed/core @treeseed/cli
```

Then add the standard scripts:

```json
{
  "scripts": {
    "dev": "treeseed dev",
    "dev:watch": "treeseed dev --watch",
    "lint": "treeseed lint",
    "test": "treeseed test",
    "build": "treeseed build",
    "check": "treeseed check",
    "deploy": "treeseed deploy",
    "destroy": "treeseed destroy",
    "preview": "treeseed preview"
  }
}
```

If you want Treeseed to scaffold a starter project, use:

```bash
treeseed init my-site
cd my-site
npm install
```

That scaffolded site is the intended consumer contract for this package.

### Fastest Setup Path In This Monorepo

For Karyon contributors working in this repository:

```bash
cd docs
npm install
cp .env.local.example .env.local
npm run dev
```

From there you can immediately start editing:

- `docs/src/content/pages/*.mdx`
- `docs/src/content/notes/*.mdx`
- `docs/src/content/books/*.mdx`
- `docs/src/content/knowledge/**`

## Required Configuration Files

Treeseed uses a layered configuration model. These files matter for different reasons and it helps to understand the separation clearly.

### `treeseed.site.yaml`

This is the deploy-time contract.

It defines:

- site identity
- slug and site URL
- Cloudflare account and worker naming
- plugin loading
- provider selection
- SMTP enablement
- Turnstile enablement

Example:

```yaml
name: Karyon
slug: karyon-docs
siteUrl: https://karyon.life
contactEmail: contact@karyon.life
cloudflare:
  accountId: bf5e29987a8968cae9f2a2cbd87ff966
  workerName: karyon-docs
plugins:
  - package: '@treeseed/core/plugin-default'
providers:
  forms: store_only
  agents:
    execution: stub
    mutation: local_branch
    repository: stub
    verification: stub
    notification: stub
    research: stub
  deploy: cloudflare
  content:
    docs: default
  site: default
smtp:
  enabled: false
turnstile:
  enabled: true
```

This file is the source of truth for:

- which Treeseed plugins load
- which provider ids are selected
- which deploy target is active

### `src/config.yaml`

This is the public site configuration.

It usually controls:

- branding
- titles
- navigation
- site identity
- public-facing URLs and labels

### `src/manifest.yaml`

This is the tenant content and feature contract.

It controls:

- what content areas exist
- feature enablement
- tenant content roots and behavior
- agent/runtime-facing content contracts

### `astro.config.mjs` and `src/content.config.ts`

These are intentionally thin. They should mount the Treeseed package behavior rather than reinvent framework wiring in each tenant.

## Environment Variables

Treeseed setup becomes much easier when the environment is understood in tiers.

### Tier 1: Required For Basic Local Development

These are enough to run a local site and make content changes:

- `TREESEED_LOCAL_DEV_MODE=cloudflare`
- `TREESEED_FORM_TOKEN_SECRET`
- `TREESEED_FORMS_LOCAL_USE_MAILPIT=true`
- `TREESEED_MAILPIT_SMTP_HOST=127.0.0.1`
- `TREESEED_MAILPIT_SMTP_PORT=1025`
- `TREESEED_MAILPIT_UI_PORT=8025`

Recommended local defaults:

- `TREESEED_FORMS_LOCAL_BYPASS_TURNSTILE=true`
- `TREESEED_PUBLIC_FORMS_LOCAL_BYPASS_TURNSTILE=true`
- `TREESEED_FORMS_LOCAL_BYPASS_CLOUDFLARE_GUARDS=false`

These let contributors run forms locally without production Turnstile keys while still keeping the rest of the local runtime close to production shape.

### Tier 2: Required For Local Email And Contact Routing

- `TREESEED_SMTP_HOST`
- `TREESEED_SMTP_PORT`
- `TREESEED_SMTP_USERNAME`
- `TREESEED_SMTP_PASSWORD`
- `TREESEED_SMTP_FROM`
- `TREESEED_SMTP_REPLY_TO`
- `TREESEED_CONTACT_ROUTING_JSON`
- `TREESEED_SUBSCRIBE_NOTIFY_RECIPIENTS`

When Mailpit is enabled, these can stay local and non-secret.

### Tier 3: Required For Real Turnstile

- `TREESEED_PUBLIC_TURNSTILE_SITE_KEY`
- `TREESEED_TURNSTILE_SECRET_KEY`

These are optional for local authoring if Turnstile bypass is enabled.

They are effectively required for production forms when Turnstile is enabled in `treeseed.site.yaml`.

### Tier 4: Required For Real Deploys

- `CLOUDFLARE_API_TOKEN`
- `TREESEED_FORM_TOKEN_SECRET`
- `TREESEED_PUBLIC_TURNSTILE_SITE_KEY`
- `TREESEED_TURNSTILE_SECRET_KEY`
- SMTP secrets when SMTP-backed forms are enabled

Cloudflare account IDs and worker names belong in `treeseed.site.yaml`. Secrets belong in environment or CI secret stores.

### Tier 5: Required For `treeseed save` With Real GitHub Automation

Treeseed save now validates GitHub automation prerequisites before it mutates the repo.

For a real save against a real repo, you should expect to need:

- valid `gh` authentication
- any required deploy secret env vars if save is expected to sync them

At minimum:

- `gh auth login -h github.com`
- `CLOUDFLARE_API_TOKEN`
- `TREESEED_FORM_TOKEN_SECRET`
- `TREESEED_PUBLIC_TURNSTILE_SITE_KEY`
- `TREESEED_TURNSTILE_SECRET_KEY`

For local or automated test verification, Treeseed also supports a stub automation mode so save can be proven end-to-end without touching real GitHub automation.

## Local Environment File Contract

The normal local setup pattern is:

```bash
cp .env.local.example .env.local
```

Files and roles:

- `.env.local`
  Human-edited local configuration

- `.dev.vars`
  Generated Wrangler-local environment file

- `.env.local.example`
  Starter environment contract for local development

The safest workflow is:

1. edit `.env.local`
2. run `treeseed sync:devvars`
3. restart local dev if needed

## Contributor Workflow From A Fresh Machine

For a brand-new contributor working on a Treeseed tenant, the recommended sequence is:

1. install Node, npm, Docker, and Git
2. clone the repo
3. install dependencies
4. copy `.env.local.example` to `.env.local`
5. run `npm run dev`
6. make a content change
7. run `npm run lint`
8. run `npm run test`
9. run `npm run build`

At that point the contributor is fully productive for normal content work.

## Save And Deploy Initialization Notes

Treeseed now runs stronger preflight validation.

### `treeseed save`

Before it creates a commit or pushes anything, it now checks:

1. message and branch/origin validity
2. auth and required env prerequisites
3. `lint`
4. `test`
5. `build`

Only after those pass does it:

- compute version changes
- install if needed
- commit
- rebase from `origin/main`
- verify changed packages
- sync GitHub automation
- push

### `treeseed deploy`

Before it mutates deploy resources, it now checks:

1. `lint`
2. `test`
3. `build`
4. deploy auth and required secret inputs

That means contributors can trust early failures to happen before Cloudflare or GitHub state changes.

## Making Content Changes Quickly

For content-focused contributors, the simplest mental model is:

- `@treeseed/core` owns framework behavior
- the tenant owns Markdown, config, and assets
- `treeseed dev` is the main entrypoint

The highest-value places to edit are usually:

- `src/content/pages/*.mdx`
- `src/content/notes/*.mdx`
- `src/content/books/*.mdx`
- `src/content/knowledge/**`
- `public/*`
- `src/config.yaml`

If someone only wants to update site content, they should not need to touch package internals in `core`, `cli`, `sdk`, or `agent`.

## Tenant CLI

Installed tenants use the `treeseed` CLI from `@treeseed/cli`.

Package roles:

- `@treeseed/sdk`: minimal shared data/runtime base
- `@treeseed/core`: framework and platform runtime
- `@treeseed/cli`: operator-facing `treeseed` command package
- `@treeseed/agent`: long-running agent service package behind `treeseed-agents`

Core commands:

- `treeseed dev`
- `treeseed dev --watch`
- `treeseed build`
- `treeseed check`
- `treeseed preview`
- `treeseed deploy`
- `treeseed destroy`
- `treeseed init <directory>`

Additional helpers:

- `treeseed mailpit:up`
- `treeseed mailpit:down`
- `treeseed mailpit:logs`
- `treeseed sync:devvars`
- `treeseed d1:migrate:local`
- `treeseed cleanup:markdown`
- `treeseed cleanup:markdown:check`
- `treeseed test:unit`
- `treeseed test:integration`
- `treeseed test:e2e`
- `treeseed test`
- `treeseed agents`

`treeseed destroy` is intentionally dangerous. By default it prints the Worker, D1, and KV resources it is about to delete and requires typed confirmation matching the tenant slug.

## Deploy Model

Treeseed deploys one isolated site at a time.

Per site, the package provisions or reconciles:

- one Cloudflare Worker
- one D1 database
- one `FORM_GUARD_KV` namespace
- one `SESSION` namespace

For the Karyon tenant, the D1 database name is now `karyon-docs-site-data`, reflecting that the database stores broader site data rather than only subscribers.

Deployment inputs are read from `treeseed.site.yaml` and tenant config files. The package generates operational artifacts such as:

- `.treeseed/generated/wrangler.toml`
- `.treeseed/state/deploy.json`
- `.treeseed/generated/worker/`

These are runtime artifacts, not source files.

A tenant CI workflow should call `npm run deploy` from the tenant root so automated deploys use the same Treeseed provisioning and publish path as local deploys. Avoid separate `wrangler pages deploy` or ad hoc Worker publish steps that bypass the generated Treeseed deploy contract.

## Plugin System

Treeseed now uses an explicit plugin system configured in `treeseed.site.yaml`.

Each tenant declares:

- `plugins`: an ordered list of plugin packages to load
- `providers`: the selected implementation id for each singular extension point

Treeseed loads plugins in declaration order, validates that each selected provider id exists, and then routes site build, forms runtime, worker runtime, agent runtime, and deploy behavior through the resolved plugin runtime.

Typical config:

```yaml
plugins:
  - package: '@treeseed/core/plugin-default'
providers:
  forms: store_only
  agents:
    execution: stub
    mutation: local_branch
    repository: stub
    verification: stub
    notification: stub
    research: stub
  deploy: cloudflare
  content:
    docs: default
  site: default
```

### Built-In Plugin

Treeseed currently ships one built-in first-party plugin:

- `@treeseed/core/plugin-default`

This plugin declares the built-in provider ids and handler ids that make the default Treeseed platform work out of the box. Tenants should usually keep this plugin in their `plugins` list unless they are replacing the entire default platform surface.

### Built-In Provider Ids

Forms providers:

- `store_only`
- `notify_admin`
- `full_email`

Agent providers:

- `agents.execution`: `stub`, `manual`, `copilot`
- `agents.mutation`: `local_branch`
- `agents.repository`: `stub`, `git`
- `agents.verification`: `stub`, `local`
- `agents.notification`: `stub`
- `agents.research`: `stub`

Other providers:

- `deploy`: `cloudflare`
- `content.docs`: `default`
- `site`: `default`

### Default Provider Behavior

Forms:

- `store_only`: persists contact and subscriber data, enforces guards and Turnstile, and sends no email
- `notify_admin`: keeps the same persistence path and sends admin notifications when SMTP is available
- `full_email`: requires SMTP, sends admin notifications, and also sends the built-in subscriber confirmation email

Agents:

- `stub` execution: returns a synthetic completed result without calling an external tool
- `manual` execution: emits a manual handoff payload for operator-driven execution
- `copilot` execution: invokes `gh copilot` with the normalized agent CLI options
- `local_branch` mutation: writes artifacts into a git worktree/branch and commits them
- `stub` repository inspection: returns a no-op branch inspection result
- `git` repository inspection: inspects changed paths and HEAD sha from the local repo
- `stub` verification: reports success without running commands
- `local` verification: runs configured verification commands via `/bin/bash -lc`
- `stub` notification: records prepared notifications without delivering them externally
- `stub` research: returns placeholder research markdown

Content and site:

- `content.docs: default`: uses the Starlight docs loader and schema, keeps Treeseed’s generated knowledge doc ids, and extends docs entries with default tags
- `site: default`: keeps the built-in routes, Starlight component overrides, theme injection, markdown plugins, env schema, and route middleware
- `deploy: cloudflare`: keeps the current Cloudflare worker, D1, KV, generated Wrangler config, and worker artifact flow

### Extension Points

Plugin authors can now extend or replace these seams:

- forms provider selection through `providers.forms`
- agent adapter providers through `providers.agents.*`
- agent handler registration through plugin-contributed handler ids
- site provider selection through `providers.site`
- additive site hooks for routes, Starlight component overrides, custom CSS, markdown plugins, env schema additions, Vite plugins, integrations, and route middleware
- docs content provider selection through `providers.content.docs`

In practical terms, the current runtime seams are:

- forms runtime collaborators: guard store, subscriber store, contact store, email delivery, Turnstile verification, and provider-specific behavior
- agent runtime collaborators: execution, mutation, repository inspection, verification, notification, research, and agent handlers
- Astro site composition: routes, integrations, component overrides, markdown hooks, theme/css injection, env schema, and middleware
- content composition: docs loader/schema resolution
- deploy/runtime selection: the selected deploy provider id carried through deploy generation

### Plugin Authoring Contract

Core exports:

- `defineTreeseedPlugin`
- `loadTreeseedPlugins`
- `loadTreeseedPluginRuntime`

Third-party plugins may contribute:

- metadata describing which provider ids they supply
- `formsProviders`
- `agentProviders`
- `agentHandlers`
- `siteProviders`
- `siteHooks`
- `contentProviders`

Treeseed treats singular providers and additive hooks differently:

- singular providers are selected by id through `providers`
- additive hooks are composed in plugin declaration order

Duplicate contributed provider ids are treated as startup errors. Unknown selected provider ids are also startup errors.

## Forms Runtime

Forms behavior now comes from the selected `providers.forms` plugin implementation in `treeseed.site.yaml`.

The built-in forms provider ids are:

- `store_only`
- `notify_admin`
- `full_email`

This keeps the default platform affordable and usable without SMTP, while still allowing richer behavior when a tenant explicitly selects a richer provider.

Turnstile is part of the standard production deploy contract. Treeseed deploy expects `TREESEED_PUBLIC_TURNSTILE_SITE_KEY` and `TREESEED_TURNSTILE_SECRET_KEY` to be provided for production publishes.

## Agent Runtime

Agent execution behavior now comes from `providers.agents.execution` in `treeseed.site.yaml`.

The built-in execution provider ids are:

- `stub`
- `manual`
- `copilot`

This keeps new sites usable without paid AI execution tooling and lets tenants opt into more capable execution providers later.

## Local Development Model

Treeseed keeps a unified local environment:

- static site build output
- tiny Worker runtime for `/api/*`
- Mailpit for local email testing
- local D1 and KV bindings
- generated book exports

`treeseed dev` starts the normal unified local environment.

`treeseed dev --watch` keeps the same runtime model but adds rebuild and browser refresh support for active package development.

Mailpit is package-managed. Tenant repositories do not need their own `compose.yml`.

## Scaffolded Tenant Contract

`treeseed init` scaffolds a new tenant with the package-first contract.

Expected tenant-owned structure:

- `treeseed.site.yaml`
- `src/config.yaml`
- `src/manifest.yaml`
- `src/content/**`
- `src/agents/*.ts`
- `public/`
- `migrations/`
- `astro.config.mjs`
- `src/content.config.ts`
- `src/env.d.ts`

Generated books under `public/books/*.md` are build artifacts and should not be committed.

Tenant branding assets should live in `public/` and be referenced through public paths and `src/config.yaml`.

## Package Development In This Repository

While the package still lives here, the preferred contributor entrypoint is the workspace root at `docs/`.

Use the workspace root when you need layered development or release verification:

- `npm install`
- `npm run dev`
- `npm run dev:watch`
- `npm run test:unit`
- `npm run test:release`
- `npm run release:publish:changed`

Run package-local commands from `docs/packages/core/` when you need to focus on `core` in isolation.

Useful commands:

- `npm run build:dist`: build the published `dist/` package output
- `npm run check`: validate the internal fixture app
- `npm run build`: build the internal fixture app
- `npm run test:unit`: fast package-level tests
- `npm run release:verify`: package-local release verification flow before publishing

The workspace root also offers two release-smoke levels:

- `npm run test:release`: faster tarball smoke for local iteration
- `npm run test:release:full`: full tarball smoke including scaffold deploy dry-run

When `@treeseed/sdk` changes, the workspace dev loop rebuilds `sdk`, then `core`, then the tenant runtime so local testing stays close to hot reload without publishing intermediate artifacts.

The fixture app under `fixture/` exists only for package development and verification. It is not part of the downstream tenant contract.

## Publishing

The package publishes built artifacts from `dist/`.

Release flow:

1. update the package version in `package.json`
2. run `npm run release:verify`
3. create a matching git tag: `treeseed-core-v<version>`
4. publish through the release workflow or `npm run release:publish`

This package uses a `files` whitelist and generated `dist/` exports so downstream consumers do not depend on the raw source tree.

## Temporary Monorepo Context

A few repository details in this workspace are temporary and should not be treated as part of the long-term public interface:

- the package source currently lives under `docs/packages/core/`
- the Karyon tenant currently resolves the package through the local npm workspace during contributor development
- fixture and workspace scripts exist to help package development before extraction

The long-term contract is npm-first: tenants install `@treeseed/core` for runtime behavior and `@treeseed/cli` for commands, then interact with the platform through the `treeseed` CLI and core exported entrypoints.
