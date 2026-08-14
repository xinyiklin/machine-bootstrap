# Machine Bootstrap

Portable machine-level AI-agent setup and one-time project guidance seeding for
a workspace of independent sibling repositories.

This repository is a direct child of the workspace it administers. It does not
turn that workspace into a parent repository or an instruction scope.

## Ownership hierarchy

The layout is intentionally sibling-only:

```text
Workspace/
|-- MACHINE.md                  # optional, machine-local, inert
|-- machine-bootstrap/          # its own Git repository
|   |-- AGENTS.md
|   |-- CLAUDE.md
|   |-- machine-templates/
|   |-- project-templates/
|   `-- scripts/
|-- project-a/                  # its own Git repository and guidance
|-- project-b/                  # its own Git repository and guidance
`-- scratch/                    # optional, non-project experiments
```

The workspace root has no live `AGENTS.md`, `CLAUDE.md`, or `_templates/`.
Codex and Claude sessions for normal project work start in the target project
root or relevant scoped directory. A bootstrap session may initialize, audit,
repair, install, inspect the registry, or route a sibling project, but it must
not become that project's long-lived coding session.

Filesystem access to the parent registry or a sibling target may require sandbox
authorization. Access does not load that sibling repository's instructions into
the current session.

## What belongs here

- `AGENTS.md` and `CLAUDE.md` — instructions for this repository only.
- `machine-templates/MACHINE.example.md` — starter for the optional inert parent
  registry.
- `machine-templates/legacy-layout-manifest.json` — fingerprints used only to
  recognize safely migratable files from the retired workspace-router layout.
- `project-templates/` — the single canonical starter source for project-owned
  guidance, Git workflow, PR template, and ignore entries.
- `docs/engineering/git-workflow.md` — this repository's Git/publication
  contract; the project starter has its own project-owned contract.
- `.github/workflows/bootstrap.yml` — Linux and Windows verification.
- `skills.json` and `scripts/install-skills.mjs` — reviewed shared skill roster
  and missing-only installer.
- `workflows/` and `scripts/install-workflows.mjs` — provider-neutral workflow
  packages and deterministic adapters.
- `scripts/init-workspace.mjs` — parent registry plus shared capabilities.
- `scripts/init-project.mjs` — explicit, target-scoped, one-time project seeding.
- `scripts/test-bootstrap.mjs` — disposable regression suite.
- `CONTINUITY.md` — bounded current state; `docs/continuity/` is on-demand,
  append-only history.

`project-templates/TEMPLATE-USAGE.md` documents the starter set but is never
copied into a project or renamed as its README. Once starter files are copied,
they are project-owned and are not synchronized against machine-bootstrap.

## What stays machine-local

The optional parent `MACHINE.md` records project inventory, relative or local
paths, port reservations, cross-project relationships, machine capabilities,
and lifecycle notes. It is not automatically loaded by Codex or Claude.
Machine-bootstrap reads it deliberately only for administration, discovery,
port allocation, or sibling routing. Project sessions normally do not need it.

Do not put credentials, private keys, tokens, private documents, sensitive data,
secret filenames, or provider responses in this repository or `MACHINE.md`.

The optional `scratch/` folder is for disposable experiments, downloaded
samples, fixtures, or non-project work. It carries no inherited repository
policy. Promote durable work into its own sibling project with its own guidance.

## Set up another machine

Prerequisites: Git, Node.js 18 or newer, Claude Code and/or Codex.

1. Clone this repository as a direct child of the dedicated non-Git folder that
   will contain sibling projects. The filesystem root and user home are rejected
   as unsafe workspace targets.
2. Initialize the optional registry and shared capabilities:

   ```bash
   node scripts/init-workspace.mjs
   ```

   The command creates `../MACHINE.md` only when missing, installs or verifies
   shared skills and workflows, and generates provider adapters. It never
   creates parent guidance or a parent template copy.
3. Replace `MACHINE.md` TODOs with verified local facts, then run:

   ```bash
   node scripts/init-workspace.mjs --check
   ```

   Check mode is read-only. It allows the optional registry to be absent, but
   fails on unresolved placeholders when the file exists, shared-capability
   drift, or retired parent guidance/template entries.
   Use `--skip-skills` or `--skip-workflows` to omit that layer from both setup
   and verification.
