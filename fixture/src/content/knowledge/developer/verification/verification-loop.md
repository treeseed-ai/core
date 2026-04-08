---
title: Verification loop
description: How the fixture participates in the package verification chain.
sidebar:
  order: 1
---

The fixture is part of verification, not an optional demo. `check`, `build`, and smoke validation all depend on it staying coherent. If a change breaks the fixture, that is usually a package usability signal, not just a content problem.
