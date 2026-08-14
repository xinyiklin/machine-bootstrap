# Project Agent Guide

> Template — copy into a project root as `AGENTS.md`, replace every `TODO` with
> verified project facts, and delete this note and irrelevant sections.

Provider-agnostic instructions for this project. `CLAUDE.md` imports this file
and adds Claude-only tool mechanics. Keep this guide self-contained because the
repository may be cloned outside its current workspace.

## Instruction precedence

1. The user's current request.
2. Safety, data integrity, secret handling, and truthful claims.
3. The nearest current scoped guide and its owning documentation.
4. Durable facts in `CONTINUITY.md`, over older chat context.
5. Existing architecture and conventions.

Keep this file a router. Put detailed product, design, architecture, testing,
and subsystem contracts in their narrowest owning document and point to them
instead of duplicating them here.

## Project and guidance map

- Purpose and users: TODO.
- Stack, runtime, and package manager: TODO.
- Layout and entry points: TODO.
- External services and deployment: TODO — or “none; local-only.”
- `PRODUCT.md`: TODO product contract — or delete.
- `DESIGN.md`: TODO visual/interaction contract — or delete.
- `docs/`: TODO architecture, engineering, and testing owners — or delete.
- `docs/engineering/git-workflow.md`: branch through publication rules.
- Nested `AGENTS.md`: TODO scoped guide locations — or “none.”
- `README.md`: human-facing setup and usage.
- `CONTINUITY.md`: bounded current handoff state — or “none.”
- `docs/continuity/`: rotated history, read only when needed.

Before scoped work, explicitly read the nearest nested guide. Claude does not
discover `AGENTS.md`; Codex includes only files from its project root down to
its starting directory.

Codex defaults to a 32 KiB combined budget for that active guide chain. Keep
the cumulative root-to-working-directory chain below 28 KiB so the nearest
rules remain available. Move detailed inventories, examples, and verification
matrices to owning docs read on demand; line counts alone are not a byte budget.

## Hard invariants

<!-- TODO: list only rules whose violation is a bug or safety incident: privacy,
dependency direction, determinism, network exposure, schema/migration behavior,
data-loss boundaries, or required compatibility. Delete examples afterward. -->

- TODO.

## Workflow Adaptations

This project uses the portable `product-delivery` workflow installed at
`~/.agents/workflows/product-delivery/`. That package owns role contracts, two
exact user approval gates, Change Request escalation, artifact templates, and
honest verification reporting; do not copy that contract here.

The project may strengthen the workflow but may not weaken exact user approval,
scope-change escalation, or honest verification. Independent review defaults
to one fresh reviewer after the implementer's own verification. Only the user may waive it for a specific
change.

- Additional Change Request triggers: TODO — or “none.”
- Additional Delivery Plan sections: TODO — or “none.”
- Required project verification: TODO — or “the commands below.”
- Specialist roles or additional reviewers: TODO — or “none.”
- Task artifact retention: local while active. If tracked continuity references
  a completed `[TASK <task-id>]`, track that task folder too; otherwise keep the
  continuity summary self-contained. TODO confirm project policy.

Use Product Brief, Delivery Plan, Alignment Review, Implementation Report, and
Verification Report for a normal completed task. Create Decision Logs only for
material decisions and Change Requests only when triggered; never create empty
placeholder artifacts.

## Commands

Run commands from the repository root. Replace every TODO.

- Install: TODO
- Dev/run: TODO
- Build: TODO
- Test: TODO
- Lint/typecheck/format: TODO

Use the smallest meaningful check while iterating and report what was skipped.
If this workspace reserves ports, claim one in the parent `MACHINE.md`, pin it
in project configuration, and reuse an existing listener instead of silently
switching ports.

## Start of task

1. Read `CONTINUITY.md` if present and the nearest guides that apply.
2. Identify the goal, acceptance criteria, scope, and constraints.
3. Inspect affected files, callers, state owners, and consumers.
4. Inspect the dirty tree and preserve unrelated work.
5. For non-trivial work, state a compact plan and verification checks.
6. Ask only when ambiguity could change behavior or authorize risky work;
   otherwise make a stated reasonable assumption and proceed.

