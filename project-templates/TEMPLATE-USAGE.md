# Project Guide Template Usage

This file explains the starter set. It is not a project README and must not be
copied or renamed as one.

## Starter paths

- `AGENTS.md`: canonical provider-neutral project guidance.
- `CLAUDE.md`: non-conflicting Claude adapter importing `AGENTS.md` once.
- `.gitignore`: local agent state, environment, and OS exclusions.
- `docs/engineering/git-workflow.md`: project-owned Git/publication contract.
- `.github/pull_request_template.md`: PR scope and verification receipt.

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

## Loading model

- Codex builds its chain once per run. At a Git project root it loads that
  root's `AGENTS.md`; from a scoped starting directory it loads applicable
  guides from the project root down. A parent workspace guide is not inherited.
- With no detected project root, Codex checks only the starting directory. It
  does not walk upward to an arbitrary workspace guide or rebuild its chain
  after navigating elsewhere. Start or restart at the intended root or scope.
- Claude loads `CLAUDE.md` and `CLAUDE.local.md` from its starting directory and
  every directory above it, and expands the project's explicit `@AGENTS.md`
  import. Do not depend on a workspace parent for project policy or create
  intentional contradictions.
- Claude Code 2.1.277 and later can also read `AGENTS.md` natively, but only
  when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` exists on the
  path. Keep the starter `CLAUDE.md` adapter anyway: a personal
  `CLAUDE.local.md` would otherwise silently turn native reading off, some
  sessions and versions cannot read `AGENTS.md` directly, and
  `InstructionsLoaded` hooks fire only for imported files. The import never
  loads `AGENTS.md` twice. `AGENTS.md` stays the single shared policy; put only
  Claude-specific mechanics in `CLAUDE.md`, because Codex never reads it.
- Use `/context` to inspect loaded instruction files (`/memory` lists the
  locations Claude checks). Use an `InstructionsLoaded` hook when exact Claude
  file-level events are required.
  Use a Codex instruction-summary or session-log smoke check for Codex.

## Nested guidance

Use nested `AGENTS.md` only for genuine subtree differences. Tell both agents
in the root guide to inspect the nearest shared guide before scoped work. Start
Codex in that subtree for automatic inclusion. Because the project root has a
`CLAUDE.md`, Claude does not load a nested `AGENTS.md` by itself; add a nested
`CLAUDE.md` containing only `@AGENTS.md` when lazy Claude loading is useful.
A user who sets Claude's **Project instructions** to `claude-md-and-agents-md`
also gets nested `AGENTS.md` files lazily, but project guidance must not depend
on that machine setting. Use `.claude/rules/*.md` for Claude-only path
mechanics, not shared policy.

## Context and continuity budgets

Target about 90-120 lines and under 8 KiB for project `AGENTS.md`, and 10-20
lines and under 1.5 KiB for `CLAUDE.md`. Codex defaults to a 32 KiB combined
active-chain limit; keep the cumulative chain below 28 KiB so the nearest guide
is retained. Claude strips block-level HTML comments from `CLAUDE.md` before
loading it, so maintainer notes there cost no context; Codex reads `AGENTS.md`
as written.

`CONTINUITY.md` is read on demand rather than imported, but reading it every
task still costs context. Keep current state within the project cap and rotate
resolved history to append-only `docs/continuity/YYYY-MM.md` files. A ledger of
thousands of lines costs tens of thousands of tokens per task, and Claude's
default file read returns only its first 2,000 lines.

Shorter guides are followed more reliably: unnecessary requirements make agent
tasks harder and more expensive, so state only what an agent cannot infer from
the repository. From machine-bootstrap, `node scripts/audit-workspace.mjs`
reports these budgets for every sibling without changing anything. In Claude
Code 2.1.283 and later, `/doctor prompt-audit` finds stale or conflicting
instructions.

## Optional product-delivery workflow

The installed workflow is inactive during ordinary work. Its complete flow
activates only when Delivery Lead or Product Partner is selected, the user
explicitly requests the complete workflow, an active Implementation Plan is
continued, or project guidance requires it for named work. Selecting the
Verifier activates only independent verification for the supplied change.
When active, the Delivery Lead keeps one living Implementation Plan; routine
progress never requires re-approval.

Fill the project's activating conditions with checkable facts — paths,
contracts, or artifact kinds — and name the reviewer that satisfies independent
review. A self-assessed test such as "non-trivial work" is not a condition, and
an unrecorded skip is a process failure.

Prefer contract changes over blanket directory matches when defining triggers.
For example, name changes to data retention, authorization, or installation
ownership; exclude mechanical maintenance only when those contracts remain
unchanged. Ordinary implementations still receive self-verification and,
unless they are typo, link, formatting, or comment-only, one fresh independent
review before local completion; that review does not require the full
workflow's Implementation Plan. Existing user authorization continues to
apply; do not repeat a permission question for the same scope.

Personal preferences may live in gitignored `CLAUDE.local.md`, but they must
remain compatible with tracked project instructions.
