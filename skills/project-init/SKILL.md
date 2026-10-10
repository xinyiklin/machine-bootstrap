---
name: project-init
description: Seed a project in this workspace with machine-bootstrap's starter guidance (AGENTS.md, CLAUDE.md, Git contract, PR template, .gitignore rules), then replace its placeholders with facts verified from the real project. Use when the user asks to initialize, bootstrap, or add agent guidance to a new or existing project.
---

# Project init

`scripts/init-project.mjs` in the machine-bootstrap checkout does the seeding;
the agent's job is choosing the target and filling the placeholders truthfully.
The checkout is `../machine-bootstrap` from any project root; otherwise ask.

## Seed

1. Resolve exactly one target directory directly inside the workspace folder:
   never machine-bootstrap itself or a subdirectory of another repository.
   Repeat the resolved path to the user before running anything.
2. From the checkout, run `node scripts/init-project.mjs <target>`, adding
   `--create` only when the directory does not exist yet. It writes only
   missing starter files and stops on ambiguous `.gitignore` rules; report a
   stop instead of copying templates by hand.

## Fill the placeholders

Do this in a session working in the project. A machine-bootstrap session never
becomes a project's coding session; if this session started elsewhere, tell
the user to start one in the project and continue there.

- Replace each `TODO` with a fact verified from the repository: the package
  manifest and lockfile for stack and commands, CI configuration for checks,
  real entry points, and deployment configuration. Run cheap commands you list.
- Write `none` where something does not apply. Ask about what the repository
  cannot tell you; never guess.
- Hard invariants hold only rules whose violation is a bug or safety incident.
- Delete irrelevant sections and the template notes. Keep the single
  `@AGENTS.md` import directly below the `CLAUDE.md` title.

## Check

- No `TODO` remains in `AGENTS.md` or `CLAUDE.md`.
- `node <checkout>/scripts/audit-workspace.mjs` shows the project within its
  guide budgets.
- If the project keeps `CONTINUITY.md`, record the machine-bootstrap commit it
  was seeded from; the `project-sync` skill uses it later.

Leave staging and publication to the project's own Git contract.
