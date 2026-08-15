# Project Guide Template Usage

This file explains the starter set. It is not a project README and must not be
copied or renamed as one.

## Starter paths

- `AGENTS.md`: canonical provider-neutral project guidance.
- `CLAUDE.md`: non-conflicting Claude adapter importing `AGENTS.md` once.
- `.gitignore`: local agent state, environment, and OS exclusions.
- `docs/engineering/git-workflow.md`: project-owned Git/publication contract.
- `.github/pull_request_template.md`: PR scope and verification receipt.

The starter `.gitignore` keeps shared `.claude/` and `.codex/` configuration
trackable. It excludes `CLAUDE.local.md`, `.claude/settings.local.json`, and
active `.agent-work/` artifacts. Remove the last exclusion only when the
project intentionally tracks completed task artifacts referenced by continuity.

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
   before any write.
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
- Claude expands the project's explicit `@AGENTS.md` import. Do not depend on a
  workspace parent for project policy or create intentional contradictions.
- Use `/context` to inspect live context composition. Use an
  `InstructionsLoaded` hook when exact Claude file-level events are required.
  Use a Codex instruction-summary or session-log smoke check for Codex.

## Nested guidance

Use nested `AGENTS.md` only for genuine subtree differences. Tell both agents
in the root guide to inspect the nearest shared guide before scoped work. Start
Codex in that subtree for automatic inclusion. Add a nested `CLAUDE.md`
containing only `@AGENTS.md` when lazy Claude loading is useful. Use
`.claude/rules/*.md` for Claude-only path mechanics, not shared policy.

## Context and continuity budgets

Target about 90-120 lines and under 8 KiB for project `AGENTS.md`, and 10-20
lines and under 1.5 KiB for `CLAUDE.md`. Codex defaults to a 32 KiB combined
active-chain limit; keep the cumulative chain below 28 KiB so the nearest guide
is retained.

`CONTINUITY.md` is read on demand rather than imported, but reading it every
task still costs context. Keep current state within the project cap and rotate
resolved history to append-only `docs/continuity/YYYY-MM.md` files.

## Optional product-delivery workflow

The installed workflow is inactive during ordinary work. Its complete flow
activates only when Product Partner or Delivery Lead is selected, the user
explicitly requests the complete workflow, an active Product Brief or Delivery
Plan is continued, or project guidance requires it for named work. Selecting
the Verifier activates only independent verification for the supplied change.

Personal preferences may live in gitignored `CLAUDE.local.md`, but they must
remain compatible with tracked project instructions.
