# Project Agent Guide

> Template — copy into a project root as `AGENTS.md`, then replace the `TODO`
> placeholders with the project's real shape, commands, and constraints. Delete
> this note and anything that does not apply.
>
> This file is a **superset**, not a target. It is longer than a finished guide
> should be, so cut aggressively: a project guide is imported into every
> session, and the finished file should land under ~200 lines. Anything that
> survives should be something an agent would otherwise get wrong.

Generic working agreements for coding agents on this project. `AGENTS.md` is the
provider-agnostic source of truth; `CLAUDE.md` adds Claude-specific overrides.
A more specific or deeper doc (a nested `AGENTS.md`, README, or engineering doc)
wins over this file when it is current.

<!-- TODO: one or two lines on what this project is, who uses it, and its stack. -->

## Instruction Precedence

1. User instructions for the current task.
2. Safety, data integrity, and secret handling — before stylistic preferences.
3. The nearest, most specific guidance file, when current.
4. Durable facts in the nearest `CONTINUITY.md`, over older chat context.
5. Existing architecture and conventions.

Do not preserve stale rules. If the project shape changes, update the relevant
docs and the continuity ledger together.

Keep this file a router: state agent behavior and high-level conventions here,
and keep detailed rules in the narrowest relevant document (a nested `AGENTS.md`,
README, or engineering doc). When content overlaps, point to the deeper doc
instead of duplicating it.

## Project Shape

<!-- TODO: fill in; delete rows that do not apply. -->

- Stack: TODO (language, framework, runtime, package manager).
- Layout: TODO (key directories and what lives in each).
- Entry points: TODO (app/server entry, CLI, main modules).
- External services: TODO (database, APIs, storage) — or "none; local-only".
- Deployment: TODO — or "none yet".

Treat the project as local/offline unless a remote service, production system, or
deployment target is explicitly in scope.

## Guidance Map

<!-- TODO: list the docs that own each concern, and delete the rows you don't
have. This section is what keeps the guide a router instead of a dumping
ground. -->

- `PRODUCT.md` — TODO (product purpose, users, tone, boundaries) — or delete.
- `DESIGN.md` — TODO (tokens, typography, components) — or delete.
- `docs/` — TODO (architecture, engineering contracts, testing) — or delete.
- Nested `AGENTS.md` — TODO (which directories own their own scoped guide).
- `README.md` — human-facing setup and usage.
- `CONTINUITY.md` — durable handoff state — or state that there is none.

## Hard Invariants

<!-- TODO: the rules that are bugs if broken, not preferences. Examples from
sibling projects: content privacy (never persist or log user text), dependency
limits (no npm deps in this package), determinism (ids are pure functions of
source coordinates), network posture (loopback-only unless explicitly opened),
file-format contracts (schema version + migration rules), or "must stay
openable from `file://`". Delete this section only if the project genuinely has
none. -->

## Workflow Adaptations

<!-- TODO: fill in or delete. Only fill rows this project actually needs. -->

This project uses the portable `product-delivery` workflow (Product Partner →
Delivery Lead → Verifier) installed at
`~/.agents/workflows/product-delivery/`. That package owns the process: the
role contracts, the two exact user approval gates, Change Request escalation,
and honest verification reporting. Do not copy it here.

This project may **strengthen** the workflow. It may not weaken exact user
approval, scope-change escalation, or honest verification reporting.

- Additional high-risk triggers requiring a Change Request: TODO — or "none
  beyond the portable list".
- Additional required Delivery Plan sections: TODO — or "none".
- Required project-specific verification before a change is done: TODO — or
  "the checks in Commands".
- Project-specific specialist roles and what each owns: TODO — or "none".
- Active task artifacts under `.agent-work/tasks/<task-id>/`: local (ignored)
  or tracked? TODO.

## Commands

<!-- TODO: replace with the project's real commands. -->

- Install: TODO
- Run / dev: TODO
- Build: TODO
- Test: TODO
- Lint / typecheck / format: TODO

Run the smallest meaningful subset for the change at hand, and say what was
skipped.

### Port reservations

<!-- TODO: claim an unused range, pin this project's canonical dev port, add
this project to the table below, and mirror the addition into each sibling
guide. -->

Sibling projects in this workspace use fixed, non-overlapping dev-server ranges
so a bound port means "the app is already running," not "pick another." Pin the
port (e.g. Vite `strictPort: true`); when a reserved port is bound, connect to
the running app instead of starting a second server or switching ports.

The workspace registry belongs in the parent `MACHINE.md`. Claim the next free
range there first, then record this project's canonical port here.

