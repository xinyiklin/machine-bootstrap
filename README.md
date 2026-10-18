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

`AGENTS.md` carries the ownership map; this README adds only the operator
view. `project-templates/TEMPLATE-USAGE.md` documents the
starter set but is never copied into a project or renamed as its README. Once
starter files are copied, they are project-owned and are not synchronized
against machine-bootstrap.

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

`INIT.md` holds the step-by-step contract: clone as a direct child of the
dedicated non-Git workspace folder, run `node scripts/init-workspace.mjs`,
fill `MACHINE.md`, verify with `--check`, seed one project with
`node scripts/init-project.mjs ../project-a`, then fill its placeholders in a
new session there. It also lists the root and ancestor instruction files that
stop setup for manual review, the `.gitignore` environment policy, and the
read-only `node scripts/audit-workspace.mjs` report.

To initialize only one project through an agent, specify its exact path:
**“Initialize `../project-a` using machine-bootstrap. Preserve existing files,
stop for review-required conditions, verify the result, and do not commit or
publish anything.”**

After the first setup, the installed first-party skills below cover these
requests in ordinary language from any session.

### Recommended Claude permissions

Bootstrap installers never edit Claude's user `settings.json`; seeded projects
get only a project `.claude/settings.json` with the `.env` read-deny rules. Add
these rules to the user settings yourself (or ask an agent to, preserving
existing keys):

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

### Provider facts

`docs/provider-contracts.md` owns the Claude Code and Codex loading rules this
setup depends on, including why starters keep a thin `CLAUDE.md` that imports
`AGENTS.md`, and the official sources. `providers.json` records when they were
last checked and which provider versions last passed the live smoke check;
`--check` advises when installed providers move past them.

## Product delivery workflow

This repository also owns a portable, provider-neutral delivery workflow: a
Delivery Lead (`mb-delivery-lead` / `mb_delivery_lead`) that owns one living
Implementation Plan, an optional Product Partner, and a fresh independent
Verifier (`mb-verifier` / `mb_verifier`). Installing it only makes the roles
available. Activation, launch prompts, installed paths, upgrades, and project
additions are in `docs/product-delivery.md`; the contract is
`workflows/product-delivery/WORKFLOW.md`.

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

First-party skills live in `skills/<name>/` and appear in `skills.json` with a
`localPath` instead of a Git source, under the same `contentSha256` pin. Edit
the skill, then update its hash in the same change; the regression suite
reports the new value, and review happens in the pull request. The installer
copies it from this checkout without running anything. An installed copy that
no longer matches fails verification like any reviewed skill: move it out of
the shared root, then rerun installation.

First-party skills put an agent procedure in front of the audited scripts. Only
the scripts install shared capabilities or seed starters; project-owned files
change only through reviewed edits in a session in that project. Every skill
names the scripts it runs. Agents pick a skill from its description; users can
also run one by name (`/<name>` in Claude Code, `$<name>` in Codex).

| Skill | Use it to | Scripts it drives |
| :--- | :--- | :--- |
| `workspace-setup` | Check or update this machine after pulling machine-bootstrap changes | `init-workspace`, `install-skills`, `install-workflows` |
| `project-init` | Seed a project and fill its placeholders from the real repository | `init-project`, `audit-workspace` |
| `project-sync` | Adopt starter updates in an existing project, change by change | `starter-diff`, `init-project`, `audit-workspace` |
| `guidance-audit` | Trim and recalibrate a repository's agent guidance | `audit-workspace` |
| `guidance-capture` | Add one earned rule after a repeated mistake or review finding, in the place that holds it best | `audit-workspace` |
| `continuity` | Update and compact `CONTINUITY.md`, near its cap or on request | none |

`INIT.md` stays the first-run entry point, because no skill exists before the
first installation.

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

From a linked worktree, such as a Claude Code worktree session, `--check`,
`audit-workspace.mjs`, and `starter-diff.mjs` resolve the main checkout's
workspace; setup and project seeding refuse there and name the main checkout.

The regression suite uses disposable workspaces, projects, Git repositories, and
home directories. It covers parent boundary checks, registry initialization,
manual-only legacy detection, explicit project target safety, missing-only
seeding, existing guidance preservation, order-aware `.gitignore` handling,
ownership-safe rollback, sibling byte isolation, import topology, byte budgets,
skill integrity, workflow validation, deterministic adapter generation,
check-only behavior, and Linux/Windows/macOS CI contracts. It makes no model or
API calls and never points setup scripts at the live parent workspace or
provider roots.

`node scripts/pr-size.mjs <base>` counts a branch the way the Git contract
does, and the PR size check in CI enforces its 1,000-line gate unless the PR
body records the reviewer's `size-exception: <head SHA>` for the current head.
To run the suite before every push from
this checkout and reject agent attribution lines in commit messages, opt in
once with `git config core.hooksPath scripts/hooks`; that setting replaces the
checkout's `.git/hooks` directory.

Static tests are not runtime loading evidence. `node scripts/smoke-providers.mjs`
is an opt-in check that runs the real Claude Code and Codex CLIs against a
disposable fixture and costs a few model calls; the remaining manual checks live
in `docs/guidance-loading-smoke.md`.
