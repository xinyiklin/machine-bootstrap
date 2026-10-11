# Initialize This Workspace

Agent-facing entry point for a fresh checkout. Prerequisites: Git and Node.js 24
or newer.

## Instruction for an AI agent

The user may request setup in ordinary language without naming any script. Treat
“Set up this workspace using machine-bootstrap; follow `INIT.md`” as the
agent-assisted entry point. Explain the intended scope, use the audited scripts
below for execution and verification, stop for review-required conditions, and
report the resulting state. Do not require the user to translate the request
into CLI commands.

Read this file, `README.md`, and `CONTINUITY.md`. Confirm this repository is a
direct child of the intended dedicated, non-Git workspace folder, then run the
following from that main checkout (a linked worktree can only run `--check`):

```bash
node scripts/init-workspace.mjs
```

The workspace initializer may create the optional parent `MACHINE.md` and
install shared skills, workflows, and provider adapters. It never creates a
parent `AGENTS.md`, `CLAUDE.md`, or `_templates/`. Replace `MACHINE.md` TODOs
only with verified local facts and never add credentials, private documents,
or secret filenames.
Then run:

```bash
node scripts/init-workspace.mjs --check
```

Check mode is read-only. It allows the optional registry to be absent but
fails on unresolved placeholders when the file exists, on shared-capability
drift, and on retired parent guidance or template entries.

If the parent contains a legacy `AGENTS.md`, `CLAUDE.md`, or `_templates/`,
stop and report it. The same stop applies to `AGENTS.override.md`,
`CLAUDE.local.md`, `.claude/AGENTS.md`, `.claude/CLAUDE.md`, or
`.claude/rules/` at the workspace root, and to `AGENTS.md`, `CLAUDE.md`,
`CLAUDE.local.md`, `.claude/AGENTS.md`, or `.claude/CLAUDE.md` in any folder
above it, because Claude loads those into every sibling session. A user
home's (or `CLAUDE_CONFIG_DIR`'s) `.claude/CLAUDE.md` is user memory and is
not flagged; a path that cannot be inspected also stops setup. Automatic
migration is not currently supported. Review the entries and move them
manually before rerunning; never move sibling projects or `MACHINE.md` as part
of that cleanup.

Initialize one project explicitly:

```bash
node scripts/init-project.mjs ../project-a
```

Add `--create` only when the target directory does not yet exist. The command
seeds only missing starter files from `project-templates/` and preserves
existing ones. It appends the ordered `.env`, `.env.*`, `!.env.example` ignore
policy when absent, and stops for manual review before any write when existing
environment rules are ineffective, incomplete, or ambiguous. It does not
initialize Git, copy `TEMPLATE-USAGE.md`, replace a README, or edit any
sibling project.

The user may instead say “Initialize `<target-project>` using
machine-bootstrap.” Resolve and repeat the exact target before execution, then
use the same initializer and safety rules above; do not copy template files by
hand.

Report the initialized paths, shared capability state, remaining placeholders,
and review-required conditions. `node scripts/audit-workspace.mjs` reports each
sibling's guide budgets read-only; route its findings to sessions in those
projects. Offer the recommended Claude permission rules from `README.md`; apply
them only with the user's approval and without replacing existing settings.
Do not initialize Git at the workspace root or stage, commit, publish,
overwrite, or migrate anything without the user's authority for that action.

After project initialization, start a new Codex or Claude session in that
project root or relevant scoped directory. A bootstrap session may administer
or route a sibling, but it must not become the long-lived coding session for
that project. Parent or sibling access may require sandbox authorization;
access does not load sibling instructions.

Use `--skip-skills` or `--skip-workflows` only when the user explicitly wants
that shared layer left untouched. Installing `product-delivery` makes its roles
available but does not activate the workflow for ordinary work. An existing
installation from an older workflow version differs from the new sources, so
setup stops for review before writing; replace it only with the user's approval
through the reviewed `--replace` path in `docs/product-delivery.md`, which
keeps backups.

Codex desktop is the primary interactive entry; use the task prompts in
`docs/product-delivery.md`, which lists the workflow adapter paths under
`CLAUDE_CONFIG_DIR` and `CODEX_HOME`; README "Updating" gives the skill-link
paths. Runtime loading checks are in
`docs/guidance-loading-smoke.md`; report unrun scenarios explicitly.

This file is the first-run entry point. Once setup has run, the installed
`workspace-setup`, `project-init`, `project-sync`, and `guidance-audit` skills
handle later updates, new projects, starter updates, and guidance audits.
