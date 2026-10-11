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
- 2026-10-10 `archify` pinned at upstream 10722002 (2.17.0-dev.1). It has no
  install scripts; at runtime it makes a throttled update-check GET to its
  GitHub Pages manifest (opt out: `ARCHIFY_UPDATE_CHECK_DISABLED=1`) and
  fetches brand URLs the user supplies, refusing private addresses.
- Bootstrap CI runs the full disposable suite on Linux, Windows, and macOS;
  a separate PR size check enforces the 1,000-line gate (D035).
- 2026-10-10 Skill pins refreshed: `systematic-debugging` moved to superpowers
  bb92a777 (two shell-portability lines); `verification-before-completion` and
  both Vercel skills re-pinned to current upstream heads with identical
  content. README setup steps moved into `INIT.md`, which now owns the
  ancestor-instruction stop list; CI parses the generated Codex TOML with a
  real tomllib on Linux and macOS.
- 2026-10-10 Impeccable pinned at 4.1.3 (c0f49521), the last Node-only
  release, by the user's choice. Releases from 4.2.0 replace the Node scripts
  with a launcher that downloads a platform binary from GitHub releases on
  first run, verified only against a `.sha256` sidecar from the same URL;
  moving past 4.1.3 needs that reviewed explicitly. 4.1.3 keeps 4.0.2's
  outbound hosts (impeccable.style update check and concept seeds, OpenAI image
  generation only when invoked) and its local `claude`/`codex` auth probe.
  Its version moved under frontmatter `metadata:`, which the installer's
  top-level `version:` check cannot read, so the entry relies on the content
  hash alone and carries no `expectedVersion`.

## Next

- Keep scratch optional and disposable; promote durable work into its own
  sibling repository with project guidance.
- Sibling guidance findings from `scripts/audit-workspace.mjs` belong to
  sessions in those projects, not here.

## Open questions

- None.