- TODO this project: canonical port(s), and the range claimed in the
  machine-local registry.

## Start-Of-Task Checklist

Before changing code or project files:

1. Read `CONTINUITY.md` if it exists.
2. Read the nearest `AGENTS.md`, `CLAUDE.md`, README, or docs that apply.
3. Identify the goal, acceptance criteria, scope, and constraints.
4. Inspect the files you will touch before choosing an implementation.
5. If the request depends on current or recency-sensitive facts, establish the
   date/time and prefer authoritative sources.
6. For non-trivial tasks, state a compact plan with concrete verification checks.
7. Ask one targeted clarifying question only when ambiguity could cause
   user-facing confusion or irreversible work. Otherwise make a reasonable
   assumption and proceed.

## Accuracy, Recency, And Sourcing

When a request depends on "latest", "current", "today", recent APIs, pricing,
release notes, security advisories, or compatibility:

- Establish the current date/time (e.g. `date -Is`; on macOS,
  `date '+%Y-%m-%dT%H:%M:%S%z'`) and state it when it affects the answer.
- Prefer official or primary sources: vendor docs, upstream repositories,
  changelogs, release notes, standards, or maintainer announcements.
- For safety-, compatibility-, legal-, medical-, or financial-sensitive details,
  cross-check reputable sources and call out source dates when relevant.
- Use library/API documentation tools when available. Pin the library and version
  when known, fetch only the focused docs needed, and summarize rather than
  dumping large source text.
- Use web search when it materially improves correctness; prefer official docs
  before secondary explainers.

## Agent Operating Principles

- Think before coding. State important assumptions, surface tradeoffs, and ask
  when confusion would change the solution.
- Keep it simple. Write the smallest maintainable code that solves the request;
  do not add speculative features, knobs, abstractions, or future-proofing.
- Keep implementation scope literal. If an extra improvement or recommendation
  is not required by the request, present it to the user and wait for approval
  before implementing it.
- Make surgical changes. Every changed line should trace to the request, a
  cleanup caused by it, or a verification fix.
- Match the codebase. Prefer existing style, naming, patterns, framework choices,
  and helper APIs over personal preference.
- Clean up only your own wake. Remove imports, state, helpers, files, or docs
  made obsolete by your change; mention unrelated dead code instead of deleting
  it.
- Define success in verifiable terms: reproduce the issue, make the change, run
  the relevant test/build, and inspect the result.
- Loop until verified. If a check fails, use the failure as evidence, adjust, and
  rerun the smallest meaningful check before broader ones.
- Use judgment on tiny tasks. A typo or one-line answer does not need ceremony.
- Push back when the requested path is riskier, broader, or more brittle than a
  simpler way to satisfy the same goal.

## Development And Editing

- Default to read-only exploration before edits.
- Keep changes scoped and reviewable.
- Prefer patch-style edits over full rewrites unless a clean replacement is
  requested or the file is no longer relevant.
- Preserve existing style and conventions.
- Comment only when it explains non-obvious rationale, constraints, or safety;
  do not narrate self-explanatory code.
- Keep hand-written source files modular. Treat files over ~300 lines as a prompt
  to check boundaries; split when it improves readability or future change. Do
  not cap necessary scope just to hit a line count.
- Keep public entrypoints stable where practical; isolate volatile logic behind
  smaller helpers.
- Do not add default fallbacks during development just to hide failures. If a
  required value is missing, fail visibly enough to fix the real cause.
- Do not leave empty `catch` blocks or silently swallow errors.
- Do not reinvent the wheel. When a mature library would reduce risk, ask before
  adding it and help qualify the choice.
- Design UI for the end user and workflow, not for the database schema.
- Browser QA is flag-first (see Verification): skip it by default and name the
  risk instead of starting a dev server unasked. Tool choice lives in
  `CLAUDE.md`.

## Secrets And Safety

- Never print secrets, tokens, private keys, credentials, or broad environment
  dumps. Do not ask the user to paste secrets.
- Never commit secrets or `.env` files; keep them git-ignored.
- Avoid commands that may expose secrets (dumping shell environments, reading
  private key files). Redact sensitive strings in shared output.
- Remote API calls must be read-only unless the user explicitly requests a write;
  dry-run requested writes first when possible.
- Pause and confirm before irreversible or destructive actions: bulk deletes,
  history rewrites, schema or data drops, production/remote writes, or adding
  paid or vendor dependencies.

## Containers And Tooling

- Never install system packages on the host unless the user explicitly asks.
- Prefer the project's existing workflow when one exists (`Dockerfile`, compose
  files, Make targets, or documented scripts).
