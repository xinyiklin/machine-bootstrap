# <Project> - Claude Code Adapter

@AGENTS.md

> Template: copy beside `AGENTS.md`, replace `<Project>` and the TODO below,
> then delete this note. Keep the import exactly once.

`AGENTS.md` is the canonical shared policy. This adapter adds only Claude-specific
mechanics and must not duplicate or contradict it. Follow applicable instruction
precedence, including higher-priority harness and session requirements. Explain
any resulting project-process limitation and continue authorized independent
work. Ask only for unresolved user decisions or new scope; an already resolved
precedence conflict does not require another approval. Do not silently skip a
required project process for convenience.

## Claude-specific mechanics

- TODO: name only real Claude-specific launch, browser, MCP, or harness facts;
  delete this section when there are none.
- Use `/context` for live context composition and an `InstructionsLoaded` hook
  when exact file-level loading evidence is required.
- Put path-scoped Claude-only mechanics in `.claude/rules/*.md`. For shared
  subtree policy, use nested `AGENTS.md` and optionally pair it with a nested
  `CLAUDE.md` containing only `@AGENTS.md`.
