---
id: objective:core-core
title: TreeSeed Core Core Objective
description: TreeSeed Core should provide the Treeseed web runtime for Astro and Starlight sites, including tenant configuration loading, package plugin composition, content rendering, local development, and web hosting workflows.
date: 2026-06-22
summary: TreeSeed Core exists to provide the Treeseed web runtime for Astro and Starlight sites, including tenant configuration loading, package plugin composition, content rendering, local development, and web hosting workflows while preserving its package boundary.
status: live
timeHorizon: long-term
motivation: Package-local workdays need a stable north star from the README so humans and agents can plan, execute, review, and report work without drifting across package ownership boundaries.
primaryContributor: core-steward
relatedQuestions: []
relatedBooks: []
---

TreeSeed Core exists to provide the Treeseed web runtime for Astro and Starlight sites, including tenant configuration loading, package plugin composition, content rendering, local development, and web hosting workflows.

This core objective is the starting direction for the TreeSeed Core Knowledge Hub. It should influence every package-local workday, research note, implementation proposal, generated artifact, approval request, and release-readiness summary.

Core should stay a reusable web runtime. It must not own admin workflows, reusable UI primitives, backend API implementation, capacity provider runtime, AgentKernel execution, ecommerce policy, or TreeDX service internals.

Agents working in this project should keep outputs grounded in the package README, package-local source evidence, and the TreeSeed package ownership map. When a task would cross into another package's authority, the agent should describe the boundary and route the work to the correct project instead of mutating outside this hub.
