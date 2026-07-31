# Parent Workspace — Claude Code Overlay

This portable file sits above child projects. The nearest project's
`CLAUDE.md`, `AGENTS.md`, and owning documentation govern its scope.

Read the `AGENTS.md` beside this file when creating or revising project
guidance, working in an unguided folder, or applying the portable baseline.
Read `MACHINE.md` when local paths, project routing, sibling dependencies,
ports, browser preferences, or machine-specific tools matter.

The installed `product-delivery` roles are ordinary subagents. Run one as the
whole session with `claude --agent mb-product-partner`,
`claude --agent mb-delivery-lead`, or `claude --agent mb-verifier`; the
Verifier is also delegable as a subagent. Their contracts come from
`~/.agents/workflows/product-delivery/`, so edit that source rather than the
generated agent files.

The parent guide is deliberately not imported into every child session because
child projects carry self-contained guidance and duplicated instruction dilutes
both. `MACHINE.md` is also read on demand because its facts vary by computer.

## Tool Use

- Read before editing and prefer targeted patches over full replacement.
- Prefer focused discovery and `rg`; keep command output narrow.
- Run Git from the actual child repository, not an assumed parent root.
- Do not stage, commit, push, deploy, or make remote writes unless requested.
- Never expose secrets, credentials, private documents, provider responses, or
  broad environment output.
- Inspect exact targets before deletion or overwrite and keep recovery possible.

## Visual QA

Browser QA is flag-first and skipped by default. When a change carries concrete
layout, interaction, responsive, or theming risk, explain the risk and let the
user decide unless the project requires rendered verification.

When browser QA is authorized, use the best available browser surface for the
needed session and report platform or rendering gaps honestly.

## Communication

Think privately. Report useful progress, blockers, verification, skipped
checks, residual risks, and final outputs. Keep simple answers simple.
