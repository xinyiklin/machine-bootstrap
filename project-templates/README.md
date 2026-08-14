# Project Guide Templates

Generic starter guides to copy into a **new** project.

- `AGENTS.md` — provider-agnostic project guide (the source of truth).
- `CLAUDE.md` — thin Claude-specific overrides that `@AGENTS.md`-import the
  source of truth, so it hard-loads into context every session.
- `docs/engineering/git-workflow.md` — self-contained Git/GitHub branch, commit,
  PR, review, merge, and publication baseline.
- `.github/pull_request_template.md` — concise PR receipt for scope, checks,
  risks, and publication state.
- `.gitignore` — baseline exclusions for personal AI-agent state, local
  environment configuration, and operating-system metadata.

The starter `.gitignore` excludes only genuinely local agent state:
`CLAUDE.local.md`, `.claude/settings.local.json`, and active task artifacts under
`.agent-work/`. It deliberately keeps shared agent configuration trackable. A
project that chooses to track agent guidance/configuration and `CONTINUITY.md`
removes the `.agent-work/` ignore rule and also tracks completed task folders
referenced by that ledger. Nothing creates or commits those files for you.

## Usage

1. Copy the starter files and directories into the new project root.
2. Replace the `TODO` placeholders (project shape, commands), the `<Project>`
   title, and the `>` template note at the top of each file with the project's
   real details.
3. Keep the `@AGENTS.md` import line in `CLAUDE.md` — that is what loads the
   canonical guide every session (no "read it first" step needed).
4. Trim anything that does not apply; add project-specific conventions.
5. If the workspace uses reserved ports, claim a range in its machine-local
   registry before pinning ports in the project's config.

The Git workflow guide and PR template are intentionally project-owned copies:
keep the portable baseline, then add only the commands and CI/release details
that are true for this project.

These are **inert templates** — nothing loads them, so editing them never
changes agent behavior until you copy them into a project.

Three mechanics worth knowing, because they decide whether a guide is live at
all:

- Claude Code loads `CLAUDE.md` and `CLAUDE.local.md` by walking **up** the
  tree from the working directory. It does **not** read `AGENTS.md` on its own
  — which is what step 3 is for. An `AGENTS.md` with no `CLAUDE.md` importing
  it is documentation, not instruction. Codex, by contrast, loads global
  guidance from its Codex home and project guidance from the project root
  (normally the Git root) down to the working directory. A workspace guide
  above a child Git root is not inherited.
- Only `CLAUDE.md` and `CLAUDE.local.md` load on demand from directories
  *below* the working directory. A nested `AGENTS.md` is never auto-loaded by
  Claude Code in either direction — it needs an explicit read, or a path-scoped
  `.claude/rules/*.md` entry that loads when a matching file is touched.
- Avoid redundant imports of the same file from multiple `CLAUDE.md` layers.
  Claude's public documentation does not specify whether identical imports are
  de-duplicated; inspect `/memory` or an `InstructionsLoaded` hook when exact
  loaded context matters.

Keep each guide under ~200 lines and measure bytes too. Codex defaults to a
32 KiB combined limit across the active root-to-working-directory `AGENTS.md`
chain; target less than 28 KiB cumulatively so the nearest scoped guide is not
truncated. Everything imported at launch competes for context, so push detailed
inventories, examples, and verification matrices into engineering docs or
path-scoped `.claude/rules/*.md` that load only when needed.

`CONTINUITY.md` is not imported, but it is read at the start of every task, so
it is bounded the same way. Keep current state there and rotate resolved
entries into `docs/continuity/YYYY-MM.md`, leaving a milestone bullet that links
to a commit, PR, or the archive file. The archive is read only when a task needs
history. No template ships an empty `docs/continuity/` — create it on the first
rotation.

For personal, uncommitted preferences in a project, use the gitignored
`CLAUDE.local.md` — it loads after `CLAUDE.md` in the same directory, so it has
the last word.
