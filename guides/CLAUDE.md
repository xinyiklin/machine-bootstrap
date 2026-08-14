# Parent Workspace - Claude Code Overlay

This file loads in every Claude Code session beneath this workspace. Keep it
limited to universal routing that child projects do not own. The nearest
project guidance and owning documentation govern project work.

Do not import the sibling `AGENTS.md` here. It is the Codex workspace-root
router and unguided-folder fallback; child repositories carry self-contained
guidance. A child project's `CLAUDE.md` should import that project's own
`AGENTS.md` exactly once.

- Read `MACHINE.md` only when local paths, sibling projects, ports, or machine
  capabilities matter.
- Read the current project's `CONTINUITY.md` fresh before acting; read its
  archive only when history is relevant.
- Inspect `/memory` or use an `InstructionsLoaded` hook when exact Claude
  instruction loading matters.
- Product-delivery role contracts live in
  `~/.agents/workflows/product-delivery/`; load them only for that workflow.
- In an unguided folder, read before editing, preserve unrelated work, protect
  secrets and personal data, inspect destructive targets, and require explicit
  authority for remote writes, Git publication, or deployment.
- Report verification, skipped checks, blockers, and residual risk honestly.
