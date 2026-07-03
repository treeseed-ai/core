# Changelog

## [0.12.16] - 2026-07-03

### Changed

- Release metadata and deployment history updated.

## [0.12.15] - 2026-07-03

### Changed

- Release metadata and deployment history updated.

## [0.12.14] - 2026-07-03

### Changed

- Release metadata and deployment history updated.

## [0.12.13] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.12] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.11] - 2026-07-02

### Fixed

- fix(release): advance staging sdk lock recovery ref (9c3387e676ea)
- fix(release): advance staging sdk ref (0ab4b809340a)
- fix(release): advance staging sdk verification ref (51ac92935b53)
- fix(release): advance staging sdk reference (9b2b67f837cd)
- fix(release): restore staging dependency refs (a94f5c4b8386)

## [0.12.10] - 2026-07-02

### Fixed

- fix(release): restore staging dependency refs (e3417d91f79f)

## [0.12.9] - 2026-07-02

### Fixed

- fix(release): refresh SDK staging ref (1fcfc4fa70aa)
- fix(release): use staging commit refs (cdee286a7db7)

## [0.12.8] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.7] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.6] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.5] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.4] - 2026-07-02

### Fixed

- fix(release): publish plain semver tags (6fa63d0027c1)

## [0.12.3] - 2026-07-02

### Changed

- Release metadata and deployment history updated.

## [0.12.2] - 2026-07-01

### Changed

- Release metadata and deployment history updated.

## [0.12.1] - 2026-07-01

### Changed

- Release metadata and deployment history updated.

## [0.12.0] - 2026-07-01

### Fixed

- build(build): fix image release root directory verification (b4890244a92a)
- build(build): fix Railway runtime config verification (4457a7bd7535)
- build(build): fix release guarantee API verifiers (0b0e8766106d)
- build(build): fix staging release guarantee auth (c07b56a7571a)
- build(build): fix production release gates (92527b133b8e)
- build(build): promotion proof after CI and acceptance fixes (b76e7d0bc749)
- build(build): fix SDK proof regressions after guarantee framework (f3dc2cb73e7e)
- build(build): fix proof tests for clean hosted runners (ea2e4ee8f5dc)
- build(build): fix core hosted proof railway dependency lock (2453e774a16f)
- build(build): fix promotion release gate assertions (9a24cfbc25dd)
- build(build): fix TreeDX release gate Beam setup (cbb52dd683e6)
- build(build): fix scoped project domains for staging Pages (6c0fdf35c86a)
- build(build): fix Railway deploy live verification settle window (72c7dbc93fd6)
- build(build): fix Railway runtime secret sync for staging smoke (f6f6baee32f3)
- build(build): fix staging hosted service credential and Railway source (6e16c2548435)
- build(build): fix Railway IaC-only reconciliation and TreeDX env names (762512e48eee)
- ci(build): fix Railway staging Dockerfile builds and persistent volumes (bf5b79b47403)
- build(build): fix staging Railway source builds and volumes (693e41bf4934)
- build(build): fix API staging source builds and runner volumes (e92b0bab972b)
- build(build): fix api and agent staging source builds (4a63f43abcc6)
- 20 additional changes omitted from this summary.

### Tests

- build(build): remove legacy Mailpit dev hooks (50cc2380e9be)
- build(build): restore Mailpit as reconciled local dev service (49064ac82a58)
- build(build): checkpoint before verify action and local dev stack (662b723c2025)

### Dependencies

- build(build): allow first production API domain validation (fcf91be265e9)
- build(build): merge package main history back to staging (ea2ee047c305)
- build(build): checkpoint user and team guarantees passing locally (149625e514aa)
- build(build): replace legacy strict tail with proof ledger (0ca8e5fd1f97)
- build(build): implement incremental release proof (1a6754fe2ea4)
- build(build): pin hosted workflow API domains to treeseed.dev (558e6515743b)
- build(build): use configured API domains for hosted reconciliation (3343414134d4)
- build(build): include domain units in promotion hosted reconciliation (be8f60f6aff6)
- build(build): switch hosted domains to treeseed.dev (8011331175ae)
- build(build): harden Railway IaC reconciliation and domain verification (1d662a566cec)
- build(build): repair managed worktree cleanup after docker verification (ac80475336f5)
- build(build): harden action verification and document independent (21a73c7fb4e3)
- build(build): exclude build artifacts from stage proof workspace (e3b3e94137a2)
- build(build): update stage command help text (9860ea8c9659)
- build(build): rework stage promotion workflow (2ddbc63e9484)
- build(build): use image-backed Railway API staging services (f191ce33e17f)
- build(build): skip opaque railway sync provider errors after retries (f27b8bd3c613)
- build(build): tolerate railway deploy trigger processing errors (3b53fad9956c)
- build(build): retry transient railway hosted sync failures (98319afd6732)
- build(build): tolerate railway existing service source update limits (806ee6a323f6)
- 17 additional changes omitted from this summary.

