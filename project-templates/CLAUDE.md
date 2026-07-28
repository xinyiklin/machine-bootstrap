# <Project> — Claude Overrides

> Template — copy into a project root as `CLAUDE.md` alongside `AGENTS.md`,
> replace `<Project>` in the title, fill the project-specific tool notes, and
> delete this note. Keep the `@AGENTS.md` import line — it hard-loads the
> canonical guide into context every session. If the project has no
> `CONTINUITY.md` (e.g. a small local tool), reword the CONTINUITY clause below
> to say so.

`AGENTS.md` is the canonical guide. It is imported below, so its rules load
into context every session — no separate read step. `CONTINUITY.md` is **not**
imported (it changes constantly); read it fresh before acting. This file adds
Claude-specific behavior; when it conflicts with `AGENTS.md`, this file wins.

@AGENTS.md

## Tool Use

- `Read` before `Edit`/`Write`. Never `Write` without reading first.
- Prefer `Edit` for targeted changes; use `Write` only for new files or
  intentional full-file replacements.
- Prefer `Glob`/`Grep` for codebase searches; otherwise use `rg`.
- Use `Bash` for project commands, tests, builds, and git. Do not use shell write
  tricks to overwrite files when `Edit`/`Write` is safer.
- Keep command output focused. Do not dump broad environments, secrets, or large
  generated logs into chat.

<!-- TODO: project-specific tool notes — e.g. where to run commands (monorepo
workspace root, backend virtualenv), or which MCP/browser tools to use for QA. -->

## Visual QA

**Flag-first, skip by default** (`AGENTS.md`). Do not run browser QA
unsolicited; when a change carries real layout, responsive, or theming risk,
name the risk and let the user decide.

When you do run it:

- **Default: the in-app browser pane** (`mcp__Claude_Browser__*`).
  `preview_start` by launch-config name from `.claude/launch.json` rather than
  a hand-typed port. `read_page` / `get_page_text` for structure and copy,
  `javascript_tool` for computed styles, `read_console_messages` for errors,
  `computer` for screenshots and interaction, `resize_window` for widths.
- **Claude in Chrome** (`mcp__claude-in-chrome__*`) when the check needs the
  real profile's logged-in session or a real window. If a bridge isn't
  connected, use the other and note the gap.
- The pane is paint-gated: `IntersectionObserver`, `ResizeObserver`, rAF, and
  transitions do not fire while it is occluded. Force frames with a real scroll
  or screenshot gesture, or force the end state and inspect the wiring.

<!-- TODO: this project's launch-config name and default surface, or — for a
project that never gets browser QA — say so here and state what replaces it. -->

## Communication

Think privately; do not print raw reasoning. Report actions, blockers,
verification, skipped checks, and final outputs, and skip preambles unless they
help the user act. After material work, open with a brief ledger snapshot
(Goal, Now, Next, Open Questions).
