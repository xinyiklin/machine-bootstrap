# Machine Bootstrap Repository Guide

Applies only to this repository. It owns machine-level initialization, shared
skill and workflow manifests, generated provider adapters, setup safety, and the
canonical starter files seeded once into sibling project repositories.

Before changing files, read `CONTINUITY.md`, then the owning source or contract.
Read `docs/decisions.md` before changing a rule. Read `../MACHINE.md` only when
workspace administration, discovery, port allocation, or sibling routing needs
machine-local facts; it is not an agent-policy source.

## Ownership map

- `README.md`, `INIT.md` — purpose, setup contract, and operator workflow.
- `machine-templates/` — inert machine registry starter.
- `project-templates/` — the only canonical project starter source; seeded
  files become project-owned and are not synchronized afterward.
- `docs/engineering/git-workflow.md` — this repository's Git/publication
  contract.
- `skills.json`, `skills/`, `scripts/lib/skill-*` — reviewed skill roster,
  first-party skills, and the content-integrity contract.
- `workflows/`, `scripts/lib/workflow-*` — provider-neutral workflow source and
  deterministic adapter generation.
- `scripts/init-workspace.mjs` (machine registry and shared capabilities),
  `init-project.mjs` (missing-only seeding of one target),
  `audit-workspace.mjs` (read-only sibling guidance report),
  `starter-diff.mjs` (read-only starter comparison for one project), and
  `pr-size.mjs` (PR size count that CI enforces).
- `scripts/test-bootstrap.mjs` — isolated regression suite for every layer.
- `CONTINUITY.md` — current state; `docs/decisions.md` — active decisions;
  `docs/continuity/` — history and receipts, read only when needed.

## Hard invariants

- The checkout's direct parent is the intended non-Git workspace root.
  Initialization rejects a filesystem root, user home, or Git-owned parent.
- The workspace root never owns live `AGENTS.md`, `CLAUDE.md`, or `_templates/`.
  Those and the other root and ancestor instruction files listed in README
  setup step 4 stop initialization for manual review; automatic migration is
  not supported.
- Project initialization targets exactly one path inside the workspace, never
  this repository or an arbitrary subdirectory of an existing Git repository.
  Existing project-owned files are preserved. `.gitignore` updates keep the
  environment policy ordered and fail closed on ambiguous existing rules.
- Bootstrap-owned global installations are missing-only by default. Differing
  destinations fail closed; reviewed workflow `--replace` operations preserve
  recoverable backups.
- Validate manifests, sources, and every destination before partial writes.
- Never execute upstream package installers or lifecycle scripts while
  acquiring shared skills.
- Generated Claude and Codex adapters derive from provider-neutral role
  contracts and must not drift or pin a model.
- Never read, write, print, or commit credentials, private documents, broad
  environment output, provider responses, or machine-local workspace data.
- Preserve unrelated files and configuration under `~/.agents`, `~/.claude`,
  and `~/.codex`; installers own only their documented namespaced paths.
- A bootstrap session may initialize, audit, repair, install, or route a sibling
  project but never becomes its long-lived coding session; start a new session
  in the target project. Sandbox access to the parent or a sibling does not load
  that sibling's instructions.

## Product-delivery hook

The installed `~/.agents/workflows/product-delivery/` contract applies to this
repository. Besides its own triggers, its complete flow activates when a change
alters any of these contracts:

- installation ownership, target boundaries, overwrite or recovery behavior;
- skill acquisition sources, pinned hashes, or integrity validation;
- generated adapter fields or provider discovery locations;
- workflow activation, authorization, delegation, review, or artifact policy;
- starter safety, authorization, or review rules that seeded projects inherit;
- the hard invariants above.

Judge the resulting behavior, not which paths changed. Wording changes to role
contracts, skills, and starter guidance that keep these contracts, and new
first-party skills on the existing acquisition path, are ordinary changes with
the normal review. Record the classification with its evidence. When a listed
contract changes and the flow or its review is not run, say so and record it
with the reason.

## Working method

- Keep changes scoped to the requested behavior and its necessary cleanup.
- Current official Claude and Codex documentation is the authority for loading,
  configuration, and adapter formats.
- Update templates, scripts, tests, README/INIT, and continuity together when
  their shared contract changes.
- Use disposable workspace, project, and home directories for setup tests;
  never point a test at the real workspace or provider configuration roots.
- Read `docs/engineering/git-workflow.md` before any branch, commit, push, PR,
  merge, release, deployment, or cleanup action. Preserve user-authored dirty
  work; do not stage, commit, push, switch branches, open or merge pull
  requests, or publish unless the user asks.

## Verification

Run from this repository root:

```bash
node scripts/test-bootstrap.mjs
node scripts/init-workspace.mjs --check
```

The suite is the primary gate. For guidance changes, also check paths, imports,
and cross-file consistency. When a change depends on provider loading, ask
before running the opt-in `node scripts/smoke-providers.mjs`, which makes model
calls. Report skipped host-capability checks and unverified provider behavior
explicitly.

After your own verification and before local completion, every change gets one
fresh independent review by a reviewer that did not make it: the installed
Verifier (`mb-verifier` in Claude, `mb_verifier` in Codex) unless the user
names another. The exception is a change confined to typos, broken links,
formatting, or comments with no change in meaning, behavior, or configuration;
it needs only your own verification, and you state that classification. Only
the user may waive a required review; record the waiver, never a pass.