4. If an older bootstrap generated parent `AGENTS.md`, `CLAUDE.md`, or
   `_templates/`, review and migrate recognized unchanged entries recoverably:

   ```bash
   node scripts/init-workspace.mjs --migrate-legacy-layout
   ```

   Unknown or user-authored differences stop for manual review. Recognized
   entries move under `../.machine-bootstrap-backup/<timestamp>/`; `MACHINE.md`
   and sibling project guidance are never moved.
5. Seed one existing project root:

   ```bash
   node scripts/init-project.mjs ../project-a
   ```

   For a missing directory, add `--create`. The initializer does not initialize
   Git. It creates only missing project-owned files, preserves existing files,
   merges missing positive `.gitignore` safety entries without adding negation
   rules to an existing file, never copies
   `TEMPLATE-USAGE.md`, and never creates or replaces a README.
6. Replace project placeholders with verified project facts. Start a new Codex
   or Claude session in that project root or relevant scoped directory.

To delegate setup, tell an AI agent: **“Follow `machine-bootstrap/INIT.md`.”**

## Product delivery workflow

Alongside guidance and skills, this repository owns a portable, provider-neutral
workflow foundation. It owns the **process**; each project keeps owning its
product behavior, architecture, engineering rules, and required verification.

### Activation

Installation makes the workflow available, not universally active. The complete
flow activates only when the user selects Product Partner or Delivery Lead,
explicitly requests the complete workflow, continues an active Product Brief or
Delivery Plan, or a project requires it for a named class of work. Selecting the
Verifier activates only independent verification for the supplied change; it
does not retroactively create missing upstream gates or artifacts. Ordinary
work creates neither by default.

### The three roles

| Role | Owns | Claude agent | Codex agent |
| :--- | :--- | :--- | :--- |
| Product Partner | Why and what | `mb-product-partner` | `mb_product_partner` |
| Delivery Lead | How and delivery | `mb-delivery-lead` | `mb_delivery_lead` |
| Verifier | Independent evidence | `mb-verifier` | `mb_verifier` |

### The standard handoff

```text
User ⇄ Product Partner
        └─ approved Product Brief ─▶ Delivery Lead
                                      └─ approved Delivery Plan ─▶ execution
                                                                     └─▶ Verifier ─▶ user acceptance
```

There are two distinct gates, and each needs the user's explicit approval of an
exact artifact version. A Product Brief approves the problem, workflow,
constraints, and acceptance criteria — never a technical design. A Delivery Plan
approves the technical approach and authorizes execution within that scope only.
A discovery that changes user-facing behavior, weakens a criterion, materially
expands scope, risks destructive migration, or adds a security or privacy
implication requires a structured Change Request rather than a quiet widening.

These are process and authority rules, not authentication. No file or command
here proves that a human approved anything.

Every implementation is self-verified by the Delivery Lead and then reviewed by
at least one fresh independent Verifier by default. Only the user may waive that
review for a specific change. The user may request more reviewers; after the
mandatory review, the Delivery Lead states firmly whether another review is
warranted and why, then honors the request.

### Installed paths

| What | Path |
| :--- | :--- |
| Canonical workflow package | `~/.agents/workflows/product-delivery/` |
| Claude agents | `$CLAUDE_CONFIG_DIR/agents/mb-*.md` when set; otherwise `~/.claude/agents/mb-*.md` |
| Codex agents | `$CODEX_HOME/agents/mb_*.toml` when set; otherwise `~/.codex/agents/mb_*.toml` |
| Codex profiles | `$CODEX_HOME/mb-product-partner.config.toml` and `$CODEX_HOME/mb-delivery-lead.config.toml` when set; otherwise the same filenames under `~/.codex/` |

The canonical package holds `manifest.json`, `WORKFLOW.md`, the three role
contracts in `roles/`, and seven artifact templates in `templates/`. The
Markdown role contracts are the source of truth; every provider file is
generated from them, carries a provenance comment naming its source contract,
and pins no model, so each provider keeps its own default.

