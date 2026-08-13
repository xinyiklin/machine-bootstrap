# Parent Workspace Agent Guide

Portable, provider-agnostic working agreements for coding agents working in
projects beneath the directory containing this file.

This guide is installed and maintained from the workspace's bootstrap
repository. It owns general working standards and the convention for creating
child project guides. `MACHINE.md`, when present beside it, owns local paths,
project inventory, port reservations, cross-project links, and
machine-specific tool facts. A child project's nearest current `AGENTS.md` and
product/engineering documentation govern that project.

## Ownership Hierarchy

1. The bootstrap repository owns AI setup, the shared-skill roster, the
   portable source for this guide, and the templates used to initialize project
   guidance.
2. The workspace root owns shared routing and operating rules through
   `AGENTS.md`, `CLAUDE.md`, `MACHINE.md`, and `_templates/`. It does not need
   to be a Git repository.
3. Each child project owns its self-contained product, architecture, commands,
   safety invariants, and verification contracts.

Initialization flows from bootstrap to workspace to project. During project
work, the nearest current scoped guidance wins. Change the portable baseline in
the bootstrap source and then sync it here; keep machine-only facts in
`MACHINE.md`.

## Instruction Precedence

1. The user's current request.
2. Safety, data integrity, secret handling, and truthful claims.
3. The nearest current project or scoped guide and its owning documentation.
4. This portable guide.
5. `MACHINE.md` for local workspace facts only.
6. Durable facts in the nearest `CONTINUITY.md`, over older chat context.
7. Existing architecture and conventions.

Correctness, security, privacy, and factual accuracy outrank stylistic
consistency. Supersede stale guidance when ownership or durable contracts
change.

## Guidance Convention

- `AGENTS.md` is the provider-agnostic source of truth.
- `CLAUDE.md` is a thin Claude Code overlay.
- `MACHINE.md` contains local facts and must never contain secrets.
- `CONTINUITY.md` is read fresh and records durable handoff state.
- `CLAUDE.local.md`, when supported, holds uncommitted personal overrides.
- `_templates/` contains inert starter files for new projects.

Keep root guides as routers. Put product purpose in `PRODUCT.md`, visual
contracts in `DESIGN.md`, detailed engineering contracts in `docs/` or nested
guides, and local machine facts in `MACHINE.md`. Avoid duplicating an owning
document.

Target roughly 200 lines per imported guide. A child guide must be
self-contained because it may be cloned without this parent workspace.

## Product Delivery Workflow

The bootstrap repository also owns a portable workflow foundation, installed at
`~/.agents/workflows/product-delivery/`. Read its `WORKFLOW.md` for the full
contract; this section is only the routing.

- The **Product Partner** owns why and what: problem, workflow, requirements,
  constraints, non-goals, acceptance criteria, and the Product Brief.
- The **Delivery Lead** owns how and delivery: repository investigation,
  technical design, the Delivery Plan, execution, and integration.
- The **Verifier** independently checks the result against those artifacts and
  reports passed, failed, unverified, and skipped checks honestly.

After the implementer's own verification, at least one fresh independent review
is required by default. Only the user may waive it for a specific change. The
user may request more reviewers; after the mandatory review, give a firm
risk-based recommendation on whether another review adds useful coverage.

Two approvals are distinct and both require the user's explicit approval of an
exact artifact version: the Product Brief approves the problem and criteria,
never a design; the Delivery Plan approves the technical approach and
authorizes execution within that scope only. A discovery that changes
user-facing behavior, weakens a criterion, expands scope, risks destructive
migration, or adds a security or privacy implication requires a Change Request.

Projects own their architecture and may add stricter workflow requirements in
their own `AGENTS.md`; they may not weaken these approval rules. Provider
subagents and profiles are generated adapters and optional implementation
details — the handoff between roles is the shared versioned artifacts.

## Bootstrapping A Project

1. Read the real manifests, configs, entry points, and existing directories.
2. Copy `_templates/AGENTS.md` and `_templates/CLAUDE.md` into the project root.
   For a new repository, also copy `_templates/.gitignore`; for an existing
   repository, merge its safety entries without discarding project exclusions.
3. Replace placeholders with verified facts; remove irrelevant sections.
4. Record identity, guidance ownership, hard invariants, layout, commands,
   verification, continuity, Git conventions, and definition of done.
5. Consult `MACHINE.md` before claiming ports or adding workspace-level links.
6. Keep provider-specific tooling in `CLAUDE.md`.

Do not copy another project's architecture, tokens, commands, or privacy rules.
Project-specific invariants belong in that project's guide.

## Start Of Task

Before changing code or project files:

1. Read the nearest `CONTINUITY.md`, `AGENTS.md`, provider overlay, README, and
   relevant product or engineering documentation.
2. Read `MACHINE.md` only when routing, ports, paths, sibling relationships, or
   local tools matter.
