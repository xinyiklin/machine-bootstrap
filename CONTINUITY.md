# Continuity Ledger — Machine Bootstrap

Scope: the portable parent guides, project templates, shared-skill manifest,
workflow foundation, and safe setup scripts in this repository. Each computer's
workspace state belongs in its parent `MACHINE.md` and local continuity ledger.

Bounded ledger: **no more than 160 lines total**, counting every section.
Working set stays near 12 paths. Active `Dnnn` entries remain compact indexes;
detailed rationale belongs in the owning contract or a focused decision record.
Rotated history lives in `docs/continuity/YYYY-MM.md` and is read only when a
task needs it.

## Snapshot

- 2026-08-14 [USER+CODE] Guidance de-duplicated by verified harness loading
  (D017). Claude inherits workspace `CLAUDE.md`; Codex starts project guidance
  at the child project root, so every Git repository remains self-contained.
  The workspace `CLAUDE.md` does not import its sibling `AGENTS.md`; that file
  is routing/fallback guidance for tasks launched at the non-Git root.
- 2026-08-14 [CODE] Test fixtures exclude ignored generated roots and
  machine-local/private files while preserving `.env.example` (D019).
- 2026-08-14 [CODE] Active Codex guide chains target below 28 KiB (D020).
- 2026-08-14 [USER+CODE] Continuity bounded plus archived (D018); this ledger
  rotated first — see `docs/continuity/2026-07.md`.
- 2026-08-14 [USER+CODE] Added a portable Git/GitHub delivery baseline from
  CareFlow and RoleFit conventions: typed branches, Conventional Commits and
  squash-compatible PR titles, a reviewable PR template, exact-head merge and
  post-merge gates, release/deploy receipts, and explicit publication state.
  New projects receive a self-contained copy under
  `docs/engineering/git-workflow.md` and `.github/pull_request_template.md`;
  project commands and CI remain project-owned.
- 2026-08-13 [USER] Implementation guidance now requires the smallest
  maintainable solution, discourages narrative comments and speculative
  abstractions, and requires user approval before implementing useful ideas
  outside the requested scope.
- 2026-08-13 [USER] Every implementation now defaults to the implementer's own
  verification plus one fresh independent review. Only the user may waive that
  review for a specific change; requested additional reviewers are honored
  after a firm risk-based recommendation.
- 2026-08-13 [CODE] Product Delivery workflow 1.1.0 makes implementer diff
  review and one independent review the default, and records the Delivery
  Lead's post-review recommendation on whether additional reviewers are needed.
- 2026-08-13 [USER] Product Delivery workflow 1.2.0 keeps five standard task
  artifacts and makes Decision Log and Change Request conditional. Active work
  stays local by default; tracked continuity references require the matching
  completed task folder to be tracked too.
- 2026-08-13 [USER] Dependency versions must be established from current
  official sources rather than model memory. Prefer the latest compatible
  stable release, preserve each project's package-manager/version-range policy,
  update tracked lockfiles, and explain deliberate older or prerelease choices.

Milestones — detail in `docs/continuity/2026-07.md`:

- 2026-07-27 Bootstrap foundation: safe single-entry initialization, missing-only
  placement, fail-closed drift with reviewed `--replace` backups, and a skill
  manifest pinning both acquisition revision and reviewed content hash.
- 2026-07-27 Installer hardening: deterministic UTF-8 hash ordering,
  symlink-aware root resolution, non-interactive Git acquisition, concise
  failure messages, and atomic destination claims before rollback state.
- 2026-07-31 Workflow foundation: explicit `workflows/registry.json`, provider
  adapters generated from Markdown role contracts, fail-closed installation
  owning only namespaced paths, and shared `fs-safety`/`portable-path` libraries.
- 2026-07-31 Test isolation: every initialization test points `HOME` and
  `USERPROFILE` at a disposable root, and environment-dependent checks skip by
  name instead of failing.

## Decisions

- 2026-07-27 [USER] D001 ACTIVE: portable guidance and skill setup live in this
  dedicated repository rather than a Git repository around all child projects.
- 2026-07-27 [CODE] D002 ACTIVE: `skills.json` is the desired roster; generated
  global lockfiles remain machine state and are not the portable source.
- 2026-07-27 [CODE] D003 ACTIVE: installation is missing-only. Updates and
  unexpected existing paths require review rather than silent replacement.
- 2026-07-27 [CODE] D004 ACTIVE: Impeccable installs without optional hooks;
  hooks remain an explicit per-project choice.
- 2026-07-27 [USER] D005 ACTIVE: the bootstrap repository owns AI setup and the
  portable root guidance/templates used to initialize the workspace and each
  project; projects retain their scoped product and engineering contracts.
