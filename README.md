# Machine Bootstrap

Portable AI-agent setup and guidance for a development workspace.

This repository is intentionally separate from the projects it configures. It
can be cloned into the root folder that contains your projects without making
those child folders part of one parent Git repository.

## Ownership hierarchy

The control flow is:

1. **`machine-bootstrap/`** owns initialization: the shared-skill roster, the
   portable workflow foundation, setup scripts, portable workspace guides, and
   project-guide templates.
2. **The workspace root** owns launch-specific routing: `AGENTS.md` for Codex
   sessions started exactly there, a tiny ancestor `CLAUDE.md`, machine-local
   `MACHINE.md`, and inert `_templates/` used to initialize projects.
3. **Each project** owns its self-contained product and engineering guidance.
   Its nearest current `AGENTS.md` and owning documentation govern work inside
   that project.

`machine-bootstrap/` may physically live inside the workspace root, but it is
the portable source of truth for initializing the layer above the individual
projects. The workspace root can remain outside Git, and child projects remain
independent repositories.

The resulting filesystem stays flat at the repository boundary:

```text
Workspace/
├── AGENTS.md
├── CLAUDE.md
├── MACHINE.md
├── _templates/
├── machine-bootstrap/   # its own Git repository
├── project-a/           # its own Git repository
└── project-b/           # its own Git repository
```

The ownership hierarchy does not require moving projects inside the bootstrap
repository.

## What belongs here

- `AGENTS.md` and `CLAUDE.md` — self-contained instructions for working on this
  repository; the Claude overlay imports the canonical repository guide.
- `guides/AGENTS.md` — portable Codex workspace-root router and fallback.
- `guides/git-workflow.md` — portable Git/GitHub branch, commit, PR, review,
  merge, and publication baseline.
- `.github/pull_request_template.md` — this repository's concise PR receipt;
  the project-template copy is seeded for new child repositories.
- `.github/workflows/bootstrap.yml`: Linux and Windows bootstrap verification.
- `guides/CLAUDE.md` — portable Claude Code overlay.
- `guides/MACHINE.example.md` — structure for facts that differ by machine.
- `project-templates/` — starter guidance plus non-copyable
  `TEMPLATE-USAGE.md` for a new repository.
- `skills.json` — the desired shared Claude Code/Codex skill roster.
- `workflows/` — versioned, provider-neutral workflow packages, listed by
  `workflows/registry.json`.
- `INIT.md` — concise instructions an AI agent can follow on a fresh machine.
- `scripts/init-workspace.mjs` — safe, one-command workspace initialization.
- `scripts/install-skills.mjs` — installs missing skills and verifies their
  canonical content and harness-facing paths.
- `scripts/install-workflows.mjs` — installs the canonical workflow packages and
  generates the Claude and Codex adapters.
- `scripts/setup-guides.mjs` — installs workspace guides and seeds `_templates/`
  beside this repository.
- `scripts/test-bootstrap.mjs` — isolated regression checks for bootstrap safety.
- `docs/continuity/` — rotated historical ledger entries, read only when a task
  needs them; current state remains in `CONTINUITY.md`.

## What stays machine-local

The workspace root's `MACHINE.md` records absolute paths, project inventory,
port reservations, local lifecycle notes, browser preferences, and other facts
that should not be copied blindly to another computer.

Do not put credentials, private keys, tokens, resume contents, patient-style
data, or provider responses in either this repository or `MACHINE.md`.

## Set up another machine

Prerequisites: Git, Node.js 18 or newer, Claude Code and/or Codex.

1. Clone this repository as a direct child of the dedicated folder that will
   contain your projects. Its parent directory becomes the workspace root; the
   filesystem root and user home are rejected as unsafe targets.
2. Initialize and verify the workspace:

   ```bash
   node scripts/init-workspace.mjs
   ```

   This command verifies that the workspace root is outside Git, installs the
   portable guidance layer and project templates, installs missing shared
   skills directly from exact reviewed Git revisions, verifies their content
   hashes before installation, installs the workflow foundation with its
   generated provider adapters, and runs a final read-only verification. It
   does not execute upstream package installers or lifecycle scripts.

3. Customize the generated `MACHINE.md` with facts verified on that computer.
4. Confirm the complete setup after replacing all `TODO` placeholders:

   ```bash
   node scripts/init-workspace.mjs --check
   ```

   Check mode is read-only and fails when portable files drift, skills are
   missing, or `MACHINE.md` still contains placeholders.

   Add `--skip-skills` to leave the shared skill roster untouched, and
   `--skip-workflows` to leave the workflow foundation and provider adapters
   untouched. Each flag skips both the installation and the verification for
   that layer.

5. Follow `_templates/TEMPLATE-USAGE.md`. Copy only its named starter paths,
   including the project-owned Git workflow guide and PR template; do not copy
   the usage file as the project's README.
6. Start or restart Codex at the target project root or relevant scoped
   directory; its instruction chain is built once per run. Start a new Claude
   Code session so it rediscovers installed definitions and project guidance.

To delegate setup, tell an AI agent: **“Follow `machine-bootstrap/INIT.md`.”**

Existing workspace files are never silently overwritten. Differing portable
guides or templates make setup fail with a review-required message. After
review, `node scripts/init-workspace.mjs --replace` creates timestamped backups
and installs the portable versions. `MACHINE.md` is always preserved once it
exists.

A workspace guide may be a symlink; it is compared through the link, so one
pointing at its portable source verifies as current. Replacement renames the
existing entry to a backup before writing, so a link target is never written
through.

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

The regression suite uses disposable workspaces and disposable home directories.
Fixture copies exclude root-local agent state, ignored generated roots, and
machine-local files such as `MACHINE.md`, `.env*`, `.npmrc`, local Claude
overrides, logs, and backups. Portable nested `.claude/` and `.agents/` content
and `.env.example` remain copyable. Coverage includes clean
initialization, reviewed replacement recovery, portable drift,
malformed machine state, deterministic skill integrity, reviewed Git-tree
materialization, safe target boundaries, invalid manifests and portable
sources, missing prerequisites, rejected arguments, and concise acquisition
failures. Workflow coverage adds manifest and source validation, clean
installation, provider-root overrides, deterministic adapter generation,
adversarial TOML encoding, provenance and canonical contract content, absence
of pinned models, untouched unrelated provider configuration, missing-only
default behavior, cross-layer preflight, drift rejection before partial writes,
transactional replacement rollback, reviewed replacement backups, read-only
`--check`, and `--skip-workflows`. Workflow tests make no model or API calls and
need no Claude Code or Codex authentication. The suite does not execute upstream
code.

Guidance tests statically model documented provider loading topology, imports,
activation, report ownership, and context budgets. They do not launch Codex or
Claude and are not runtime-loading evidence. Use
`docs/guidance-loading-smoke.md` for manual provider smoke checks.

GitHub Actions runs the suite plus a read-only initialized-guidance check on
Linux and Windows. The CI workspace and machine facts are disposable; CI does
not install shared skills or provider adapters into a persistent user home.

The suite runs before the first install. Checks that read this machine's
installed roster are reported as skipped, by name, until the skills are
installed; rerun after initialization to cover them. Checks that need a
capability this host lacks — creating symbolic links, or POSIX permission
enforcement — are also skipped by name rather than reported as failures.
