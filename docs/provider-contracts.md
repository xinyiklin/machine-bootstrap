# Provider Contracts

The one owner of the Claude Code and Codex facts this repository's guidance,
starters, and scripts depend on. Other files link here instead of restating
provider versions or loading rules. Read it on demand.

`providers.json` records when the sources below were last checked and which
provider versions last passed `scripts/smoke-providers.mjs`.
`node scripts/init-workspace.mjs --check` prints that baseline beside the
installed versions, and advises when a provider is newer than the smoke-tested
version or the documentation check is more than 30 days old. The advisory never
fails setup. To recheck, compare the sources with the claims below, update this
file and `providers.json` together, and run the `guidance-audit` skill; the
live smoke check makes model calls, so it runs only with the user's approval.

## Instruction loading

- **Codex** builds its chain once per run: from the detected project root
  (normally the Git root) down to the launch directory, at most one of
  `AGENTS.override.md`, `AGENTS.md`, or a configured fallback name per
  directory, until the combined size reaches `project_doc_max_bytes` (32 KiB by
  default). With no detected root it reads only the launch directory. A parent
  workspace guide is never inherited, and the chain is not rebuilt after the
  session moves elsewhere.
- **Claude Code** loads `CLAUDE.md` and `CLAUDE.local.md` from the launch
  directory and every directory above it, and those in subdirectories when it
  works there. Block-level HTML comments are stripped before loading. `@path`
  imports expand at launch, up to four hops, and cost the same context as
  inline text.
- **Claude reading `AGENTS.md` natively** (2.1.277 and later) happens only
  while no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists in the
  launch directory or above it. The **Project instructions** setting
  `claude-md-and-agents-md` reads both and lazily loads nested `AGENTS.md`.
  `InstructionsLoaded` hooks do not fire for a natively read `AGENTS.md`, and
  some sessions cannot read it at all.

## Why starters keep `CLAUDE.md`

Starters keep a thin `CLAUDE.md` with one `@AGENTS.md` import (D027). The
import loads the shared guide in every Claude version and session, survives a
personal `CLAUDE.local.md` that would otherwise switch native reading off, and
keeps `InstructionsLoaded` evidence. It never makes Claude read `AGENTS.md`
twice. All shared policy stays in `AGENTS.md`; `CLAUDE.md` holds only
Claude-specific mechanics, because Codex never reads it.

## Skills, agents, and diagnostics

- Codex discovers user skills in `~/.agents/skills/`; Claude sees them through
  links under `$CLAUDE_CONFIG_DIR/skills/` or `~/.claude/skills/`.
- Claude subagents support `disallowedTools`; an omitted `model` uses the main
  session's model, which is why generated adapters pin none.
- In Claude, `/context` lists loaded instruction files, `/memory` lists the
  locations Claude checks, and `/doctor prompt-audit` (2.1.283 and later) finds
  stale or conflicting instructions. Codex sessions show loading through an
  instruction summary or the session log.
- Claude Code desktop worktree sessions load `CLAUDE.md` and `.claude/rules/`
  from the worktree under `.claude/worktrees/`, so a worktree's parent is
  not its workspace; the setup scripts resolve the main checkout instead.

## Sources

- [Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
  [skills](https://learn.chatgpt.com/docs/build-skills),
  [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), and
  [configuration](https://learn.chatgpt.com/docs/config-file/config-basic).
- Claude [memory and `AGENTS.md`](https://code.claude.com/docs/en/memory),
  [subagents](https://code.claude.com/docs/en/sub-agents),
  [permissions](https://code.claude.com/docs/en/permissions),
  [worktrees](https://code.claude.com/docs/en/worktrees), and
  [configuration directories](https://code.claude.com/docs/en/claude-directory).
- Guidance length follows
  [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988): unnecessary
  requirements lowered agent success and raised cost.

These sources establish supported contracts, not successful loading on every
installed version; `docs/guidance-loading-smoke.md` holds the runtime checks.
