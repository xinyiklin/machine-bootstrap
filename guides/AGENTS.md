# Parent Workspace Agent Guide

Applies only to Codex sessions started at this non-Git workspace root. It is a
router for the project collection and a fallback for work performed directly
from this directory; it is not inherited by arbitrary descendants.

`MACHINE.md` beside it owns local paths, project inventory, ports, sibling
links, and machine capabilities. The bootstrap repository owns this portable
file and `_templates/`. Each child repository owns its own instructions.

## Loading and launch boundary

- Codex builds its instruction chain once per run. From a project root
  (normally a Git root), it loads guidance down to the starting directory.
- Start or restart Codex at the target child repository root. Start it at a
  relevant scoped directory when nested `AGENTS.md` files must load
  automatically.
- A workspace session does not rebuild its instruction chain after navigating
  into a child project. Stop and restart at that project before project work.
- With no detected project root, Codex checks only the starting directory. For
  an unguided non-Git descendant, either launch at this workspace root and
  explicitly route the one-off work, or place a local `AGENTS.md` there and
  start Codex from that directory.
- Claude Code discovers ancestor `CLAUDE.md` files, not `AGENTS.md`. The
  workspace `CLAUDE.md` intentionally does not import this file. A child
  project imports its own `AGENTS.md` through its own `CLAUDE.md`.
- Use provider runtime evidence for loading claims: Codex session logs or an
  instruction-summary smoke check; Claude `/context` for live composition and
  an `InstructionsLoaded` hook for exact file events.

## Routing

1. Find the target in `MACHINE.md` when local routing matters.
2. Start or restart in the target repository or scoped directory.
3. Read that repository's root guide and the nearest scoped guide before work.
4. Keep machine-only facts in `MACHINE.md`; never copy them into project files.

Child repositories must remain self-contained when cloned elsewhere. Product
purpose belongs in `PRODUCT.md`, visual contracts in `DESIGN.md`, detailed
engineering policy in `docs/`, and subtree differences in nested guides.

## Creating or repairing project guidance

1. Read `_templates/TEMPLATE-USAGE.md`; do not copy that usage file as the
   project's README.
2. Copy the named starter files, then replace every placeholder with facts
   verified from the real manifests, configs, entry points, and directories.
3. Remove irrelevant sections. Do not copy another project's architecture,
   commands, tokens, or privacy rules.
4. Measure the largest active root-to-scoped guide chain; keep it below the
   template's cumulative byte target.
5. Start a new provider session in the project and perform the documented
   loading smoke check.

## Workspace-root fallback

System/platform safety, data integrity, secret protection, and explicit
authorization boundaries constrain every request. Within those boundaries:

- Keep scope literal, preserve unrelated work, and use the smallest
  maintainable change that fully satisfies the request.
- Verify current dependency choices from official sources; preserve the
  project's package manager, compatibility policy, and tracked lockfile.
- Resolve exact destructive targets and keep recovery possible. Remote writes,
  publication, deployment, paid actions, and host installation require explicit
  user authority.
- Run Git from the actual repository root and report checks, skips, blockers,
  and residual risk honestly.
