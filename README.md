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
- `project-templates/` — the single canonical starter source for project-owned
  guidance, Git workflow, PR template, and ignore entries.
- `docs/engineering/git-workflow.md` — this repository's Git/publication
  contract; the project starter has its own project-owned contract.
- `.github/workflows/bootstrap.yml` — Linux, Windows, and macOS verification.
- `skills.json` and `scripts/install-skills.mjs` — reviewed shared skill roster
  and missing-only installer.
- `workflows/` and `scripts/install-workflows.mjs` — provider-neutral workflow
  packages and deterministic adapters.
- `scripts/init-workspace.mjs` — parent registry plus shared capabilities.
- `scripts/init-project.mjs` — explicit, target-scoped, one-time project seeding.
- `scripts/audit-workspace.mjs` — read-only report of every sibling's guide
  sizes, Claude import, and continuity length.
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

Prerequisites: Git, Node.js 24 or newer, Claude Code and/or Codex.

Choose either setup style:

- **Agent-assisted setup (recommended for normal use):** open an agent session in
  this repository and ask: **“Set up this workspace using machine-bootstrap.
  Follow `INIT.md`, preserve existing files, stop for anything requiring manual
  review, and report what changed. Do not commit or publish anything.”** The user
  does not need to name or memorize script commands. The agent reads the
  contracts, confirms scope, requests any required filesystem permission, and
  uses the repository's audited scripts for the actual setup and verification.
- **Direct CLI setup:** follow the commands below yourself. This is useful for
  automation, repeatable machine provisioning, or inspecting each command
  directly.

1. Clone this repository as a direct child of the dedicated non-Git folder that
   will contain sibling projects. The filesystem root and user home are rejected
   as unsafe workspace targets.
2. Initialize the optional registry and shared capabilities:

   ```bash
   node scripts/init-workspace.mjs
   ```

   The command creates `../MACHINE.md` only when missing, installs or verifies
   shared skills and workflows, and generates provider adapters. The canonical
   machine template must be a real in-checkout file and is snapshot-read with
   no-follow access before any workspace write. The command never creates
   parent guidance or a parent template copy.
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
   `_templates/`, initialization stops without moving anything. The same stop
   applies to `AGENTS.override.md`, `CLAUDE.local.md`, `.claude/AGENTS.md`,
   `.claude/CLAUDE.md`, or `.claude/rules/` at the workspace root, and to
   `AGENTS.md`, `CLAUDE.md`, `CLAUDE.local.md`, `.claude/AGENTS.md`, or
   `.claude/CLAUDE.md` in any folder above it, because Claude loads those into
   every sibling session. A user home's (or `CLAUDE_CONFIG_DIR`'s)
   `.claude/CLAUDE.md` is user memory and is not flagged; a path that cannot be
   inspected also stops setup. Automatic migration is not currently supported.
   Review those entries and move them manually before rerunning; never move
   `MACHINE.md` or sibling project guidance as part of that cleanup.
5. Seed one existing project root:

   ```bash
   node scripts/init-project.mjs ../project-a
   ```

   For a missing directory, add `--create`. The initializer does not initialize
   Git. It creates only missing project-owned files and preserves existing
   files. Git boundary probes clear inherited repository/worktree path
   overrides before evaluating their explicit `-C` targets. For an existing
   `.gitignore` with no environment rules, it appends
   the complete ordered `.env`, `.env.*`, `!.env.example` policy plus missing
   independent safety rules. An existing canonical environment block is
   preserved only when Git confirms the resulting rules still ignore local
   environment files and expose `.env.example`; ineffective, incomplete, or
   ambiguous rules stop for manual review before any project writes. The
   initializer never copies `TEMPLATE-USAGE.md` and never creates or replaces a
   README. Canonical template sources must remain real files inside this
   checkout and are snapshotted with no-follow reads before project writes.
   Newly created parents use an atomic no-replace directory claim and are
   identity-snapshotted before use. Managed reads, writes, and
   rollback recovery are anchored to real parent-directory identities pinned
   for the full run; symbolic-link, parent, leaf, or backup replacement stops
   safely instead of being followed or deleted. Every seeded file is
   identity-and-byte checked again before success; a preflighted starter that
   disappears stops before replacement. On failure, rollback moves
   run-owned files to named recovery paths
   instead of deleting them, and leaves identity-changed concurrent entries at
   their original paths. It never deletes directories by pathname; file and
   directory cleanup is reported for manual review.
