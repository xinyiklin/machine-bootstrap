# Initialize This Workspace

Agent-facing entry point for a fresh checkout. Prerequisites: Git and Node.js 18
or newer.

## Instruction for an AI agent

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
and report it. After confirming the entries are unchanged bootstrap-generated
files, migrate them recoverably with:

```bash
node scripts/init-workspace.mjs --migrate-legacy-layout
```

The migration rejects unknown differences and moves recognized entries under
`../.machine-bootstrap-backup/<timestamp>/`; it never touches sibling projects
or `MACHINE.md`.

Initialize one project explicitly:

```bash
node scripts/init-project.mjs ../project-a
```

Add `--create` only when the target directory does not yet exist. The command
seeds missing project-owned guidance directly from `project-templates/`,
preserves existing files, and merges missing positive `.gitignore` safety
entries without adding negation rules to an existing file. It
does not initialize Git, copy `TEMPLATE-USAGE.md`, replace a README, or edit any
sibling project.

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