## [0.11.0] - 2026-06-12

### Fixed

- build(core): update version and @treeseed/sdk dependency (39d93a1af6f4)
- build(build): fix package deploy gate timeout and hybrid save validation (f4cc9d90147a)
- fix(core): update package version and @treeseed/sdk dependency (6274230aa863)
- build(build): fix staging web monitor and ui edge theme runtime (5086ef05b797)
- build(build): fix workspace deployment install readiness (630480bdfe7a)
- build(build): fix ui pages staging reconciliation (9807a7443cbe)
- build(build): fix package app cloudflare auth (96466368197c)
- build(build): fix package hosted config sync and api deploy environment (c7355ce2ad01)
- build(build): fix hosted repository gates and root lockfile refresh (b31a9a9fcc37)
- build(build): fix manifest package save gates (10ff9bbc1646)
- build(build): complete Market API package migration hosted checker fix (a8652e5fe647)

### Tests

- build(build): stage package submodule restructuring (7ce869c69fe6)
- build(ui): migrate reusable ui components to treeseed ui (0b0d8c3cbaf1)
- build(build): stabilize github credential test for configured scoped (99e002e7af0e)
- build(build): Save reconciliation platform and live acceptance updates (18ca2b9d0aae)
- build(release): complete Market API package migration (84efe8b05635)
- build(build): complete Market API package migration (11da17dba4d7)

### Dependencies

- build(build): stage package submodule restructuring (95c162d65369)
- build(build): add fast and promotion save lanes (0fef60faf371)
- build(core): bump version and update @treeseed/sdk (403c34e02d7b)
- build(build): bound git dependency smoke checks (ecd10e8a27f0)
- build(build): build ui artifacts for hosted deploy (53f721199410)
- build(build): migrate reusable ui components to treeseed ui (eb75b086f6d0)
- build(build): migrate reusable ui components to treeseed ui (f7bbfb2e8d06)
- build(build): migrate reusable ui components to treeseed ui (15e8137814d8)
- build(build): migrate reusable ui components to treeseed ui (d33d78794c77)
- build(build): integrate treeseed ui (81a446d91328)
- build(build): sync package dependency references (c5d7fddcc68f)
- build(build): Push clean hosted project repositories during save (7c892ea68a43)
- build(build): Install project dependencies before hosted project (ee8ec01c2ffd)
- build(build): Install project dependencies before hosted project (78841d8daed6)
- build(build): Install project dependencies before hosted project (f5fdf606c5eb)
- build(build): Treat API as a hosted project with verification gates (56c821306518)
- build(build): Move API deployment acceptance into API package (3998b17da968)
- build(build): Save reconciliation platform and live acceptance updates (28846752814f)
- build(build): Save reconciliation platform and live acceptance updates (7ef01a1fb92f)
- build(build): document and harden staging release workflow (516599541c49)
- 16 additional changes omitted from this summary.

## [0.10.22] - 2026-06-05

### Added

- feat(templates): introduce sourceRef for template identification (7e4386f905e9)

### Dependencies

- Release @treeseed/core 0.10.22.

## [0.10.21] - 2026-06-04

### Added

- feat(dev): introduce integrated managed development (e5dfdcd785ce)

### Dependencies

- build(core): bump version and update @treeseed/sdk (d2a37cb1ee60)
- Release @treeseed/core 0.10.21.

## [0.10.20] - 2026-06-04

### Dependencies

- Release @treeseed/core 0.10.20.

## [0.10.19] - 2026-06-04

### Added

- feat(templates): add launch requirements to site templates (561fb3ec749f)

### Dependencies

- build(build): sync package dependency references (1d318815fd8d)
- chore(core): bump version and update @treeseed/sdk (d665a5f89c37)
- build(core): bump version and update @treeseed/sdk (c8ff1a42172c)
- build(build): sync package dependency references (3cc10112384c)
- build(core): bump version and update @treeseed/sdk (4909ddd66cb3)
- chore(core): update version and @treeseed/sdk dependency (08d83c327dc9)
- Release @treeseed/core 0.10.19.

