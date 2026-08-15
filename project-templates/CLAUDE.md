# <Project> - Claude Code Adapter

@AGENTS.md

> Template: copy beside `AGENTS.md`, replace `<Project>` and the TODO below,
> then delete this note. Keep the import exactly once.

`AGENTS.md` is the canonical shared policy. This adapter adds only Claude-specific
mechanics and must not duplicate or contradict it. Resolve conflicts in the
files or ask for direction; do not rely on load order.

## Claude-specific mechanics

- TODO: name only real Claude-specific launch, browser, MCP, or harness facts;
  delete this section when there are none.
- Use `/context` for live context composition and an `InstructionsLoaded` hook
  when exact file-level loading evidence is required.
- Put path-scoped Claude-only mechanics in `.claude/rules/*.md`. For shared
  subtree policy, use nested `AGENTS.md` and optionally pair it with a nested
  `CLAUDE.md` containing only `@AGENTS.md`.
