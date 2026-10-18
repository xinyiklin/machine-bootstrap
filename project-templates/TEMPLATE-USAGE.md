# Project Guide Template Usage

This file explains the starter set. It is not a project README and must not be
copied or renamed as one.

## Starter paths

- `AGENTS.md`: canonical provider-neutral project guidance.
- `CLAUDE.md`: non-conflicting Claude adapter importing `AGENTS.md` once.
- `.gitignore`: local agent state, environment, and OS exclusions.
- `docs/engineering/git-workflow.md`: project-owned Git/publication contract.
- `.github/pull_request_template.md`: PR scope and verification receipt.
- `.claude/settings.json`: shared Claude permission rules that deny reading
  `.env` and `.env.*` while keeping `.env.example` readable. They cover
  Claude's file tools and recognized shell file commands; Claude's sandbox
  gives OS-level enforcement. The rules anchor at the session's starting
  directory, also block Claude from editing those files, and their
  `.env.example` carve-out cannot reopen a deny from user or managed settings.
  Add rules for any other secret file names.

Keep project guidance self-contained, because the repository may be cloned
outside its current workspace, and never rely on load order to resolve a
contradiction between guides.

`.githooks/commit-msg` is an optional starter and is not seeded. It rejects
agent `Co-authored-by` trailers with an Anthropic or OpenAI noreply address
and "Generated with Claude Code" or "Generated with Codex" lines; human
co-authors pass. A project that wants no agent attribution, whatever a
provider setting adds, copies it to its own `.githooks/commit-msg`, keeps it
executable with LF endings, and on the user's request runs
`git config core.hooksPath .githooks` once per clone. That setting replaces
the clone's `.git/hooks` directory and applies to every linked worktree; a
branch without `.githooks/` then runs no hooks. Where the project already
sets `core.hooksPath` or uses a hook manager, add the check there instead.
The Git contract's explicit squash subject and body keep GitHub's combined
squash message clean either way.

The Git contract defines a 500-line PR target and a 1,000-line review gate;
the PR template records size, exclusions, and any required explanation or
reviewer exception. Keep related code/tests/docs together. Projects may adjust
the defaults in their own contract with rationale; existing seeded projects
are not changed when this starter is updated.

The starter `.gitignore` keeps shared `.claude/` and `.codex/` configuration
trackable. It excludes `CLAUDE.local.md`, `.claude/settings.local.json`, and
`.agent-work/` task artifacts, which are deleted when their task completes.

## Initialize a project

The user may either run the initializer directly or ask an agent: “Initialize
`<target-project>` using machine-bootstrap. Preserve existing files, stop for
review-required conditions, verify the result, and do not commit or publish
anything.” The agent should use the canonical initializer rather than copying
the template paths by hand.

1. From `machine-bootstrap`, run
   `node scripts/init-project.mjs <target-project>`. Add `--create` only when the
   target directory does not exist. The initializer copies only missing starter
   paths and preserves existing project-owned files. With no environment rules,
   it appends the complete ordered `.env`, `.env.*`, `!.env.example` block plus
   missing independent safety rules. Git verifies that the resulting policy
   ignores local environment files while exposing `.env.example`; an
   ineffective, incomplete, or ambiguous existing policy requires manual review
   before any write. Starter paths and their parents must remain real files and
   directories during initialization; symbolic-link or concurrent identity
   changes stop safely for review.
2. Replace every placeholder with facts verified from the real project and
   delete irrelevant sections and template notes.
3. Keep the single `@AGENTS.md` import immediately below the project
   `CLAUDE.md` title.
4. Add the project's actual README separately; never copy this usage file as
   `README.md`.
5. Start new Codex and Claude sessions in the project and run the loading smoke
   checks below.

The installed `project-init` skill runs these steps from an ordinary request.
Seeded projects are never synchronized automatically; the `project-sync` skill
uses `scripts/starter-diff.mjs` to adopt later starter changes one at a time,
and the `guidance-audit` skill recalibrates a project's guidance.

## Loading model

`docs/provider-contracts.md` in machine-bootstrap owns how Codex and Claude
load guidance and why the starter keeps a thin `CLAUDE.md`. For a project:
start sessions at its root or the relevant scoped directory, never depend on a
workspace parent guide, keep shared policy in `AGENTS.md` and only
Claude-specific mechanics in `CLAUDE.md`, and confirm loading with `/context`
in Claude or an instruction summary or session log in Codex.

## Nested guidance

Use nested `AGENTS.md` only for genuine subtree differences, and tell both
agents in the root guide to inspect the nearest shared guide before scoped
work. Start Codex in that subtree for automatic inclusion. Because the project
root has a `CLAUDE.md`, Claude loads a nested `AGENTS.md` only through a nested
`CLAUDE.md` containing `@AGENTS.md`; add one where lazy Claude loading is
useful, and never make project guidance depend on a user's Claude **Project
instructions** setting. Use `.claude/rules/*.md` for Claude-only path
mechanics, not shared policy. `docs/provider-contracts.md` owns the loading
rules behind this.

## Context and continuity budgets

Target about 90-120 lines and under 8 KiB for project `AGENTS.md`, and 10-20
lines and under 1.5 KiB for `CLAUDE.md`, and keep the cumulative `AGENTS.md`
chain under 28 KiB so the nearest guide survives Codex's default combined
limit. Maintainer notes in `CLAUDE.md` go in block-level HTML comments, which
Claude strips before loading; Codex reads `AGENTS.md` as written.

`CONTINUITY.md` is read on demand rather than imported, but reading it every
task still costs context. Keep current state within the project cap and rotate
resolved history to append-only `docs/continuity/YYYY-MM.md` files; the shared
`continuity` skill compacts automatically near the cap and on request
(`/continuity` in Claude Code, `$continuity` in Codex). Decisions may stay in
the ledger; when they crowd it, move them to an optional `docs/decisions.md`,
which the skill creates on demand rather than the starter seeding it empty. A
ledger of thousands of lines costs tens of thousands of tokens per task, and
Claude's default file read returns only its first 2,000 lines.

Shorter guides are followed more reliably: unnecessary requirements make agent
tasks harder and more expensive, so state only what an agent cannot infer from
the repository. From machine-bootstrap, `node scripts/audit-workspace.mjs`
reports these budgets for every sibling without changing anything; the
`guidance-audit` skill recalibrates a project's guidance, and the
`guidance-capture` skill adds one rule after a repeated mistake or review
finding, in the place that holds it best.

## Optional product-delivery workflow

The starter's Product-delivery hook states when the installed workflow
activates. Fill the project's activating conditions with checkable facts —
paths, contracts, or artifact kinds — and name the reviewer that satisfies
independent review. A self-assessed test such as "non-trivial work" is not a
condition, and an unrecorded skip is a process failure.

Projects may also add material-change triggers, required plan sections, or
name maintenance that stays outside their conditions while the named
contracts are unchanged. Prefer contract changes over blanket directory
matches when defining triggers.
For example, name changes to data retention, authorization, or installation
ownership; exclude mechanical maintenance only when those contracts remain
unchanged. Review of ordinary work follows the starter's Verification and
completion section, without the full workflow's Implementation Plan.

Personal preferences may live in gitignored `CLAUDE.local.md`, but they must
remain compatible with tracked project instructions.
