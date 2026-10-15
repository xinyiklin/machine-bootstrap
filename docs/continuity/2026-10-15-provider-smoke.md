# Provider smoke baseline refresh

Date: 2026-10-15. Scope: the live provider loading smoke run and a delta check
of the provider documentation, after Claude Code moved from 2.1.285 to 2.1.300
and Codex from 0.159.2 to 0.162.1 on the operator's machine. This receipt holds
portable facts only.

## Authorization and classification

The user started the proposed task and, asked in chat, approved running
`node scripts/smoke-providers.mjs` for both providers (it makes model calls).
Classification: ordinary change with the normal review. Only the reviewed
baseline in `providers.json`, one provider-facts sentence, and continuity
change; no activating contract changed.

## Smoke run

Command: `node scripts/smoke-providers.mjs`, run from the repository root on
Windows, with the npm-installed Codex found through the lookup PR #23 added.
Fixture: the script's disposable workspace under the temp directory, deleted
after the run.

```text
Provider smoke check (2026-10-15)
- claude: 2.1.300 (Claude Code)
- codex: codex-cli 0.162.1
passed     claude project-a: adapter imports AGENTS.md — as expected
passed     claude project-b: native AGENTS.md without an adapter — as expected
passed     claude project-c: CLAUDE.local.md turns native reading off — as expected
passed     claude scratch: no project guidance — as expected
passed     codex project-a: project AGENTS.md — as expected
passed     codex project-c: CLAUDE.local.md is Claude-only — as expected
passed     codex scratch: no project guidance — as expected
```

All seven scenarios passed, including discovery of the installed shared skills
and the `mb-*` / `mb_*` roles. `providers.json` now records these versions
under `smokeTested`. The manual scenarios in `docs/guidance-loading-smoke.md`
(workspace-root start, nested guides and overrides, custom configuration
roots, desktop apps) were not run and stay unverified for these versions.

## Documentation delta

Checked on 2026-10-15 against the claims in `docs/provider-contracts.md`:
the Claude Code memory page, the Codex `AGENTS.md` page, the Claude Code
changelog for 2.1.286 through 2.1.300, and the visible Codex release notes
(0.162.0 and 0.162.1; 0.160.x and 0.161.x were not visible on the releases
page). The skills, subagents, and configuration pages were not rechecked, so
`documentationChecked` stays 2026-10-14.

- One refinement: the memory page now bounds the sessions that could not read
  `AGENTS.md` natively (for example on Amazon Bedrock or with telemetry
  disabled) to versions before 2.1.281. The contract said "some sessions
  cannot read it at all"; it now states the version bound. The page's other
  unavailable cases (the built-in plugin disabled, sometimes the first session
  after upgrading from 2.1.276 or earlier) stay unmentioned, as before. The
  starter rationale (D027) is unchanged: the `@AGENTS.md` import still covers
  older versions, a personal `CLAUDE.local.md`, and `InstructionsLoaded`
  evidence.
- No change to: native reading from 2.1.277, the `CLAUDE.md` /
  `CLAUDE.local.md` condition, the `claude-md-and-agents-md` setting, hooks
  not firing for a natively read `AGENTS.md`, four import hops, stripped HTML
  comments, the files Claude never reads, the Codex chain built once per run
  from the project root, override precedence, the 32 KiB default, and the
  Codex home `AGENTS.override.md` / `AGENTS.md`.
- Changelog entries in range touch worktree, subagent, and skill mechanics
  (for example 2.1.296 preloads at most 32 skills from a subagent's `skills`
  field and adds `CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL` for workflow agents)
  but none changes the loading or adapter facts this repository relies on.
  The generated adapters still pin no model.