For current APIs, versions, prices, schedules, laws, or advisories, establish
the date and verify against official or primary sources. Cross-check high-stakes
medical, legal, financial, compatibility, privacy, and security claims.

## Engineering and safety

- Implement the smallest maintainable change that satisfies the request. Do not
  add speculative features, abstractions, configuration, or drive-by cleanup.
- Match existing style and ownership. Every changed line must trace to requested
  behavior, necessary cleanup, or a verification fix.
- Comment only for non-obvious rationale, constraints, or safety. Do not hide
  failures with fallback defaults, empty catches, or swallowed errors.
- Treat files around 300 lines as a cohesion prompt, not an automatic split.
- Ask before adding dependencies or changing schemas, deployment, authentication,
  destructive storage behavior, paid services, or public network exposure.
- Before adding or upgrading a dependency, inspect runtime compatibility,
  manifests, lockfiles, and version policy. Verify the current stable or maintainer-recommended release
  from an official registry, documentation, or release notes; never select a dependency version from model memory alone.
- Prefer the latest compatible stable release. Preserve the project's package
  manager and version-range policy, update its lockfile when the project tracks
  one, and explain any deliberate use of an older or prerelease version.
- Never expose or commit secrets, credentials, private documents, `.env` files,
  provider bodies, or broad environment output. Do not ask users to paste them.
- Remote writes require explicit user authorization. Resolve exact targets and
  prefer recoverable operations before destructive changes.
- Never install host-level system packages unless the user explicitly asks;
  prefer the project's existing container or documented setup.

## Continuity

Keep `CONTINUITY.md` at or below the project-defined total line cap (about 160
lines by default), counting every section. It holds only current snapshot,
compact active decision indexes, working set, next actions, and open questions.
Detailed rationale belongs in the owning contract or a focused decision record.

Rotate resolved or superseded entries verbatim into
`docs/continuity/YYYY-MM.md`, leaving a dated milestone link. Archives are
append-only and read only when a task needs history. Never store transcripts,
raw logs, or chat dumps. Tag entries with an ISO date and `[USER]`, `[CODE]`,
`[TOOL]`, or `[ASSUMPTION]`; write `UNCONFIRMED` instead of guessing.

<!-- TODO: set the exact cap and whether continuity is tracked. -->

## Verification and definition of done

Run the narrowest owner check while iterating, then affected consumer checks in
proportion to blast radius. Before completion, inspect the complete diff and
surrounding code for correctness, regressions, scope, maintainability, stale
paths, accidental complexity, and unrelated changes.

- UI: browser QA is flag-first unless the project requires it. Name concrete
  visual risk and report whether it ran; Claude-specific tooling lives in
  `CLAUDE.md`.
- Refactors: prove behavior preservation and removal of stale symbols/paths.
- Docs: verify links, paths, commands, and internal consistency.
- Output/file formats: inspect the real artifact and test round trips plus
  malformed-input rejection where applicable.
- No harness: run the strongest available lightweight check and name the gap.

Done means the requested outcome works, affected contracts agree, relevant
checks and independent review are reported honestly, skipped checks and risks
are explicit, and documentation/continuity reflects durable changes.

## Git and existing work

Read `docs/engineering/git-workflow.md` before branch, commit, push, PR, review,
merge, release, deploy, or cleanup work.

- Do not stage, commit, push, amend, reset, rebase, switch branches, publish, or
  deploy unless the user asks. Never bypass hooks or force-push shared history.
- Stage exact paths. Preserve unrelated dirty files, branches, refs, stashes,
  generated output, and user-authored work.
- Treat tracked `AGENTS.md`, `CLAUDE.md`, continuity, and task artifacts like
  normal project files; keep personal agent state and machine config excluded.
- Treat a push or merge that triggers deployment as a deployment requiring
  explicit authorization and a verified completion receipt.
- Prefer one coherent commit per reviewable unit and the project's documented
  commit convention; otherwise use Conventional Commit subjects.

Report useful progress, blockers, verification, skipped checks, residual risks,
and final outputs. Keep simple answers simple.