- 2026-07-27 [CODE] D006 ACTIVE: an AI agent initiates a machine through
  `INIT.md` and `scripts/init-workspace.mjs`; silent partial synchronization is
  not considered successful setup.
- 2026-07-27 [CODE] D007 ACTIVE: the portable skill manifest pins both
  acquisition and reviewed content identity; updates require an intentional
  manifest revision rather than passing through presence-only checks.
- 2026-07-31 [USER] D008 ACTIVE: this repository owns the portable workflow
  foundation — role contracts, stages, approval and invalidation rules,
  handoffs, artifact templates, and installation. `skills.json` stays
  exclusively about reusable skills and is unchanged.
- 2026-07-31 [USER] D009 ACTIVE: project architecture, engineering rules,
  commands, and required verification remain project-owned. The workflow never
  rewrites project guidance; a project references the installed contract rather
  than copying it.
- 2026-07-31 [CODE] D010 ACTIVE: provider-neutral role contracts are the source
  of generated Claude/Codex instructions. Adapters contain the role contract,
  not `WORKFLOW.md`; that document is on-demand shared reference, so essential
  authority and safety overlap in each self-contained role is deliberate.
- 2026-07-31 [USER] D011 ACTIVE: a project may strengthen the workflow with
  extra high-risk triggers, mandatory plan sections, required verification, or
  specialist reviews. It may not weaken exact user approval, scope-change
  escalation, or honest verification reporting.
- 2026-07-31 [CODE] D012 ACTIVE: workflow installation follows the same
  fail-closed contract as guides and skills — validate before writing,
  missing-only by default, reject differing destinations before any partial
  write, and keep timestamped backups on reviewed `--replace`.
- 2026-07-31 [CODE] D013 ACTIVE: approval recording is bookkeeping, not
  authentication. No file or command in this repository claims to prove that a
  human supplied an approval.
- 2026-08-13 [USER] D014 ACTIVE: one independent review is mandatory by default
  after implementer verification. The user may explicitly waive it per change
  or request more reviewers; additional-review recommendations are firm and
  based on risk and coverage.
- 2026-08-13 [USER] D015 ACTIVE: do not create empty task artifacts. Track the
  five standard reports for completed referenced work; create Decision Logs and
  Change Requests only when needed. A tracked `[TASK <task-id>]` continuity
  reference must not point to an untracked local task folder.
- 2026-08-13 [USER] D016 ACTIVE: dependency additions and upgrades require a
  current official-source check for the stable or maintainer-recommended
  release. Use the latest compatible stable version by default, preserve the
  project's package-manager and version-range policy, update any tracked
  lockfile, and explain any intentional older or prerelease choice.
- 2026-08-14 [USER+CODE] D017 ACTIVE: guidance is de-duplicated by verified
  loading behavior, not shared wording. Claude inherits ancestor `CLAUDE.md`
  files; Codex builds project guidance from the project root down. The workspace
  files own routing/fallback behavior, every Git repository remains
  self-contained, and safety-critical or test-enforced overlap is deliberate.
- 2026-08-14 [USER] D018 ACTIVE: every continuity ledger is bounded and paired
  with an append-only `docs/continuity/YYYY-MM.md` archive. Rotation leaves a
  milestone bullet linking to the archive; the archive is never read at task
  start.
- 2026-08-14 [CODE] D019 ACTIVE: disposable test workspaces copy portable source
  but exclude generated, backup, and machine-local/private state.
- 2026-08-14 [CODE] D020 ACTIVE: keep cumulative `AGENTS.md` chains below 28 KiB;
  move detailed inventories and matrices to owning docs read on demand.

## Working Set

- `README.md`
- `INIT.md`
- `guides/{AGENTS,CLAUDE,MACHINE.example}.md`
- `project-templates/`
- `docs/continuity/`
- `skills.json`
- `workflows/registry.json`
- `workflows/product-delivery/{manifest.json,WORKFLOW.md,roles/,templates/}`
- `scripts/{init-workspace,install-skills,install-workflows,setup-guides,test-bootstrap}.mjs`
- `scripts/lib/{fs-safety,portable-path,skill-integrity,skill-manifest,skill-source}.mjs`
- `scripts/lib/{workflow-adapters,workflow-manifest}.mjs`

## Next

- Do not expand the workflow beyond a user's requested scope. Present useful
  follow-up recommendations and wait for approval before implementing them.
- Add a private remote only with explicit user authorization.

## Open Questions

- 2026-07-27 [USER] UNCONFIRMED which private remote will host this repository.
