# Project Agent Guide

> Template: copy to a project root as `AGENTS.md`, replace every `TODO` with a
> verified project fact, and delete this note and irrelevant sections.

Canonical provider-neutral guidance for this project. State only what an agent
cannot infer from the repository; keep this guide under 8 KiB and link detail
from its owning documents.

## Project map

- Purpose and users: TODO.
- Stack, runtime, and package manager: TODO.
- Layout and entry points: TODO.
- External services and deployment: TODO, or `none; local-only`.
- Product, design, architecture, or testing owners: TODO paths, or delete.
- `docs/engineering/git-workflow.md`: branch through publication contract.
- Nested `AGENTS.md`: TODO locations, or `none`; read the nearest one before
  scoped work.
- `CONTINUITY.md`: current handoff state, or `none`; optional
  `docs/decisions.md`: active decisions, read before changing a rule.

## Commands

Run from the repository root unless a command says otherwise.

- Install: TODO
- Dev/run: TODO
- Build: TODO
- Test: TODO
- Lint/typecheck/format: TODO
- CI owners: TODO paths.

## Hard invariants

<!-- Only rules whose violation is a bug or safety incident: privacy,
dependency direction, determinism, exposure, migration/data-loss boundaries,
or required compatibility. -->

- TODO.

## Authorization and safety

- Read current continuity and the applicable guides, and inspect the dirty
  tree before editing; preserve unrelated work.
- Ask before changing dependencies, schemas, authentication, deployment,
  destructive storage behavior, paid services, or public network exposure that
  the user's request or prior authorization does not cover. Otherwise continue
  authorized work; ask only for an unresolved decision or new scope.
- For a dependency change, use the latest compatible stable or
  maintainer-recommended release from official sources, keep the package
  manager and range policy, and update the tracked lockfile.
- Never expose or commit secrets, `.env` files, private documents, provider
  responses, broad environment output, or generated private artifacts.
- Resolve exact targets before destructive actions and prefer recovery.
  Staging, history rewrites, remote writes, publication, deployment, and host
  installation each need the user's explicit authority.

## Verification and review

Run the checks for the changed surface and its consumers; when no harness
covers the change, run the strongest lightweight check and state the gap.
Report passed, failed, unverified, and skipped checks honestly; missing
evidence is not a pass. When a harness or session limit prevents a required
process, say so and continue authorized work; never skip it silently.

After your own verification and before local completion, every change gets one
fresh independent review by a reviewer that did not make it: TODO exact agent
or command, or the installed Verifier (`mb-verifier` in Claude, `mb_verifier`
in Codex); if a project agent shares that name, say which one. The exception is
a change confined to typos, broken links, formatting, or comments with no
change in meaning, behavior, or configuration; it needs only your own
verification, and you state that classification. Only the user may waive a
required review; record the waiver, never a pass. If the reviewer is
unavailable, report the gap and ask for a replacement or waiver. This review
alone does not activate the full workflow.

## Product-delivery hook

The installed `~/.agents/workflows/product-delivery/` workflow activates when
the user selects Delivery Lead or Product Partner, asks for the complete
workflow, continues an active Implementation Plan, or a change matches a
condition below; selecting the Verifier activates verification only. When
active, follow the installed contract without copying it here.

- Activating changes: TODO as checkable conditions (paths, contracts, or
  artifact kinds), not a size or importance judgment; or `none`.
- Additional checks or specialist review: TODO, or `none`.

When a condition matches and the workflow or its review is not run, say so and
record the reason.

## Continuity and Git

Keep `CONTINUITY.md` to current state within its cap (160 lines by default),
rotating resolved entries verbatim to append-only `docs/continuity/YYYY-MM.md`;
the shared `continuity` skill does this. Read
`docs/engineering/git-workflow.md` before any branch, commit, push, PR, merge,
release, deployment, or cleanup action.
