# Project Agent Guide

> Template: copy to a project root as `AGENTS.md`, replace every `TODO` with a
> verified project fact, and delete this note and irrelevant sections.

Canonical provider-neutral guidance for this project. Keep it self-contained
because the repository may be cloned outside its current workspace, and keep it
a router to narrower owners.

Precedence: platform safety, data integrity, secret protection, and
authorization boundaries; then the user's current request within them; then the
nearest applicable guide and its owning documents; then current `CONTINUITY.md`
facts over older conversation; then existing conventions. Never create
contradictions between guides or rely on load order to resolve them.

## Project map

- Purpose and users: TODO.
- Stack, runtime, and package manager: TODO.
- Layout and entry points: TODO.
- External services and deployment: TODO, or `none; local-only`.
- Product/design/architecture/testing owners: TODO paths, or delete.
- `docs/engineering/git-workflow.md`: branch through publication contract.
- Nested `AGENTS.md`: TODO locations, or `none`. Read the nearest one yourself
  before scoped work.
- `CONTINUITY.md`: bounded current handoff state, or `none`; optional
  `docs/decisions.md`: active decisions, read before changing a rule.

Keep this guide under 8 KiB and any active guide chain under 28 KiB (Codex's
default limit is 32 KiB). State only what an agent cannot infer from the
repository; move inventories, examples, and matrices to owning documents.

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

## Product-delivery hook

The installed `~/.agents/workflows/product-delivery/` contract is inactive for
ordinary work. Its complete flow activates when the user selects Delivery Lead
or Product Partner, explicitly requests the complete workflow, continues an
active Implementation Plan, or project guidance names required work. Selecting
the Verifier activates independent verification only.

When active, follow the installed contract without copying its rules or
artifacts here. Project-specific additions only:

- Named work that activates the workflow: TODO as checkable conditions — paths,
  contracts, or artifact kinds a reader can evaluate, not a self-assessed size
  or importance test; or `none`.
- Maintenance outside those conditions: typo/link corrections, reflow, tests
  of unchanged behavior, and internal refactors preserving the named contracts.
  A change to a named contract still activates the flow; record the classification.
- Additional material-change triggers: TODO, or `none`.
- Required project checks or specialist review: TODO, or `the commands above`.
- Reviewer that satisfies independent review: TODO exact agent or command name,
  or `the installed Verifier`; resolve any project agent that shares its name.

When a listed condition matches and the workflow or its review is not run, say
so in the response and record the reason.

## Working method and safety

- Read current continuity and applicable guides; inspect the dirty tree and
  preserve unrelated work before editing.
- Make the smallest maintainable change that satisfies the request; no
  speculative features, abstractions, configuration, or drive-by cleanup.
- Ask before changing dependencies, schemas, authentication, deployment,
  destructive storage behavior, paid services, or public network exposure
  when the user's current request or prior authorization does not cover it.
  Continue authorized work; ask only for an unresolved decision or new scope.
- For dependencies, verify the latest compatible stable or
  maintainer-recommended release from official sources, preserve the package
  manager and range policy, and update a tracked lockfile.
- Never expose or commit secrets, private documents, `.env` files, provider
  bodies, broad environments, or generated private artifacts.
- Resolve exact targets before destructive actions and prefer recovery. Remote
  writes, publication, deployment, and host installation require explicit user
  authority.

## Continuity

Keep `CONTINUITY.md` within its cap (160 lines by default) and limited to
current state, compact active decisions, next actions, and open questions;
detailed rationale belongs in its owning document. Rotate resolved entries
verbatim to `docs/continuity/YYYY-MM.md`; archives are append-only and read
only on demand. Once decisions crowd the ledger, move them verbatim to an
optional `docs/decisions.md`. The shared `continuity` skill, when installed,
does all of this.

## Verification and completion

Run the narrowest owner check while iterating, then affected consumer checks in
proportion to risk. Inspect the complete diff for correctness, regressions,
unintended scope, and stale paths. Verify UI, generated artifacts, file
formats, migrations, and round trips when they are part of the changed
contract; if no harness exists, run the strongest lightweight check and state
the gap. Report passed, failed, unverified, and skipped evidence honestly;
missing evidence is not a pass.

After your own verification and before local completion, every change gets one
fresh independent review by the reviewer named above (the installed Verifier is
`mb_verifier` in Codex and `mb-verifier` in Claude), which must not have
implemented it. The exception is a change confined to typos, broken links,
formatting, or comments with no change in meaning, behavior, or configuration;
it needs only your own verification, and you state that classification. Only
the user may waive a required review; record the waiver, never a pass. If the
reviewer is unavailable, report the gap and ask for a replacement or waiver.
This review alone does not activate the full workflow.

## Git and existing work

Read `docs/engineering/git-workflow.md` before any branch, commit, push, PR,
merge, release, deployment, or cleanup action. Do not stage, publish, rewrite
history, or deploy without the user's explicit authority for that action.