The seven templates are available building blocks, not universally required
files. An activated task using the full discovery-to-delivery sequence normally
uses five: Product Brief, Delivery Plan, Alignment Review, Implementation
Report, and Verification Report. Decision Logs and Change Requests are created
only when needed; empty placeholder artifacts are not created. Active task
artifacts stay local by default. If a project tracks agent
guidance/configuration and `CONTINUITY.md`, it removes the starter
`.agent-work/` ignore rule and also tracks completed task folders referenced
with `[TASK <task-id>]` so continuity never points to missing local files.

Implementation Reports contain the implementer's scope, coverage, and
self-verification. Verification Reports alone own final independent passed,
failed, unverified, and skipped judgments or an explicit user waiver.

The installer owns exactly those namespaced paths. It never treats the whole
`~/.agents`, Claude configuration root, or Codex home as bootstrap-owned, and
it does not read or write `settings.json` in the Claude configuration root or
`config.toml` in the Codex home.

### Launching a role

Launching Product Partner or Delivery Lead activates the complete workflow.
Launching the Verifier activates only its independent verification portion for
the supplied change.

Claude Code runs an agent as the whole session with `--agent`:

```bash
claude --agent mb-product-partner
```

```bash
claude --agent mb-delivery-lead
```

The Verifier is normally invoked through Claude Code's native subagent
delegation: ask the Delivery Lead to delegate independent verification to the
installed `mb-verifier` agent. It can also be launched directly with
`claude --agent mb-verifier`.

Codex launches a primary session through the matching profile:

```bash
codex --profile mb-product-partner
```

```bash
codex --profile mb-delivery-lead
```

The Codex Verifier is available as the custom agent `mb_verifier`; ask the
Delivery Lead to spawn it through Codex's native subagent delegation. It has no
profile because it is not a primary-session role.

Start a new session after installation so the provider rediscovers the
definitions.

### Updating a workflow

Edit the canonical contract or template in `workflows/`, bump
`workflowVersion` in that package's `manifest.json`, then rerun installation.
Adapters regenerate deterministically, so nothing drifts between the contract
and the provider files.

Installation is missing-only. A destination that exists but differs fails
closed with a review message before anything is written. After review:

```bash
node scripts/install-workflows.mjs --replace
```

Reviewed replacement renames each existing entry to a timestamped backup before
writing, so a customized adapter is recoverable and a symlinked destination is
never written through.

### Adding project-specific requirements

A project may name work that activates the workflow and add Change Request
triggers, required checks, specialist review, or artifact-retention policy
without copying the workflow into the repository. The starter project template
contains only this conditional hook. Once active, a project may strengthen but
not weaken exact user approval, scope-change escalation, or honest verification.

## Updating

The installer adds only missing skills and rejects content that differs from
`skills.json`. To update a skill, review the upstream change at its repository,
then revise its exact `sourceRevision`, `sourcePath` when needed, expected
version when applicable, and `contentSha256` together. A changed skill must not
pass bootstrap verification until that portable manifest is updated
intentionally. Generated global lockfiles from other skill managers remain
machine state and are not authoritative for this bootstrap.

Print the installed content hashes after review with:

```bash
node scripts/install-skills.mjs --print-hashes
```

Keep project-specific architecture, commands, safety invariants, and
verification in each project's own `AGENTS.md` and engineering documentation.

## Verification

```bash
node scripts/test-bootstrap.mjs
node scripts/init-workspace.mjs --check
```

The regression suite uses disposable workspaces, projects, Git repositories, and
home directories. It covers parent boundary checks, registry initialization,
legacy detection and recoverable migration, explicit project target safety,
missing-only seeding, existing guidance preservation, `.gitignore` merging,
sibling byte isolation, import topology, byte budgets, skill integrity,
workflow validation, deterministic adapter generation, rollback, check-only
behavior, and Linux/Windows CI contracts. It makes no model or API calls and
never points setup scripts at the live parent workspace or provider roots.

Manual provider loading checks live in
`docs/guidance-loading-smoke.md`. Static tests are not runtime loading evidence.
