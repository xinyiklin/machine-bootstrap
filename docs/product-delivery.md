# Product Delivery Workflow — Operator Guide

How to activate, launch, install, and update the portable `product-delivery`
workflow this repository owns. The contract itself is
`workflows/product-delivery/WORKFLOW.md`, installed to
`~/.agents/workflows/product-delivery/`. Read this guide on demand.

Alongside guidance and skills, this repository owns a portable, provider-neutral
workflow foundation. It owns the **process**; each project keeps owning its
product behavior, architecture, engineering rules, and required verification.

## Activation

Installation makes the workflow available, not universally active. The complete
flow activates only when the user selects Delivery Lead or Product Partner,
explicitly requests the complete workflow, continues an active Implementation
Plan, or a project requires it for a named class of work. Selecting the
Verifier activates only independent verification for the supplied change; it
does not retroactively create a missing plan or authorization. Ordinary work
creates no workflow artifacts by default.

For this repository, the Product-delivery hook in `AGENTS.md` names the
activating contracts, and its Verification section sets the review for work
outside the full flow; inside it, `WORKFLOW.md` governs. PR size limits and
their exceptions belong to `docs/engineering/git-workflow.md`. Existing
project-owned starters are never synchronized when these defaults change.

## The three roles

| Role | Owns | Claude agent | Codex agent |
| :--- | :--- | :--- | :--- |
| Delivery Lead | Default entry: clarification, investigation, the plan, implementation, self-verification | `mb-delivery-lead` | `mb_delivery_lead` |
| Product Partner | Optional broad discovery and product-alignment review | `mb-product-partner` | `mb_product_partner` |
| Verifier | Fresh independent evidence | `mb-verifier` | `mb_verifier` |

## The standard flow

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

The plan separates its **authorized scope**, which only the user settles, from
its evolving **execution record**; routine progress never needs re-approval,
and a material change waits for the user's decision. The installed
`WORKFLOW.md` is the full contract, including review and waivers.

## Installed paths

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
Its Codex adapter inherits the parent sandbox: a custom agent file cannot
override it, and a read-only sandbox would block test suites that write
disposable files.

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

## Launching a role

### Codex desktop (primary workspace)

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

### Claude Code and Codex CLI

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
startup guide chain; use the runtime checks in
`docs/guidance-loading-smoke.md`.

## Updating a workflow

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

## Adding project-specific requirements

A project may name work that activates the workflow and add material-change
triggers, required checks, or specialist review without copying the workflow
into the repository. The starter project template contains only this conditional
hook. Once active, a project may strengthen but not weaken user authorization of
scope, material-change escalation, independent review, or honest verification.