## [0.10.18] - 2026-06-02

### Tests

- refactor(forms): improve form control styles and consistency (3eb833e095e7)

### Dependencies

- ci(github): add timing summary support to deploy-web workflow (7aced547d04d)
- Release @treeseed/core 0.10.18.

## [0.10.17] - 2026-06-02

### Tests

- build(ui): sync package dependency references (3d045519b0a5)

### Dependencies

- chore(core): bump version and update @treeseed/sdk (04d1e76722a6)
- build(core): bump version and update @treeseed/sdk (9ec3428b8431)
- chore(deps): bump version and update @treeseed/sdk (b9480cd9db8c)
- build(core): update version and @treeseed/sdk dependency (1bed6eef9e05)
- build(core): bump version and update @treeseed/sdk (a013d0809107)
- chore(core): bump version and update turnstile env definitions (47bdf810e264)
- build(build): avoid Railway volume update after attach (ed0310000c26)
- chore(core): bump version and update @treeseed/sdk (7d6cbceabff8)
- Release @treeseed/core 0.10.17.

## [0.10.16] - 2026-05-28

### Dependencies

- build(build): avoid live queue lookup during destroy dry runs (1f4ccca8392e)
- build(build): harden provider cleanup api calls for clean destroy (31316b7f6ce3)
- build(build): wait for delayed Railway service instances before (7ce72e164690)
- Release @treeseed/core 0.10.16.

## [0.10.15] - 2026-05-28

### Dependencies

- build(build): force fresh deployed-resource verification on staging save (a09b09cac2bb)
- build(build): refresh Railway topology during verification (8e83815e8233)
- Release @treeseed/core 0.10.15.

## [0.10.14] - 2026-05-28

### Dependencies

- build(build): redeploy staging from clean provider state (893ea9bd608b)
- build(build): allow railway context link by project id (2e829bb10e70)
- build(build): link railway context before cli volume fallback (31a697f4219f)
- build(build): fallback railway environment creation when API is opaque (1a8d9a5f4fea)
- Release @treeseed/core 0.10.14.

## [0.10.13] - 2026-05-28

### Dependencies

- build(build): stabilize clean redeploy railway volume verification (92d9ba0b3fa3)
- build(build): handle already mounted railway volumes during clean (843eeff45e8a)
- build(build): attach railway runner volume before verifying mount (67b1d69f32ef)
- build(build): wait for railway service instance config to settle (7429b6e23781)
- Release @treeseed/core 0.10.13.

## [0.10.12] - 2026-05-28

### Dependencies

- build(build): use railway cli volume path for runner reconcile (2c967d30b651)
- build(build): do not create replacement volumes for railway postgres (c1f68a26fb9d)
- build(build): reuse railway managed postgres volume after not (5391010f2225)
- build(build): reuse railway postgres volume after create conflict (b3b339dccea9)
- build(build): wait for new railway service instances before runtime (2f0ff2506919)
- Release @treeseed/core 0.10.12.

## [0.10.11] - 2026-05-28

### Tests

- build(build): debug staging save from clean provider state (d0aafa77f664)

### Dependencies

- build(build): retry railway volume attach during clean redeploy (f58c775d7abe)
- build(build): prove staging destroy save loop from clean providers (cfe5774e23d1)
- build(build): debug staging save from clean provider state (82e7fbe4f896)
- build(build): debug staging save from clean provider state (e76559762aad)
- build(build): debug staging save from clean provider state (9662ec326b45)
- build(build): debug staging save from clean provider state (b57052745b04)
- build(build): debug staging save from clean provider state (85b35a7a0881)
- build(build): debug staging save from clean provider state (be50e7c8e579)
- build(build): debug staging save from clean provider state (9ec4db61b383)
- build(build): debug staging save from clean provider state (fd3aa1deae1b)
- build(ui): debug staging save from clean provider state (e2396635d6bb)
- build(build): debug staging save from clean provider state (0babf91d5747)
- build(build): debug staging save from clean provider state (1844503672c6)
- Release @treeseed/core 0.10.11.

## [0.10.10] - 2026-05-27

### Dependencies

- Release @treeseed/core 0.10.10.

## [0.10.9] - 2026-05-27

### Changed

- Sync SMTP env to Railway (51df3ec7ff9a)