6. Replace project placeholders with verified project facts. Start a new Codex
   or Claude session in that project root or relevant scoped directory.
7. Audit sibling guidance whenever useful; it reads guide sizes and continuity
   length and changes nothing:

   ```bash
   node scripts/audit-workspace.mjs
   ```

   Fix findings in a session started in that project. In Claude Code 2.1.283
   and later, `/doctor prompt-audit` also finds stale or conflicting
   instructions.

To initialize only one project through an agent, specify its exact path:
**“Initialize `../project-a` using machine-bootstrap. Preserve existing files,
stop for review-required conditions, verify the result, and do not commit or
publish anything.”**

### Recommended Claude permissions

Bootstrap installers never edit Claude's `settings.json`. Add these rules to
the user settings yourself (or ask an agent to, preserving existing keys):

```json
{
  "permissions": {
    "allow": ["Read(~/.agents/workflows/**)"],
    "deny": [
      "Read(//**/*.pem)", "Read(//**/*.key)", "Read(~/.ssh/**)",
      "Read(~/.aws/**)", "Read(~/.gnupg/**)", "Read(//**/.env)",
      "Read(//**/.env.local)", "Read(//**/.env.*.local)",
      "Read(//**/.env.production)", "Read(//**/.env.development)"
    ]
  }
}
```

The allow rule lets workflow roles read their installed contract without a
prompt. Deny rules keep `.env.example` readable and cover Claude's file tools
and recognized shell file commands, not arbitrary scripts; use Claude's
sandbox for OS-level enforcement. Add a rule for any other environment file
name your projects use, such as `.env.test` or `.env.staging`. Keep keys and
credentials outside the workspace regardless.

### Why projects keep `CLAUDE.md`

Claude Code 2.1.277 and later can read `AGENTS.md` without a `CLAUDE.md`, but
only while no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists on
the path. Starters keep a thin `CLAUDE.md` whose single `@AGENTS.md` import
loads the shared guide once in every Claude version and session, survives a
personal `CLAUDE.local.md`, and keeps `InstructionsLoaded` evidence. All shared
policy stays in `AGENTS.md`; `CLAUDE.md` holds only Claude-specific mechanics,
which Codex never loads.

## Product delivery workflow

Alongside guidance and skills, this repository owns a portable, provider-neutral
workflow foundation. It owns the **process**; each project keeps owning its
product behavior, architecture, engineering rules, and required verification.

### Activation

Installation makes the workflow available, not universally active. The complete
flow activates only when the user selects Delivery Lead or Product Partner,
explicitly requests the complete workflow, continues an active Implementation
Plan, or a project requires it for a named class of work. Selecting the
Verifier activates only independent verification for the supplied change; it
does not retroactively create a missing plan or authorization. Ordinary work
creates no workflow artifacts by default.

For this repository, `AGENTS.md` names the activating contracts: installation
ownership and recovery, acquisition integrity, provider formats/discovery,
workflow policy, hard invariants, and propagation to siblings. Mechanical
maintenance that preserves those contracts stays outside the full flow. Every
implementation still receives self-verification and fresh independent review
before local completion. Record the classification rather than judging a task
by its apparent size. Existing project-owned starters are never synchronized
when these defaults change.

The Git contracts and PR templates use a 500-line target and a 1,000-line
review gate, measured as additions plus deletions. Changes over 1,000 require a
split or an explicit reviewer exception; generated/lockfile/rename/binary
changes are reported separately. See `docs/engineering/git-workflow.md` for
counting, exceptions, and review requirements. These gates are guidance for
both providers, not an automated CI size limit.

### The three roles

| Role | Owns | Claude agent | Codex agent |
| :--- | :--- | :--- | :--- |
| Delivery Lead | Default entry: clarification, investigation, the plan, implementation, self-verification | `mb-delivery-lead` | `mb_delivery_lead` |
| Product Partner | Optional broad discovery and product-alignment review | `mb-product-partner` | `mb_product_partner` |
| Verifier | Fresh independent evidence | `mb-verifier` | `mb_verifier` |

### The standard flow

```text
User ⇄ Delivery Lead (optionally with Product Partner)
        └─ one living Implementation Plan: clarify ⇄ investigate ⇄ plan ⇄ implement
                                                   └─▶ self-review ─▶ Verifier ─▶ user acceptance
```

The Delivery Lead normally owns one Implementation Plan per task. It asks the
user questions whenever answers materially affect the work, records findings
and decisions with their sources, and keeps a compact checkpoint so an
interrupted or reset session can resume from the plan and the actual repository
state. Other agents return findings for the owner to integrate.

