# Parent Workspace Agent Guide

This is portable guidance for work launched from the non-Git workspace that
contains this file. It routes agents to child repositories and provides a
fallback for folders that have no project guide. Child Git repositories own
their self-contained instructions.

The bootstrap repository maintains this file and the project templates.
`MACHINE.md` beside it owns local paths, project inventory, ports, sibling
links, and machine-specific tool facts. Keep secrets out of every guide.

## Loading boundary

- Codex loads global guidance, then project guidance from the project root (normally the Git root)
  down to the working directory. A
  workspace `AGENTS.md` above a child Git root is not inherited by that
  child project.
- Claude Code walks upward for `CLAUDE.md` and `CLAUDE.local.md`; it does not
  discover `AGENTS.md`. The workspace `CLAUDE.md` intentionally does not import
  this file, so this guide is not injected into child-project Claude sessions.
- A child repository therefore needs its own root `AGENTS.md` and a thin
  `CLAUDE.md` that imports it. Nested guides apply only within their scope.
- Claude's public documentation does not specify whether identical imports are
  de-duplicated. Avoid redundant imports and inspect `/memory` or an
  `InstructionsLoaded` hook when exact loaded context matters.

## Ownership and routing

1. The bootstrap repository owns portable workspace guidance, templates,
   shared skills, and the product-delivery workflow.
2. The workspace root owns routing through `AGENTS.md`, `CLAUDE.md`,
   `MACHINE.md`, and `_templates/`.
3. Each child repository owns its product, architecture, commands, safety
   invariants, verification, and continuity.

The user's current request leads, followed by safety and truthful claims, the
nearest scoped project guidance, owning project documentation, and then this
fallback. `MACHINE.md` supplies local facts only. Existing architecture and
conventions apply when higher-priority guidance is silent.

Use the nearest repository guide for project work. Consult `MACHINE.md` only
when routing, ports, sibling dependencies, or machine capabilities matter.
Read archived continuity only when a task needs history.

## Guidance convention

- `AGENTS.md`: provider-agnostic project guidance.
- `CLAUDE.md`: thin Claude-specific overlay and explicit local import.
- `MACHINE.md`: local, non-secret workspace facts.
- `CONTINUITY.md`: bounded current durable state.
- `docs/continuity/YYYY-MM.md`: rotated history, read on demand.
- `docs/engineering/git-workflow.md`: project Git and publication contract.

Keep project root guides as routers. Product purpose belongs in `PRODUCT.md`,
visual contracts in `DESIGN.md`, and detailed engineering policy in `docs/` or
scoped nested guides. Do not duplicate an owning document.

Codex defaults to a 32 KiB combined budget for the active `AGENTS.md` chain.
Keep the cumulative root-to-working-directory chain below 28 KiB so the nearest
scoped guide is not truncated. Move inventories, examples, and verification
matrices to owning docs that agents read on demand; line counts alone do not
protect this byte budget.

## Creating or repairing a project guide

1. Read the real manifests, configs, entry points, and existing directories.
2. Copy `_templates/AGENTS.md` and `_templates/CLAUDE.md` to the project root.
   For a new repository, also copy `_templates/.gitignore`; for an existing
   repository, merge only the missing safety entries.
3. Replace every placeholder with verified facts and remove irrelevant text.
4. Record project identity, guidance ownership, hard invariants, layout,
   commands, verification, continuity, and Git conventions.
5. Measure the largest likely active guide chain and keep it below 28 KiB.
6. Consult `MACHINE.md` before claiming ports or workspace links.
7. Keep provider-specific tooling in `CLAUDE.md`.

Never copy another project's architecture, commands, tokens, or privacy rules.
A project must remain understandable when cloned outside this workspace.

The shared workflow lives at `~/.agents/workflows/product-delivery/`. Read its
`WORKFLOW.md` only when product discovery, delivery planning, execution gates,
or independent verification applies; do not reproduce that contract here.

## Continuity convention

Keep one bounded `CONTINUITY.md` per active project. It contains only the
current snapshot, active decisions, working set, next actions, and open
questions. Rotate resolved or superseded entries to
`docs/continuity/YYYY-MM.md`, leaving a dated milestone link when useful.

Cap the total current ledger, counting every section; about 160 lines is a
practical default. Keep decisions as compact indexes and put detailed rationale
in the owning document or a focused decision record. Do not store transcripts
or raw logs, and never inject the archive wholesale at task start.

## Fallback for unguided folders

This section applies only when no child project guide exists.

- Read before editing, keep scope literal, and make the smallest maintainable
  change that fully satisfies the request.
- Match existing patterns and diagnose causes before patching symptoms. Ask
  before changing dependencies, public schemas, authentication, deployment,
  paid services, or production infrastructure.
- Before adding or upgrading a dependency, inspect the runtime, manifest,
  lockfile, compatibility constraints, and version policy. Verify the current stable or maintainer-recommended release
  from an official registry, documentation, or release notes; never select a dependency version from model memory alone.
- Prefer the latest compatible stable release. Preserve the project's package
  manager and version-range policy, update its lockfile when the project tracks
  one, and explain any deliberate use of an older or prerelease version.
- Never expose secrets, credentials, personal documents, provider responses,
  broad environments, or generated private artifacts.
- Resolve exact targets before deletion or overwrite and keep recovery
  possible. Remote writes, Git publication, deployment, destructive migration,
  history rewrite, paid actions, and host installation require explicit user
  authority.
- Run Git from the actual repository root and preserve unrelated work.
- Verify with fresh evidence proportional to risk. If no harness exists, run
  the strongest lightweight check and state the gap.
- Report blockers, changed files, verification, skipped checks, and residual
  risk honestly. Keep simple answers simple.
