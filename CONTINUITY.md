# Continuity Ledger — Machine Bootstrap

Scope: machine-level setup, one-time project templates, shared-skill manifest,
workflow foundation, and safe administration scripts in this repository.
Machine-local state belongs in optional parent `MACHINE.md`; project state
belongs in each sibling project.

Bounded ledger: **no more than 160 lines total**. Working set stays near 12
paths. Active `Dnnn` entries are compact indexes; detailed rationale belongs in
the owning contract. Rotated history lives in `docs/continuity/YYYY-MM.md` and
is read only when a task needs it.

## Snapshot

- 2026-08-14 [USER+CODE] Sibling-only ownership replaces the workspace router
  (D005, D017, D021): the parent has optional inert `MACHINE.md` but no live
  `AGENTS.md`, `CLAUDE.md`, or `_templates/`. Machine-bootstrap and every project
  are independent repositories with self-contained guidance.
- 2026-08-14 [USER+CODE] Project templates have one canonical source and are
  seeded missing-only into one explicit target. Existing project policy remains
  project-owned; Git verifies the effective `.gitignore` environment policy and
  ambiguous or overridden policy stops before writes. Rollback removes only
  verified run-owned files. Managed reads, writes, and recovery use verified
  real-directory identities pinned for the full run plus no-follow leaf access,
  reject concurrent parent, entry, or backup replacement, leave
  identity-changed entries at their original paths, never delete directories by
  pathname, and report exact recovery paths.
- 2026-08-14 [USER] Legacy parent guidance stops initialization for manual
  review and cleanup. Automatic migration and its versioned manifest are
  intentionally deferred (D022).
- 2026-08-14 [USER] Workspace and project initialization support a first-class
  agent-assisted entry point; users may describe the target and outcome without
  naming scripts, while agents still use the audited initializers (D023).
- 2026-08-14 [CODE] Test fixtures exclude ignored generated roots and
  machine-local/private files while preserving `.env.example` (D019).
- 2026-08-14 [CODE] Active Codex guide chains target below 28 KiB (D020); line
  counts are readability/rotation warnings rather than universal CI gates.
- 2026-08-14 [USER+CODE] Continuity bounded and archived (D018); prior detail is
  in append-only `docs/continuity/2026-07.md`.
- 2026-08-14 [USER+CODE] Machine-bootstrap and project starters each own a
  Git/GitHub contract: typed branches, Conventional Commits, exact-head review,
  verification receipts, and explicit publication state.
- 2026-08-14 [USER+CODE] Product Delivery workflow 1.3.0 activates its complete
  flow only for a primary role, explicit request, active artifacts, or named
  project work. Standalone Verifier selection activates only independent review.
- 2026-08-13 [USER] Every implementation defaults to implementer verification
  plus one fresh independent review; only the user may waive it per change.
- 2026-08-13 [USER] Dependency versions come from current official sources.
  Prefer the latest compatible stable release, preserve package-manager/range
  policy, update tracked lockfiles, and explain older or prerelease choices.

Milestones — detail in `docs/continuity/2026-07.md`:

- 2026-07-27 Bootstrap foundation: safe initialization, missing-only placement,
  fail-closed drift, and reviewed skill acquisition/content identity.
- 2026-07-31 Workflow foundation: provider-neutral role contracts,
  deterministic adapters, namespaced installation, and transactional rollback.
- 2026-07-31 Test isolation: disposable workspace/home roots and named skips for
  unavailable host capabilities.

## Decisions

- 2026-07-27 [USER] D001 ACTIVE: portable machine and project setup lives in
  this dedicated repository, never in a Git repository around all projects.
- 2026-07-27 [CODE] D002 ACTIVE: `skills.json` is the reviewed desired roster;
  generated global lockfiles remain machine state.
- 2026-07-27 [CODE] D003 ACTIVE: bootstrap-owned global installation is
  missing-only; differing destinations require review. Project seeding is also
  missing-only but intentionally preserves customized project-owned files.