### Dependencies

- build(build): update package metadata (ddd2b73ff3c1)
- build(core): bump version and update @treeseed/sdk (2773650c7adc)
- Release @treeseed/core 0.10.9.

## [0.10.8] - 2026-05-27

### Dependencies

- build(core): update version, dependencies, and CI workflow (0d7a550933f4)
- Release @treeseed/core 0.10.8.

## [0.10.7] - 2026-05-27

### Tests

- chore(core): bump version and update integrated dev tests (2aa3f2655487)
- build(ui): sync package dependency references (9b2565737bbe)

### Dependencies

- chore(core): bump version and update @treeseed/sdk (7651de821530)
- chore(deps): bump version and update @treeseed/sdk (717fb25961b0)
- build(build): sync package dependency references (a3657bb1e7fc)
- build(ui): sync package dependency references (0d736ca1e4f1)
- Release @treeseed/core 0.10.7.

## [0.10.6] - 2026-05-24

### Fixed

- build(build): fix sdk template source cache reuse (5de5e5721051)

### Dependencies

- build(core): bump version and update @treeseed/sdk (640fcf8b4503)
- build(build): make market postgres baseline adopt existing schema (819ebf23bb06)
- build(build): make static hub d1 baseline idempotent (4a7b8bae6690)
- refactor(dev): update development paths and migration logic (71df90af9950)
- Release @treeseed/core 0.10.6.

## [0.10.5] - 2026-05-23

### Dependencies

- Release @treeseed/core 0.10.5.

## [0.10.4] - 2026-05-23

### Dependencies

- Release @treeseed/core 0.10.4.

## [0.10.3] - 2026-05-23

### Dependencies

- build(deps): bump version and update @treeseed/sdk (389dac578150)
- Release @treeseed/core 0.10.3.

## [0.10.2] - 2026-05-22

### Dependencies

- build(core): bump version and update @treeseed/sdk (b30695ded4c0)
- build(core): bump version and update @treeseed/sdk (14db7a6eec13)
- build(build): sync package dependency references (77a5ee653114)
- Release @treeseed/core 0.10.2.

## [0.10.1] - 2026-05-22

### Dependencies

- build(core): bump version and update @treeseed/sdk dependency (5c6acf92c374)
- build(core): bump version and update dependencies (2d24dff1a852)
- Release @treeseed/core 0.10.1.

## [0.10.0] - 2026-05-21

### Fixed

- fix(build): rehearse repair releases against stable dependencies (3ce3365a589e)
- fix(build): keep release package lines aligned (b7bf7bde2734)

### Dependencies

- Release @treeseed/core 0.10.0.

## [0.9.4] - 2026-05-21

### Dependencies

- build(build): fail package release when npm publish fails (bfdc4f4dd0a4)
- Release @treeseed/core 0.9.4.

## [0.9.3] - 2026-05-20

### Dependencies

- ci(build): create github releases for package publishes (f8e122a997fd)
- Release @treeseed/core 0.9.3.

## [0.9.2] - 2026-05-20

### Dependencies

- build(build): tolerate npm scoped package permission 404 (fba971861edb)
- Release @treeseed/core 0.9.2.

## [0.9.1] - 2026-05-20

### Dependencies

- build(build): release internal packages from stable git tags (46e829aa6c2e)
- build(publish): make package publish tolerate unprovisioned npm scope (ffbb951a5e95)
- build(build): complete capacity provider migration (433e5a5702e0)
- Release @treeseed/core 0.9.1.

## [0.9.0] - 2026-05-19

### Added

- feat(core): add request_changes decision type and refactor app shell (c620eeb8742d)

### Changed

- refactor(ui): improve path matching in navigation components (d9d7cb45b633)

### Tests

- build(ui): sync package dependency references (7a31cc1041e9)
- refactor(dev): support multiple dev runtimes and environment forwarding (632ea6b27037)

### Dependencies

- build(build): sync package dependency references (a3e4cf1e3694)
- chore(core): bump version and update @treeseed/sdk (da7fee1fcfc4)
- Release @treeseed/core 0.9.0.

## [0.8.19] - 2026-05-16

### Dependencies

- Release @treeseed/core 0.8.19.

## [0.8.18] - 2026-05-16

### Dependencies

- Release @treeseed/core 0.8.18.

## [0.8.17] - 2026-05-16

### Dependencies

- Release @treeseed/core 0.8.17.