The plan separates its **authorized scope** — goal, required behavior,
constraints, acceptance criteria, and choices the user has settled — from its
evolving **execution record**. Authorization comes only from the user, and one
authorization covers the plan's scope; an implementation request in the
conversation already counts, while a request to plan first does not. Routine
findings, progress, and evidence never invalidate it. A discovery that would
change agreed behavior, weaken a criterion, expand scope, risk destructive
migration, or add a security or privacy implication is presented as a concrete
choice, and the user decides before the affected work continues.

These are process and authority rules, not authentication. No file or command
here proves that a human approved anything.

Every implementation is self-verified by the Delivery Lead and then reviewed by
at least one fresh independent Verifier by default. Only the user may waive that
review for a specific change. Product Partner alignment never replaces it. The
user may request more reviewers; after the first review, the Delivery Lead
states firmly whether another review is warranted and why, then honors the
request.

### Installed paths

| What | Path |
| :--- | :--- |
| Canonical workflow package | `~/.agents/workflows/product-delivery/` |
| Claude agents | `$CLAUDE_CONFIG_DIR/agents/mb-*.md` when set; otherwise `~/.claude/agents/mb-*.md` |
| Codex agents | `$CODEX_HOME/agents/mb_*.toml` when set; otherwise `~/.codex/agents/mb_*.toml` |
| Codex profiles | `$CODEX_HOME/mb-product-partner.config.toml` and `$CODEX_HOME/mb-delivery-lead.config.toml` when set; otherwise the same filenames under `~/.codex/` |

The canonical package holds `manifest.json`, `WORKFLOW.md`, the three role
contracts in `roles/`, and the artifact templates in `templates/`. The
Markdown role contracts are the source of truth; every provider file is
generated from them, carries a provenance comment naming its source contract,
and pins no model, so each provider keeps its own default. The Claude Verifier
adapter also removes `Edit`, `Write`, and `NotebookEdit`, enforcing that the
Verifier does not edit the change it reviews while keeping the shell for checks.
Its Codex adapter inherits the parent sandbox, because a read-only sandbox would
block test suites that write disposable files.

An activated task normally creates two artifacts: the Implementation Plan and
the Verification Report. Implementation Report, Alignment Review, Decision Log,
and Change Request templates are optional detail linked from the plan, never
competing requirement sources; empty placeholder artifacts are not created.
Task artifacts are local working records under the ignored `.agent-work/`.
The PR body (or the final report for unpublished work) carries the durable
outcome, and the task folder is deleted when the task completes; tracked
documents cite the PR or commit instead.

The plan records the implementer's coverage and self-verification.
Verification Reports alone own final independent passed, failed, unverified,
and skipped judgments or an explicit user waiver.

The installer owns exactly those namespaced paths. It never treats the whole
`~/.agents`, Claude configuration root, or Codex home as bootstrap-owned, and
it does not read or write `settings.json` in the Claude configuration root or
`config.toml` in the Codex home.

### Launching a role

#### Codex desktop (primary workspace)

Open a task in the target repository, then state the outcome in ordinary
language. Root guidance routes routine work; inspect the nearest scoped guide
before editing a subtree. Use a fresh task starting in that scope when relying
on automatic nested instruction discovery.

For ordinary implementation:

> Implement the requested change within the existing contract. Run the affected
> checks, then delegate a fresh independent review to `mb_verifier`. Report the
> evidence and unresolved findings. Keep changes local.

For a review without implementation:

> Delegate review of the current changes to `mb_verifier`. Inspect the actual
> diff and checks; report findings without editing or publishing. Missing full
> workflow artifacts are a limitation only where that workflow was required.

For the complete discovery-to-delivery workflow:

> Use the complete `product-delivery` workflow for this task as Delivery Lead.
> Read its installed contract, clarify and investigate, and keep one
> Implementation Plan with a current checkpoint. Ask me before any material
> change, then self-review and delegate independent review to `mb_verifier`.

These are task instructions, not an app profile selector. The CLI profile
commands below configure a primary CLI session; do not assume they select the
role of an existing desktop task. Custom agents are delegated specialists.
Codex currently supports delegation explicitly requested by the user or by
applicable project/skill instructions. Leave model and reasoning settings
inherited unless the user chooses otherwise; bootstrap adapters pin neither.

Confirm `mb_product_partner`, `mb_delivery_lead`, and `mb_verifier` are available
in a fresh task after installation. If the harness cannot expose an installed
role, report that limit and request a replacement reviewer or explicit waiver
when review is required. A new user-owned task is not needed for each subagent.

