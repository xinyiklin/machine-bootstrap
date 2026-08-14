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

Keep this file to what is genuinely Claude-only: tool surfaces and harness
mechanics. Policy that applies to any agent belongs in `AGENTS.md`, which is
already in context. Avoid importing the same file redundantly from multiple
`CLAUDE.md` layers; inspect `/memory` or an `InstructionsLoaded` hook when exact
loaded context matters.

@AGENTS.md

## Tool Use

- Read before editing; use targeted edits for existing files.
- Prefer focused search tools and keep command output narrow.
- Run project commands from the documented repository or workspace root.
- Never dump broad environments, secrets, private data, or generated logs.

<!-- TODO: project-specific tool notes — e.g. where to run commands (monorepo
workspace root, backend virtualenv), a shell or package-manager fact that
differs from the default, or data that must never be pasted into chat. -->

## Browser and visual QA

The authorization policy lives in `AGENTS.md`. Once browser work is authorized,
use the project-documented surface and report session, rendering, or tooling
gaps. <!-- TODO: name the launch config/default surface, or delete for non-UI. -->

## Path-Scoped Rules

Put Claude-only instructions for part of the codebase in
`.claude/rules/*.md` with `paths:` frontmatter so they load only for matching
files instead of every session.

<!-- TODO: list this project's rule files, or delete this section. -->