3. Define the goal, acceptance criteria, scope, and constraints.
4. Inspect the actual files, callers, state owner, side effects, and consumers.
5. Check repository status and preserve unrelated user work.
6. Establish current authoritative facts when recency matters.
7. For non-trivial work, state a compact plan and meaningful verification.
8. Ask only when ambiguity could cause a materially different or irreversible
   result; otherwise make a bounded assumption and proceed.

## Engineering Principles

- Write the smallest maintainable change that fully solves the request; avoid
  speculative abstraction, configuration, and future-proofing.
- Keep implementation scope literal. If an extra improvement or recommendation
  is not required by the request, present it to the user and wait for approval
  before implementing it.
- Prefer existing patterns, naming, framework choices, and helper APIs.
- Keep edits surgical and remove only cleanup caused by the change.
- Diagnose root causes before patching symptoms.
- Define success in verifiable terms and use failures as evidence.
- Do not add silent fallbacks, empty catches, or error swallowing.
- Ask before adding dependencies or changing public schemas, deployment,
  authentication, paid services, or production infrastructure.
- Before adding or upgrading a dependency, inspect the project's runtime,
  manifest, lockfile when present, compatibility constraints, and versioning
  policy. Verify the current stable or maintainer-recommended release from an
  official registry, documentation, or release notes; never select a dependency
  version from model memory alone.
- Prefer the latest compatible stable release. Preserve the project's package
  manager and version-range policy, update its lockfile when the project tracks
  one, and explain any deliberate use of an older or prerelease version.
- Design UI for the user and workflow, not the storage schema.

### Modularity And Reuse

- Find the current owner before adding a type, constant, transform, option
  list, state field, component, or style rule.
- Extract by responsibility, not line count. Useful seams isolate domain logic,
  side effects, volatile integrations, or focused test surfaces.
- Keep state close to its owner, derive instead of synchronizing copies, and
  keep dependency direction acyclic.
- Shared code must not absorb host state or product language merely because two
  call sites look similar.
- Reuse must preserve validation, accessibility, error reporting, privacy, and
  determinism for every consumer.
- Treat files around 300 lines as a cohesion prompt, not an automatic split.
- Comment only when it explains non-obvious rationale, constraints, or safety;
  do not narrate self-explanatory code. Durable rationale belongs in the owning
  guide.

## Accuracy And Privacy

- Prefer primary sources for current APIs, releases, standards, security,
  compatibility, legal, medical, or financial information.
- Never invent metrics, dates, employers, education, skills, project scope, or
  outcomes. Use `UNCONFIRMED` or ask when facts are missing.
- Read complete source material before drafting from documents or datasets,
  then re-check the result for invented or distorted claims.
- Treat resumes, job-search content, health-style records, session logs, saved
  workspaces, and provider responses as personal data.

## Safety

- Never print or commit secrets, credentials, private keys, broad environment
  dumps, personal documents, `node_modules`, or generated private artifacts.
- Remote operations are read-only unless the user explicitly authorizes the
  write. Treat a push that triggers deployment as a deployment.
- Resolve exact targets before deletion or overwrite, prefer recoverable
  operations, and never destroy unrelated work.
- Pause before bulk deletion, history rewriting, schema/data drops,
  infrastructure changes, auth changes, or paid/vendor dependencies.
- Never install host-level system packages without explicit authorization.

## Verification

Run the narrowest owner-level check while iterating, then affected consumer
checks in proportion to blast radius.

- Claims of completion require fresh evidence from the relevant command or
  rendered result.
- Shared-package changes require checks for the package and affected consumers.
- Refactors require behavior checks plus searches for stale symbols and paths.
- Docs-only work requires path, link, command, and consistency checks.
- PDF, print, exported-file, and generated-asset work requires rendered output
  inspection; file formats require round trips and malformed-input rejection.
- When no harness exists, use the strongest lightweight check and say what
  remains untested.

Browser QA is flag-first by default. Do not start a server or browser
unsolicited. Name concrete layout, interaction, responsive, or theming risk and
let the user decide unless the project explicitly requires rendered QA for that
change type.

## Continuity

Maintain a compact `CONTINUITY.md` when the project benefits from durable
handoff state.

- Record meaningful goals, constraints, decisions, state, risks, open
  questions, working files, and important verification outcomes.
- Tag entries with ISO dates and `[USER]`, `[CODE]`, `[TOOL]`, or
  `[ASSUMPTION]`; write `UNCONFIRMED` rather than guessing.
- Keep scoped detail in the narrowest ledger and avoid transcripts or raw logs.
- Supersede changed facts explicitly and compress old detail into milestones.

## Git

- Run Git from the actual repository root with non-interactive commands.
- Do not stage, commit, push, switch branches, rewrite history, open or merge
  pull requests, or deploy unless the user asks.
- Stage exact paths, preserve unrelated changes, and never bypass hooks.
- Treat guidance and continuity like normal tracked files when the repository
  intentionally tracks them.
- Prefer coherent, reviewable commits and follow project-specific conventions.

## Communication

Report actions, blockers, verification, skipped checks, residual risks, and
final outputs. Keep trivial answers brief. After material work, make the
current outcome and next meaningful action easy to find.
