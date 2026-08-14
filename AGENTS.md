# Machine Bootstrap Repository Guide

Applies to this repository. It owns portable workspace initialization, shared
skill and workflow manifests, generated provider adapters, setup safety, and the
project-guide templates installed into child repositories.

Before changing files, read `CONTINUITY.md`, then the owning source or contract.
The files under `guides/` and `project-templates/` are portable outputs and
templates, not this repository's automatically discovered root instructions.

## Ownership map

- `README.md` and `INIT.md` — purpose, setup contract, and operator workflow.
- `guides/` — portable workspace guidance installed beside child repositories.
- `project-templates/` — self-contained starter guidance copied into projects.
- `skills.json` and `scripts/lib/skill-*` — reviewed skill acquisition and
  content-integrity contract.
- `workflows/` and `scripts/lib/workflow-*` — provider-neutral workflow source
  and deterministic adapter generation.
- `scripts/init-workspace.mjs` — the single initialization entry point.
- `scripts/test-bootstrap.mjs` — isolated regression suite for all owned layers.
- `CONTINUITY.md` — bounded current state; `docs/continuity/` is history read
  only when the task needs it.

## Hard invariants

- The checkout's direct parent is the intended workspace root. Initialization
  must reject a filesystem root, user home, or Git-owned parent before writes.
- Installation is missing-only by default. Differing destinations fail closed;
  reviewed `--replace` operations preserve recoverable backups.
- Validate manifests, sources, and every destination before partial writes.
- Never execute upstream package installers or lifecycle scripts while
  acquiring shared skills.
- Generated Claude and Codex adapters derive from the provider-neutral role
  contracts and must not drift or pin a model.
- Never read, write, print, or commit credentials, private documents, broad
  environment output, provider responses, or machine-local workspace data.
- Preserve unrelated files and configuration under `~/.agents`, `~/.claude`,
  and `~/.codex`; installers own only their documented namespaced paths.

## Working method

- Keep changes scoped to the requested behavior and its necessary cleanup.
- Treat current official documentation as authoritative for changing Claude or
  Codex loading, configuration, or adapter formats.
- Update portable sources, templates, tests, README/INIT, and continuity together
  when their shared contract changes.
- Use disposable workspace and home directories for setup tests. Never point a
  test at the real workspace or provider configuration roots.
- Preserve user-authored dirty work. Do not stage, commit, push, switch branches,
  open or merge pull requests, or publish unless the user asks.

## Verification

Run from this repository root:

```bash
node scripts/test-bootstrap.mjs
node scripts/init-workspace.mjs --check
```

The full regression suite is the primary gate. Documentation-only loading or
guidance changes also require path, import, line-budget, and internal-consistency
checks. Report skipped host-capability checks and any unverified external
behavior explicitly.
