# Parent Workspace - Claude Code Adapter

This ancestor file loads in Claude Code sessions beneath the workspace. Keep it
to routing that child projects do not own, and never contradict tracked project
instructions.

Do not import the sibling `AGENTS.md`; it applies only to Codex started at the
workspace root. A child project's `CLAUDE.md` imports that project's own
`AGENTS.md` once.

- Read `MACHINE.md` only when local routing or machine capabilities matter.
- Use `/context` for live context composition and an `InstructionsLoaded` hook
  when exact file-level loading evidence is required.
- In an unguided folder, protect secrets and unrelated work and require explicit
  authority for destructive or remote actions.