- 2026-07-27 [CODE] D004 ACTIVE: Impeccable installs without optional hooks;
  hooks remain an explicit per-project choice.
- 2026-08-14 [USER] D005 ACTIVE: machine-bootstrap owns machine setup and the
  only project starter source. The workspace parent owns only optional inert
  `MACHINE.md`; each project owns its live product and engineering contracts.
- 2026-07-27 [CODE] D006 ACTIVE: an agent initiates a machine through `INIT.md`
  and `scripts/init-workspace.mjs`; partial synchronization is not success.
- 2026-07-27 [CODE] D007 ACTIVE: the skill manifest pins acquisition revision
  and reviewed content identity; updates require an intentional manifest change.
- 2026-07-31 [USER] D008 ACTIVE: this repository owns the optional portable
  Product Delivery workflow; `skills.json` remains reusable skills only.
- 2026-07-31 [USER] D009 ACTIVE: project architecture, engineering rules,
  commands, and required verification remain project-owned.
- 2026-07-31 [CODE] D010 ACTIVE: provider-neutral role contracts generate Claude
  and Codex adapters; adapters carry provenance and pin no model.
- 2026-07-31 [USER] D011 ACTIVE: projects may strengthen workflow triggers,
  checks, or review but not weaken approval, escalation, or honest verification.
- 2026-07-31 [CODE] D012 ACTIVE: workflow installation validates before writes,
  rejects drift, and preserves timestamped backups on reviewed replacement.
- 2026-07-31 [CODE] D013 ACTIVE: approval records are bookkeeping, not proof of
  human authentication.
- 2026-08-13 [USER] D014 ACTIVE: one independent review follows implementer
  verification unless explicitly waived by the user for that change.
- 2026-08-13 [USER] D015 ACTIVE: create no empty task artifacts; tracked task
  references require their completed artifact folders to be tracked.
- 2026-08-13 [USER] D016 ACTIVE: dependency changes require current official
  version evidence, compatibility, preserved range policy, and lockfile updates.
- 2026-08-14 [USER+CODE] D017 ACTIVE: provider loading follows official
  contracts and repository isolation. Codex discovers from project root to
  launch directory; project sessions never depend on a workspace parent guide.
- 2026-08-14 [USER] D018 ACTIVE: current continuity is bounded and paired with
  append-only monthly history read only on demand.
- 2026-08-14 [CODE] D019 ACTIVE: disposable fixtures exclude generated, backup,
  root-local private state while preserving portable nested configuration.
- 2026-08-14 [CODE] D020 ACTIVE: keep cumulative active `AGENTS.md` chains below
  28 KiB; use soft line targets and move detail to on-demand owners.
- 2026-08-14 [USER] D021 ACTIVE: a bootstrap session may administer or route a
  sibling but is never its long-lived coding session. Access authorization does
  not inject sibling instructions; start a new session in the target project.
- 2026-08-14 [USER] D022 ACTIVE: do not support automatic legacy workspace
  migration yet. Detect parent guidance/templates and fail closed with manual
  cleanup instructions.
- 2026-08-14 [USER] D023 ACTIVE: document agent-assisted setup as a normal
  interface. Natural-language requests select the target and outcome; audited
  scripts remain the execution and verification layer.

## Working Set

- `AGENTS.md`, `CLAUDE.md`, `README.md`, `INIT.md`, `CONTINUITY.md`
- `.github/{pull_request_template.md,workflows/bootstrap.yml}`
- `machine-templates/`
- `project-templates/`
- `docs/{engineering/git-workflow.md,guidance-loading-smoke.md,continuity/}`
- `scripts/{init-workspace,init-project,test-bootstrap}.mjs`
- `scripts/{install-skills,install-workflows}.mjs`
- `scripts/lib/{fs-safety,portable-path,skill-*,workflow-*}.mjs`
- `skills.json`, `workflows/`

## Next

- Keep scratch optional and disposable; promote durable work into its own
  sibling repository with project guidance.
- Add a private remote only with explicit user authorization.

## Open Questions

- 2026-07-27 [USER] UNCONFIRMED which private remote will host this repository.