- If no workflow exists and dependencies are needed, discuss a minimal,
  project-scoped setup before adding one.

## Reading Documents And Data

For PDFs, uploads, long documents, spreadsheets, or CSVs:

- Read the full source before drafting.
- Draft the requested output.
- Before finalizing, re-check the source for factual accuracy, invented details,
  and wording/style constraints.
- Label paraphrases explicitly when source-faithful handling matters.

## Continuity Ledger

Maintain one compact `CONTINUITY.md` for the project. It is the durable handoff
memory; keep it factual and bounded — no transcripts, raw logs, or chat dumps.

- Read it at the start of each task before acting.
- Update it only for meaningful deltas: goal, constraints, durable decisions,
  state, open questions, working set, or important tool outcomes.
- Tag every entry with an ISO date and a provenance tag: `[USER]`, `[CODE]`,
  `[TOOL]`, or `[ASSUMPTION]`. Write `UNCONFIRMED` rather than guessing.
- Supersede changed facts explicitly instead of silently rewriting history.
- Keep `Snapshot` to ~25 lines, `Done (recent)` to ~7 bullets, and `Working set`
  to ~12 paths. Compress older noise into milestone bullets that point to a
  commit, PR, doc, or log.
- Record durable choices as ADR-lite entries, e.g.
  `D001 ACTIVE: chosen stack is ...`.
- In replies after material work, include a brief snapshot: Goal, Now, Next, and
  Open Questions. Print the full ledger only when it changed materially or the
  user asks.

## Verification And Definition Of Done

Run the narrowest owner-level check while iterating, then every affected
consumer check in proportion to blast radius.

A task is done when:

- The requested change is implemented or the question is answered.
- Relevant verification was attempted — build, lint, tests, typecheck, document
  rendering, or runtime smoke checks (see Commands).
- Skipped checks, residual risks, and follow-ups are stated explicitly.
- Errors and warnings are fixed or explicitly listed as out of scope.
- Impact is explained: what changed, where, and why.
- Docs are updated for impacted behavior, setup, or workflow.
- `CONTINUITY.md` is updated when the change materially affects state, decisions,
  risks, or next steps.

Check-type specifics:

<!-- TODO: tune per change type this project actually has, and set the UI
default below to what this project wants. -->

- **UI — flag-first, skip by default.** Do not run browser QA unsolicited. When
  a change carries real layout, interaction, responsive, or theming risk, name
  the risk and let the user decide; otherwise say why it wasn't needed. Tooling
  lives in `CLAUDE.md`.
- **Refactors:** behavior preserved, builds/tests pass, and a search confirms
  old symbols and stale paths are gone.
- **Docs-only:** verify paths, links, commands, and internal consistency; no
  runtime build unless documented behavior changed.
- **Output artifacts:** inspect the rendered artifact, not just a successful
  build. File-format work needs a real round trip plus a malformed-input
  rejection check.
- **No harness:** say so, and verify with the strongest available lightweight
  check — syntax checks, a small assembly script, or opening the local app.

## Git And Existing Work

- The working tree may contain user edits or generated output.
- Run git commands from the relevant repository root; use non-interactive flags.
- Do not stage, commit, push, amend, reset, rebase, or switch branches unless the
  user asks.
- Stage and commit `AGENTS.md` and `CLAUDE.md` like any other tracked file when
  they're part of the change; do not single them out to exclude. Keep personal
  agent state, environment configuration, and OS metadata excluded through the
  starter `.gitignore`; verify any additional local-only paths before staging.
  <!-- TODO: state whether this project tracks or ignores `CONTINUITY.md`. -->
- Never bypass hooks (`--no-verify`, `--no-gpg-sign`); fix the cause instead.
- Treat a merge or push that triggers a deploy workflow as a deploy, and get
  explicit authorization for it.
- Never revert, delete, or overwrite changes you did not make unless explicitly
  asked.
- Never force-push a shared branch or rewrite published history without an
  explicit request.
- Avoid broad cleanup, drive-by refactors, and formatting churn.
- When asked to commit, prefer one coherent commit per reviewable unit. Follow
  project-specific commit rules when present; otherwise use Conventional Commit
  subjects such as `fix(scope): preserve calendar scroll`.

## Communication

Think privately; do not print raw reasoning. Report actions, blockers,
verification performed, checks skipped, residual risks, and final outputs, and
skip preambles unless they help the user act. After material work, lead with a
brief snapshot: Goal, Now, Next, and Open Questions. Trivial questions and
one-line answers may skip the snapshot.