## [0.8.16] - 2026-05-15

### Dependencies

- build(build): sync package dependency references (729b1d6f9c14)
- Release @treeseed/core 0.8.16.

## [0.8.15] - 2026-05-15

### Tests

- build(build): sync package dependency references (eafd4a6b4798)

### Dependencies

- Release @treeseed/core 0.8.15.

## [0.8.14] - 2026-05-15

### Dependencies

- chore(core): bump version and update @treeseed/sdk (a66cc2913481)
- build(core): update version and @treeseed/sdk dependency (4f3678b94804)
- chore(core): bump version and update dependencies (584e6e3abdd0)
- Release @treeseed/core 0.8.14.

## [0.8.13] - 2026-05-14

### Added

- feat(core): improve dev orchestration and log filtering (384235955171)

### Dependencies

- Release @treeseed/core 0.8.13.

## [0.8.12] - 2026-05-14

### Dependencies

- build(build): sync package dependency references (dc58ad68f37b)
- Release @treeseed/core 0.8.12.

## [0.8.11] - 2026-05-13

### Added

- feat(dev): add 'all' surface to integrated dev environment (f668520aed58)

### Tests

- build(build): update package metadata (a0e66bc377a2)

### Dependencies

- build(core): bump version and update @treeseed/sdk dependency (e206fa299db4)
- Release @treeseed/core 0.8.11.

## [0.8.10] - 2026-05-13

### Added

- feat(ui): overhaul site shell and expand dev-platform surfaces (424dd99d03b6)

### Tests

- build(build): update package metadata (beb5fb31c4e5)

### Dependencies

- Release @treeseed/core 0.8.10.

## [0.8.9] - 2026-05-12

### Tests

- build(ui): sync package dependency references (0ce1419302d0)

### Dependencies

- build(source): sync package dependency references (184577f046a0)
- chore(core): bump version and update @treeseed/sdk dependency (c9f124320c64)
- chore(core): bump version and update @treeseed/sdk (dda2fed4a27d)
- build(core): bump version and update @treeseed/sdk dependency (b77efec628b6)
- Release @treeseed/core 0.8.9.

## [0.8.8] - 2026-05-11

### Dependencies

- build(build): sync package dependency references (c0259dcaf10e)
- build(core): bump version and update @treeseed/sdk dependency (b7fc8c9bd7a5)
- Release @treeseed/core 0.8.8.

## [0.8.7] - 2026-05-11

### Dependencies

- chore(core): update version and @treeseed/sdk dependency (511d8049a31a)
- chore(core): bump version and update @treeseed/sdk dependency (d2e6e624ab89)
- build(core): bump version and update @treeseed/sdk (cba7323590ca)
- Release @treeseed/core 0.8.7.

## [0.8.6] - 2026-05-11

### Tests

- chore(core): update version, dependencies, and .gitignore (955b168db6fd)

### Dependencies

- build(core): bump version and update @treeseed/sdk (81dfebec04f0)
- Release @treeseed/core 0.8.6.

## [0.8.5] - 2026-05-11

### Dependencies

- chore(core): bump version and update @treeseed/sdk (6ae7ce20b477)
- build(core): bump version and @treeseed/sdk dependency (33874f260b99)
- Release @treeseed/core 0.8.5.

## [0.8.4] - 2026-05-11

### Tests

- build(source): sync package dependency references (f6524269b2ff)

### Dependencies

- build(build): sync package dependency references (26a8e2861a89)
- chore(core): bump version and @treeseed/sdk dependency (ad73c0cd9006)
- build(core): bump version and update @treeseed/sdk dependency (a66c451eff47)
- build(core): bump version and update @treeseed/sdk (18b21dbc5336)
- chore(core): update version and @treeseed/sdk dependency (582fc639a850)
- build(core): bump version and update @treeseed/sdk (5c630f0b119f)
- build(build): sync package dependency references (3bac1cc7c9bc)
- chore(core): bump version and update @treeseed/sdk (2798a117da8c)
- chore(core): bump version and update @treeseed/sdk (86d0bc000d05)
- build(core): bump version and update @treeseed/sdk (a0630849ca93)
- chore(core): update version and @treeseed/sdk dependency (65d187164948)
- build(core): bump version and update @treeseed/sdk dependency (28563c62aedc)
- build(core): bump version and update @treeseed/sdk (730a7ef563b7)
- build(core): bump version and update @treeseed/sdk (b9fafea981a1)
- chore(core): bump version and update @treeseed/sdk (cf75981d8314)
- chore(core): bump version and update @treeseed/sdk (0b5975e8bfa4)
- build(core): bump version and update @treeseed/sdk dependency (f8252b397f3a)
- build(core): bump version and @treeseed/sdk dependency (bd23b984b52a)
- build(core): bump version and update @treeseed/sdk (6aa77f39e72d)
- chore(core): bump version and update @treeseed/sdk (a4e8b7d139d3)
- 34 additional changes omitted from this summary.

