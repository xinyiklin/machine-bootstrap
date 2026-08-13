# Project Guide Templates

Generic starter guides to copy into a **new** project.

- `AGENTS.md` — provider-agnostic project guide (the source of truth).
- `CLAUDE.md` — thin Claude-specific overrides that `@AGENTS.md`-import the
  source of truth, so it hard-loads into context every session.
- `.gitignore` — baseline exclusions for personal AI-agent state, local
  environment configuration, and operating-system metadata.

The starter `.gitignore` excludes only genuinely local agent state:
`CLAUDE.local.md`, `.claude/settings.local.json`, and active task artifacts under
`.agent-work/`. It deliberately keeps shared agent configuration trackable. A
project that chooses to track agent guidance/configuration and `CONTINUITY.md`
removes the `.agent-work/` ignore rule and also tracks completed task folders
referenced by that ledger. Nothing creates or commits those files for you.

## Usage

1. Copy the three starter files into the new project root.
2. Replace the `TODO` placeholders (project shape, commands), the `<Project>`
   title, and the `>` template note at the top of each file with the project's
   real details.
3. Keep the `@AGENTS.md` import line in `CLAUDE.md` — that is what loads the
   canonical guide every session (no "read it first" step needed).
4. Trim anything that does not apply; add project-specific conventions.
5. If the workspace uses reserved ports, claim a range in its machine-local
   registry before pinning ports in the project's config.

These are **inert templates** — nothing loads them, so editing them never
changes agent behavior until you copy them into a project.

Two mechanics worth knowing, because they decide whether a guide is live at
all:

- Claude Code loads `CLAUDE.md` and `CLAUDE.local.md` by walking **up** the
  tree from the working directory. It does **not** read `AGENTS.md` on its own
  — which is what step 3 is for. An `AGENTS.md` with no `CLAUDE.md` importing
  it is documentation, not instruction.
- Guides *below* the working directory (nested `AGENTS.md`) load on demand when
  Claude reads files in those directories, not at launch — so a scoped guide
  still needs an explicit read before scoped work.

Keep each guide under ~200 lines. Everything imported at launch competes for
the same context and long files get followed less reliably; push detail into
nested guides, engineering docs, or path-scoped `.claude/rules/*.md`.

For personal, uncommitted preferences in a project, use the gitignored
`CLAUDE.local.md` — it loads after `CLAUDE.md` in the same directory, so it has
the last word.
