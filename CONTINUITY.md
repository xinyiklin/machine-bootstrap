# Continuity Ledger — Machine Bootstrap

Current handoff state for this repository only. Machine-local facts belong in
the optional parent `MACHINE.md`; sibling project state belongs in each
project.

- Cap: 160 lines, enforced by the regression suite. Keep only current state
  and compact well before the cap.
- Active decisions and their provenance live in `docs/decisions.md`; read it
  before changing a rule.
- Resolved entries rotate verbatim to `docs/continuity/YYYY-MM.md`, named for
  the month of rotation (`2026-07.md` holds the first rotation, made
  2026-08-14). Dated task receipts sit beside them. Read history only when a
  task needs it.
- Update and compact with the shared `continuity` skill: agents run it near
  the cap, and the user can run it at any time.

## Current state

- 2026-10-09 Product Delivery 3.0.0 (D029, D030): 1.x support removed; task
  artifacts are local and deleted on completion. A machine with 2.x installed
  upgrades through the reviewed `install-workflows.mjs --replace`, then removes
  the two retired templates by hand.
- 2026-10-09 Ledger restructured (D031): decisions moved to
  `docs/decisions.md`; snapshot and working set rotated to
  `docs/continuity/2026-10.md`; receipts moved under `docs/continuity/`.
- 2026-10-09 Review tiering (D028): typo, link, formatting, and comment-only
  changes need implementer verification only.
- 2026-10-09 First-party `continuity` skill (D032) pinned in `skills.json`;
  an existing machine adds it with `install-skills.mjs`, and roster-dependent
  tests skip until it does.
- 2026-10-09 Project starters offer an optional `docs/decisions.md`, created
  on demand rather than seeded (D033).
- 2026-10-10 Agent-facing skills `workspace-setup`, `project-init`,
  `project-sync`, and `guidance-audit` drive the scripts; `starter-diff.mjs`
  compares a project's starters read-only (D034).
- 2026-10-10 Live smoke, implementer run (D036): Claude Code 2.1.285 and Codex
  0.159.2 passed all seven scenarios, including Claude's native `AGENTS.md`,
  `CLAUDE.local.md` turning it off, and discovery of the installed skills and
  `mb-*` roles.
- 2026-10-10 Product Delivery 3.1.0: the Delivery Lead briefs the Verifier
  once with a complete checklist; this repository's full-workflow triggers
  narrow (D037); README's workflow detail moved to `docs/product-delivery.md`.
- 2026-10-10 Product Delivery 3.2.0 (D038): the plan owner tells the user which
  assumptions the plan added, at the start and in the PR body or final report.
- Skill pin notes (archify's runtime network use; Impeccable held at 4.1.3
  because 4.2.0 and later download a platform binary, which needs explicit
  review) rotated to `docs/continuity/2026-10.md` on 2026-10-11.
- Bootstrap CI runs the full disposable suite on Linux, Windows, and macOS;
  a separate PR size check enforces the 1,000-line gate (D035).
- 2026-10-11 Guidance review fixes (D039–D042): worktree-aware read-only
  scripts, slimmed starter `AGENTS.md` (4.1 KiB), one provider-facts owner with
  a `--check` advisory, prose-free guidance tests, and a seeded project
  `.claude/settings.json`. Installed first-party skills differ from their new
  pins until reinstalled through `workspace-setup`. Deferred: an emphasis and
  duplication pass over `WORKFLOW.md` and the role contracts, which needs a
  workflow version bump and reinstall.

## Next

- Keep scratch optional and disposable; promote durable work into its own
  sibling repository with project guidance.
- Sibling guidance findings from `scripts/audit-workspace.mjs` belong to
  sessions in those projects, not here.

## Open questions

- None.