#### Claude Code and Codex CLI

Launching Delivery Lead or Product Partner activates the complete workflow.
Delivery Lead is the normal entry; launch Product Partner for broad discovery.
Launching the Verifier activates only its independent verification portion for
the supplied change.

Claude Code runs an agent as the whole session with `--agent`:

```bash
claude --agent mb-delivery-lead
```

```bash
claude --agent mb-product-partner
```

The Verifier is normally invoked through Claude Code's native subagent
delegation: ask the Delivery Lead to delegate independent verification to the
installed `mb-verifier` agent. It can also be launched directly with
`claude --agent mb-verifier`.

Codex launches a primary session through the matching profile:

```bash
codex --profile mb-delivery-lead
```

```bash
codex --profile mb-product-partner
```

The Codex Verifier is available as the custom agent `mb_verifier`; ask the
Delivery Lead to spawn it through Codex's native subagent delegation. It has no
profile because it is not a primary-session role.

Start a new session after installation so the provider rediscovers the
definitions.

Claude retains its native `--agent` entry and `@AGENTS.md` shared-guidance
adapter. Its upward and lazy nested `CLAUDE.md` loading differs from Codex's
startup guide chain; use the provider-specific checks in
`docs/guidance-loading-smoke.md`.

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

A major upgrade, such as 2.x to 3.0.0, is this same reviewed path: the default
install reports every changed file and writes nothing, and `--replace` backs up
the previous contract, adapters, and templates before writing. The installer
never deletes a file the new version no longer declares; after upgrading to
3.0.0, remove the retired `templates/product-brief.md` and
`templates/delivery-plan.md` redirects from the installed package by hand.

### Adding project-specific requirements

A project may name work that activates the workflow and add material-change
triggers, required checks, specialist review, or artifact-retention policy
without copying the workflow into the repository. The starter project template
contains only this conditional hook. Once active, a project may strengthen but
not weaken user authorization of scope, material-change escalation, independent
review, or honest verification.

## Updating

Shared skill content lives in `~/.agents/skills/`, which Codex discovers
directly. Claude links live under `$CLAUDE_CONFIG_DIR/skills/` when set, or
`~/.claude/skills/` otherwise. Checks for redundant Codex-specific copies use
`$CODEX_HOME/skills/` when set, or `~/.codex/skills/` otherwise. Changing a
provider configuration root does not relocate canonical shared skills. Relative
override paths resolve from the command's working directory; empty overrides
use the defaults, matching workflow installation. Inactive default provider
directories and unrelated entries remain untouched.

The installer adds only missing skills and rejects content that differs from
`skills.json`. To update a skill, review the upstream change at its repository,
then revise its exact `sourceRevision`, `sourcePath` when needed, expected
version when applicable, and `contentSha256` together. A changed skill must not
pass bootstrap verification until that portable manifest is updated
intentionally. Generated global lockfiles from other skill managers remain
machine state and are not authoritative for this bootstrap.

Installation and `--check` also list any skill in `~/.agents/skills/` that is
not in `skills.json`. Codex discovers such a skill while Claude has no link to
it; review and add it to the manifest, or move it out of the shared root.

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
manual-only legacy detection, explicit project target safety, missing-only
seeding, existing guidance preservation, order-aware `.gitignore` handling,
ownership-safe rollback, sibling byte isolation, import topology, byte budgets,
skill integrity, workflow validation, deterministic adapter generation,
check-only behavior, and Linux/Windows/macOS CI contracts. It makes no model or
API calls and never points setup scripts at the live parent workspace or
provider roots.

Manual provider loading checks live in
`docs/guidance-loading-smoke.md`. Static tests are not runtime loading evidence.

Provider contracts checked against official documentation on 2026-10-09:
[Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[Codex skills](https://learn.chatgpt.com/docs/build-skills),
[Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents),
[Codex configuration](https://learn.chatgpt.com/docs/config-file/config-basic),
[Claude memory and `AGENTS.md`](https://code.claude.com/docs/en/memory),
[Claude subagents](https://code.claude.com/docs/en/sub-agents),
[Claude permissions](https://code.claude.com/docs/en/permissions), and
[Claude configuration directories](https://code.claude.com/docs/en/claude-directory).
Guidance length follows
[Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988): unnecessary
requirements lowered agent success and raised cost.
These sources establish supported contracts, not successful loading on every
installed provider version.
