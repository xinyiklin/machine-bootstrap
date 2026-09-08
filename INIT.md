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
direct child of the intended dedicated, non-Git workspace folder, then run:

```bash
node scripts/init-workspace.mjs
```

The workspace initializer may create the optional parent `MACHINE.md` and
install shared skills, workflows, and provider adapters. It never creates a
parent `AGENTS.md`, `CLAUDE.md`, or `_templates/`. Replace `MACHINE.md` TODOs
only with verified local facts and never add credentials, private documents, or
secret filenames. Then run:

```bash
node scripts/init-workspace.mjs --check
```

If the parent contains a legacy `AGENTS.md`, `CLAUDE.md`, or `_templates/`, stop
and report it. Automatic migration is not currently supported. Review the
entries and move them manually outside the workspace root before rerunning;
never move sibling projects or `MACHINE.md` as part of that cleanup.

Initialize one project explicitly:

```bash
node scripts/init-project.mjs ../project-a
```

Add `--create` only when the target directory does not yet exist. The command
seeds missing project-owned guidance directly from `project-templates/` and
preserves existing files. With no existing environment ignore rules it appends
the complete ordered environment block plus missing independent safety rules;
incomplete or ambiguous environment rules stop for manual review before any
write. It does not initialize Git, copy `TEMPLATE-USAGE.md`, replace a README,
or edit any sibling project.

The user may instead say “Initialize `<target-project>` using
machine-bootstrap.” Resolve and repeat the exact target before execution, then
use the same initializer and safety rules above; do not copy template files by
hand.

Report the initialized paths, shared capability state, remaining placeholders,
and review-required conditions. Do not initialize Git at the workspace root or
stage, commit, publish, overwrite, or migrate anything without the user's
authority for that action.

After project initialization, start a new Codex or Claude session in that
project root or relevant scoped directory. A bootstrap session may administer
or route a sibling, but it must not become the long-lived coding session for
that project. Parent or sibling access may require sandbox authorization;
access does not load sibling instructions.

Use `--skip-skills` or `--skip-workflows` only when the user explicitly wants
that shared layer left untouched. Installing `product-delivery` makes its roles
available but does not activate the workflow for ordinary work.

Codex desktop is the primary interactive entry; use the task prompts in
`README.md`. CLI profiles configure new CLI sessions only. Verify the selected
provider roots: workflow adapters and Claude skill links honor
`CLAUDE_CONFIG_DIR`; Codex adapters and duplicate-skill checks honor `CODEX_HOME`.
Canonical shared skills remain under `~/.agents/skills/`. Use the expanded
default/custom-root and nested-loading checks in `docs/guidance-loading-smoke.md`
when establishing runtime support. Report unrun scenarios explicitly.
