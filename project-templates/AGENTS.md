# Project Agent Guide

> Template: copy to a project root as `AGENTS.md`, replace every `TODO` with a
> verified project fact, and delete this note and irrelevant sections.

Canonical provider-neutral guidance for this project. Keep it self-contained
because the repository may be cloned outside its current workspace.

## Authority and ownership

1. System/platform safety, data integrity, secret protection, and explicit
   authorization boundaries.
2. The user's current request within those boundaries.
3. The nearest applicable project or scoped guide and its owning documentation.
4. Current durable facts in `CONTINUITY.md` over older conversational context.
5. Existing architecture and conventions when higher owners are silent.

Do not create intentional contradictions between instruction files or rely on
load order to resolve them. Keep this file a router to narrower owners.

## Project map

- Purpose and users: TODO.
- Stack, runtime, and package manager: TODO.
- Layout and entry points: TODO.
- External services and deployment: TODO, or `none; local-only`.
- Product/design/architecture/testing owners: TODO paths, or delete.
- `docs/engineering/git-workflow.md`: branch through publication contract.
- Commands and CI owners: TODO paths.
- Nested `AGENTS.md`: TODO locations, or `none`.
- `CONTINUITY.md`: bounded current handoff state, or `none`.

Codex builds the active guide chain once per run from the project root to its
starting directory. Start or restart it in a scoped directory when automatic
nested loading matters. Claude does not discover nested `AGENTS.md`; explicitly
read the nearest shared guide before scoped work. Add a paired nested
`CLAUDE.md` containing only `@AGENTS.md` when automatic lazy Claude loading is
valuable. Use `.claude/rules/*.md` only for genuinely Claude-specific mechanics.

Codex defaults to a 32 KiB combined chain limit. Keep the largest active chain
below 28 KiB and this root guide below 8 KiB; move inventories, examples, and
matrices to owning documents read on demand.

## Hard invariants

<!-- Only rules whose violation is a bug or safety incident: privacy,
dependency direction, determinism, exposure, migration/data-loss boundaries,
or required compatibility. -->

- TODO.

## Product-delivery hook

The installed `~/.agents/workflows/product-delivery/` contract is inactive for ordinary work.
Its complete flow activates when the user selects Product Partner or Delivery Lead,
explicitly requests the complete workflow, continues an active Product Brief or
Delivery Plan, or project guidance names required work. Selecting the Verifier
activates independent verification only and never creates missing upstream artifacts.

When active, follow the installed contract without copying its gates or
artifacts here. Project-specific additions only:

- Named work that activates the workflow: TODO as checkable conditions — paths,
  contracts, or artifact kinds a reader can evaluate — never a self-assessed
  size or importance test; or `none`.
- Maintenance outside those conditions: typo/link corrections, reflow, tests
  of unchanged behavior, and internal refactors preserving the named contracts.
  A change to a named contract still activates the flow; record the classification.
- Additional Change Request triggers: TODO, or `none`.
- Required project checks or specialist review: TODO, or `the commands below`.
- Reviewer that satisfies independent review: TODO exact agent or command name,
  or `the installed Verifier`; resolve any project agent that shares its name.
- Artifact-retention policy: TODO, or `local while active`.

When a listed condition matches and the workflow or its review is not run, say
so in the response with the reason. An unrecorded skip is a process failure,
not a judgment call.

## Commands

Run from the repository root unless a command says otherwise.

- Install: TODO
- Dev/run: TODO
- Build: TODO
- Test: TODO
- Lint/typecheck/format: TODO

## Working method and safety

- Read current continuity and applicable guides; inspect the dirty tree and
  preserve unrelated work before editing.
- Identify the requested outcome, acceptance evidence, affected owners,
  callers, state, and consumers. Plan only in proportion to complexity.
- Implement the smallest maintainable change that satisfies the request. Avoid
  speculative features, abstractions, configuration, and drive-by cleanup.
- Ask before changing dependencies, schemas, authentication, deployment,
  destructive storage behavior, paid services, or public network exposure
  when the user's current request or prior authorization does not cover it.
  Continue authorized work; ask only for an unresolved decision or new scope.
- For dependencies, inspect compatibility and version policy, verify the latest
  compatible stable or maintainer-recommended release from official sources,
  preserve the package manager/range policy, and update a tracked lockfile.
- Never expose or commit secrets, private documents, `.env` files, provider
  bodies, broad environments, or generated private artifacts.
- Resolve exact targets before destructive actions and prefer recovery. Remote
  writes, publication, deployment, and host installation require explicit user
  authority.

## Continuity

Keep `CONTINUITY.md` at or below the project-defined total cap (about 160 lines
by default), counting every section. It holds only current snapshot, compact
active decisions, working set, next actions, and open questions. Put detailed
rationale in its owning document. Rotate resolved entries verbatim to
`docs/continuity/YYYY-MM.md`; archives are append-only and read only on demand.

## Verification and completion

Run the narrowest owner check while iterating, then affected consumer checks in
proportion to risk. Inspect the complete diff and surrounding code for
correctness, regressions, unintended scope, stale paths, and unrelated changes.
Verify UI, generated artifacts, file formats, migrations, and round trips when
they are part of the changed contract. If no harness exists, run the strongest
lightweight check and state the gap. Report passed, failed, unverified, and
skipped evidence honestly; missing evidence is not a pass.

Every implementation, including ordinary work outside the full workflow,
requires implementer verification and one fresh independent review before
local completion. Delegate to the reviewer named above; the installed Verifier
is `mb_verifier` in Codex and `mb-verifier` in Claude. The reviewer must not have
implemented the change. Only the user may waive review for a specific change;
record the waiver and reason, never a pass. If that reviewer is unavailable,
report the gap and request a replacement or waiver. This review alone does not
activate the full workflow or require its upstream artifacts.

## Git and existing work

Read `docs/engineering/git-workflow.md` before any branch, commit, push, PR,
merge, release, deployment, or cleanup action. Preserve unrelated work and do
not stage, publish, rewrite history, or deploy without the user's explicit
authority for that action.
