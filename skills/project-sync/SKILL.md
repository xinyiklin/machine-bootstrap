---
name: project-sync
description: Bring an existing project's agent guidance up to date with machine-bootstrap's current starters without overwriting project-specific content. Use when the user asks to sync, update, or refresh a project's AGENTS.md, CLAUDE.md, Git contract, PR template, Claude permission settings, or ignore rules from machine-bootstrap's starters.
---

# Project sync

Seeded starter files belong to the project. This skill adopts upstream starter
improvements change by change; it never replaces a customized file.

## Compare

Work in a session started in the project. The machine-bootstrap checkout
(`<checkout>` below) is `../machine-bootstrap` from the project root; from a
Git worktree it sits beside the main checkout, at
`"$(git rev-parse --path-format=absolute --git-common-dir)/../../machine-bootstrap"`.
Otherwise ask the user. Run the read-only report:

```bash
node <checkout>/scripts/starter-diff.mjs <project-root>
```

Add `--since <revision>` when the project's continuity records the
machine-bootstrap commit it was seeded or last synced from. Without it the
script estimates the base from the project's first `AGENTS.md` commit, or
falls back to a two-way comparison that mixes project facts with upstream
changes.

## Adopt

For each starter file the report lists:

- **Missing, or missing `.gitignore` rules:** run `init-project.mjs` on the
  project. It adds only missing files and appends the ordered environment
  policy, or stops for manual review; never reorder `.env`, `.env.*`, and
  `!.env.example` by hand. After a stop, the user fixes the rules, or you do
  with their approval while keeping that order; then `git check-ignore -v .env`
  must report a rule and `git check-ignore -v .env.example` must report none.
- **Unchanged since its base:** edit the file to match the current starter,
  then fill any new placeholders from the repository.
- **Customized:** apply each upstream change at the matching place, keeping
  the project's facts, commands, names, and stricter rules. Skip a change that
  conflicts with a deliberate project choice, and list it.

Never weaken a project rule to match the starter. Present the adopted and
skipped changes; wording-only adoption can proceed, while anything that
changes the project's process waits for the user's decision.

## Finish

Run the project's own checks and
`node <checkout>/scripts/audit-workspace.mjs`. Record "starters
synced to machine-bootstrap <commit>" in the project's continuity if it keeps
one. Review and publication follow the project's `AGENTS.md` and Git contract.
