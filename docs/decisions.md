# Decisions — Machine Bootstrap

Active and superseded decisions for this repository, read on demand before
changing a rule or when a task needs its rationale. The live handoff state is
`CONTINUITY.md`; detailed rationale lives in the owning contract or a dated
receipt under `docs/continuity/`.

Tags: `[USER]` the user decided; `[USER-DELEGATED]` the agent decided under the
user's explicit delegation; `[CODE]` established by implementation;
`[USER+CODE]` a user decision realized in code. Statuses
change in place; superseded wording stays readable. New entries take the next
number.

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
- 2026-07-31 [USER] D011 ACTIVE: projects may strengthen triggers, checks, or
  review but not weaken authorization, escalation, review, or honest evidence.
- 2026-07-31 [CODE] D012 ACTIVE: workflow installation validates before writes,
  rejects drift, and preserves timestamped backups on reviewed replacement.
- 2026-07-31 [CODE] D013 ACTIVE: approval records are bookkeeping, not proof of
  human authentication.
- 2026-08-13 [USER] D014 AMENDED by D028: one independent review follows implementer
  verification unless explicitly waived by the user for that change.
- 2026-08-13 [USER] D015 PARTLY SUPERSEDED by D029: create no empty task artifacts; tracked task
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
- 2026-08-19 [USER+CODE] D024 ACTIVE: workflow triggers are checkable conditions, not
  self-assessed judgment; the satisfying reviewer is named; skips are recorded;
  and machine-bootstrap is in scope for its own workflow. Provider adapters own
  harness mechanics; README and shared reviewer guidance name provider roles.
- 2026-09-07 [USER+CODE] D025 AMENDED by D028: Codex desktop is the primary documented
  entry; Claude retains native loading. Workflow triggers name changed contracts;
  maintenance keeps fresh review and existing user authorization carries forward.
- 2026-10-06 [USER+CODE] D026 PARTLY SUPERSEDED by D030: authorized scope is separate from the
  plan's execution record; routine updates never re-trigger approval; material
  changes need a user decision. Legacy brief/plan templates are redirects.
- 2026-10-09 [USER+CODE] D027 ACTIVE: starters keep a thin `CLAUDE.md` with one
  `@AGENTS.md` import although Claude reads `AGENTS.md` natively; a
  `CLAUDE.local.md` or ancestor `CLAUDE.md` would switch native reading off.
- 2026-10-09 [USER-DELEGATED] D028 ACTIVE: outside the full workflow, a change
  confined to typos, broken links, formatting, or comments, with no change in
  meaning, behavior, or configuration, needs implementer verification only.
  All other work keeps one fresh independent review, and full-workflow tasks
  always get it. Only the user may waive a required review.
- 2026-10-09 [USER] D029 ACTIVE: task artifacts are local working records,
  never committed. The PR body, or the final report for unpublished work,
  carries the durable outcome; the task folder is deleted on completion; tracked
  documents cite the PR or commit. "Create no empty task artifacts" stands.
- 2026-10-09 [USER] D030 ACTIVE: Product Delivery 3.0.0 drops 1.x support:
  redirect templates, legacy activation, and consolidation rules. The installer
  still never deletes undeclared files, so installed redirects are removed by
  hand.
- 2026-10-09 [USER-DELEGATED] D031 ACTIVE: `CONTINUITY.md` holds current state
  only; active decisions live in `docs/decisions.md`; resolved entries rotate
  verbatim to archives named for the rotation month, beside dated task
  receipts. The CI line cap remains the backstop (extends D018).
