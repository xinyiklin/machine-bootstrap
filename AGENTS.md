# Machine Bootstrap Repository Guide

Applies only to this repository. It owns machine-level initialization, shared
skill and workflow manifests, generated provider adapters, setup safety, and the
canonical starter files seeded once into sibling project repositories.

Before changing files, read `CONTINUITY.md`, then the owning source or contract.
Read `../MACHINE.md` deliberately only when workspace administration,
discovery, port allocation, or sibling-project routing requires machine-local
facts. It is not an agent-policy source.

## Ownership map

- `README.md` and `INIT.md` — purpose, setup contract, and operator workflow.
- `machine-templates/` — inert machine registry starter.
- `project-templates/` — the only canonical project starter source; seeded
  files become project-owned and are not synchronized afterward.
- `docs/engineering/git-workflow.md` — this repository's Git/publication
  contract.
- `skills.json` and `scripts/lib/skill-*` — reviewed skill acquisition and
  content-integrity contract.
- `workflows/` and `scripts/lib/workflow-*` — provider-neutral workflow source
  and deterministic adapter generation.
- `scripts/init-workspace.mjs` — machine registry plus shared capabilities.
- `scripts/init-project.mjs` — explicit missing-only seeding for one target.
- `scripts/test-bootstrap.mjs` — isolated regression suite for all owned layers.
- `CONTINUITY.md` — bounded current state; `docs/continuity/` is history read
  only when the task needs it.

## Hard invariants

- The checkout's direct parent is the intended non-Git workspace root.
  Initialization rejects a filesystem root, user home, or Git-owned parent.
- The workspace root never owns live `AGENTS.md`, `CLAUDE.md`, or `_templates/`.
  Legacy entries stop initialization for explicit manual review and cleanup;
  automatic migration is not supported.
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
  project, but it must not become that project's long-lived coding session.
  Start a new session in the target project root or relevant scoped directory.
- Sandbox authorization to access the parent registry or a sibling target does
  not load that sibling's instructions into this session.

## Product-delivery hook

The installed `~/.agents/workflows/product-delivery/` contract applies to this
repository, not only to the projects it seeds. In addition to its explicit
role, user-request, and active-artifact triggers, its complete flow activates
when a change alters any of these contracts:

- installation ownership, target boundaries, overwrite or recovery behavior;
- skill acquisition sources, reviewed revisions/hashes, or integrity validation;
- provider adapter fields, discovery locations, or generated instruction meaning;
- workflow activation, approval, delegation, or required review policy;
- the hard invariants above, or guidance propagated into sibling projects.

Check the resulting behavior and contract diff in `workflows/`, templates,
manifests, scripts, and owning guidance. A path match alone does not activate
the flow. Typo/link corrections, reflow, tests of unchanged behavior, and
internal refactors preserving these contracts are maintenance. Record the
classification and evidence; any listed contract change activates the full
flow even if most of the diff is maintenance. Continuity-only updates remain
outside it unless they continue an active workflow artifact.

Independent review means a fresh reviewer that did not make the change: the
installed Verifier role unless the user names another. When a listed condition
matches and the workflow or its review is not run, say so and record it; an
unrecorded skip is a process failure, not a judgment call.

## Working method

- Keep changes scoped to the requested behavior and its necessary cleanup.
- Treat current official documentation as authoritative for changing Claude or
  Codex loading, configuration, or adapter formats.
- Update templates, scripts, tests, README/INIT, and continuity together when
  their shared contract changes.
- Read `docs/engineering/git-workflow.md` before any branch, commit, push, PR,
  merge, release, deployment, or cleanup action.
- Use disposable workspace, project, and home directories for setup tests.
  Never point a test at the real workspace or provider configuration roots.
- Preserve user-authored dirty work. Do not stage, commit, push, switch branches,
  open or merge pull requests, or publish unless the user asks.

## Verification

Run from this repository root:

```bash
node scripts/test-bootstrap.mjs
node scripts/init-workspace.mjs --check
```

The full regression suite is the primary gate. Guidance changes also require
path, import, byte-budget, and internal-consistency checks. Line targets are
readability warnings, not CI gates. Report skipped host-capability checks and
unverified external behavior explicitly.

Every implementation, including maintenance outside the full workflow, needs
implementer verification and one fresh independent review before local
completion. Delegate it to the installed Verifier (`mb_verifier` in Codex,
`mb-verifier` in Claude), unless the user names another reviewer. Only the user
may waive review for a specific change; record the waiver without calling it
passed. This requirement does not activate the full workflow by itself.