## [0.8.3] - 2026-05-10

### Dependencies

- build(build): sync package dependency references (03d75b5c2bb1)
- build(core): bump version and update @treeseed/sdk dependency (a5ed90e775f6)
- Release @treeseed/core 0.8.3.

## [0.8.2] - 2026-05-10

### Dependencies

- build(core): bump version to 0.8.2-dev.staging.20260510T000348Z (2125f375cbd2)
- Release @treeseed/core 0.8.2.

## [0.8.1] - 2026-05-09

### Dependencies

- Release @treeseed/core 0.8.1.

## [0.8.0] - 2026-05-09

### Dependencies

- build(core): bump version and update @treeseed/sdk (516b126d82c4)
- Release @treeseed/core 0.8.0.

## [0.7.0] - 2026-05-09

### Dependencies

- refactor(core): update launch types and enhance remote runner logic (797153ff64e4)
- Release @treeseed/core 0.7.0.

## [0.6.50] - 2026-05-09

### Dependencies

- chore(core): bump version and update @treeseed/sdk dependency (d44b29065d38)
- Release @treeseed/core 0.6.50.

## [0.6.49] - 2026-05-08

### Dependencies

- Release @treeseed/core 0.6.49.

## [0.6.48] - 2026-05-08

### Dependencies

- chore(core): bump version and update @treeseed/sdk (9737a5faad49)
- Release @treeseed/core 0.6.48.

## [0.6.47] - 2026-05-08

### Dependencies

- build(core): bump version and update @treeseed/sdk (510327d91cb1)
- Release @treeseed/core 0.6.47.

## [0.6.46] - 2026-05-08

### Dependencies

- build(core): bump version and update @treeseed/sdk dependency (22a6898869cc)
- Release @treeseed/core 0.6.46.

## [0.6.45] - 2026-05-08

### Dependencies

- chore(core): bump version and update @treeseed/sdk dependency (a8766e79cffb)
- Release @treeseed/core 0.6.45.

## [0.6.44] - 2026-05-08

### Dependencies

- build(core): bump version and update @treeseed/sdk dependency (0503c0dba9a8)
- Release @treeseed/core 0.6.44.

## [0.6.43] - 2026-05-08

### Dependencies

- build(core): bump version and update @treeseed/sdk dependency (fcbfb4f4dcb8)
- Release @treeseed/core 0.6.43.

## [0.6.42] - 2026-05-08

### Dependencies

- build(core): bump version and update @treeseed/sdk dependency (84744202176f)
- Release @treeseed/core 0.6.42.

## [0.6.41] - 2026-05-08

### Dependencies

- chore(core): bump version and update @treeseed/sdk (6fd74249eef0)
- Release @treeseed/core 0.6.41.

## [0.6.40] - 2026-05-08

### Dependencies

- build(core): bump version and update @treeseed/sdk (c83745ba6597)
- Release @treeseed/core 0.6.40.

## [0.6.39] - 2026-05-08

### Added

- feat(core): implement agent provider profile normalization and workday (e4c04aa8c48d)

### Tests

- build(tests): sync package dependency references (fde0555dd73e)
- build(source): sync package dependency references (12f45dcff61d)

### Dependencies

- build(core): update version and @treeseed/sdk dependency (31d82fb49aab)
- build(core): bump version and update @treeseed/sdk (8fab38c90178)
- build(core): update sdk dependency and enhance build distribution script (5179911357f6)
- build(core): update version and @treeseed/sdk dependency (c88abc7d0765)
- Release @treeseed/core 0.6.39.

## [0.6.38] - 2026-05-07

### Dependencies

- build(core): bump version and update @treeseed/sdk (a8d36a50bfe1)
- Release @treeseed/core 0.6.38.

## [0.6.37] - 2026-05-07

### Tests

- ci(build): sync package dependency references (e449eb297180)

### Dependencies

- Release @treeseed/core 0.6.37.
