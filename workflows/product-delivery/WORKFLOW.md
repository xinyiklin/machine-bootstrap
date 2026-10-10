# Product Delivery Workflow

Workflow id: `product-delivery` · version `2.0.0` · schema `1`

Portable, provider-neutral contract for taking work from a request to accepted
delivery through one living Implementation Plan. Installed from the
`machine-bootstrap` repository to `~/.agents/workflows/product-delivery/`.
Provider agent definitions are generated from the role contracts in `roles/`;
edit the contracts, never the generated adapters.

## Activation

Installation makes this workflow available; it does not make the workflow
active for every project task. The workflow activates when any one condition is
true:

1. The user launches or selects the Delivery Lead or Product Partner role or
   profile.
2. The user explicitly asks to use the complete `product-delivery` workflow.
3. The task continues an active Implementation Plan, or a legacy Product Brief
   or Delivery Plan from workflow 1.x.
4. Project guidance requires this workflow for a named class of work.

An ordinary bug fix, documentation edit, review, or maintenance task does not
activate the workflow merely because the package is installed or mentioned by
project guidance. Once activated, the complete contract applies to that task;
do not cherry-pick its authorization, scope-change, resumption, or
verification rules. If no plan exists, the plan owner creates one; never
backfill records as evidence of work or authorization that did not happen.

Selecting the Verifier is the one role-specific exception: it activates only
the independent verification portion for the supplied change. It does not
retroactively create a missing plan or authorization. Missing or ambiguous
required upstream records remain explicit verification limitations, while all
evidence-honesty and outcome rules still apply.

## Ownership Boundary

This workflow foundation owns the **process**: role contracts, authorization
and scope-change rules, the Implementation Plan shape, resumption, handoffs,
and verification honesty.

Each project owns its **substance**: product behavior, architecture,
engineering rules, commands, security and privacy requirements, required
project verification, and its own specialist roles. The nearest project
`AGENTS.md` and its owning documentation govern work inside that project.

A project may **strengthen** this workflow — additional activating work,
material-change triggers, required plan sections, project verification, or
specialist reviews. A project must not **weaken** the foundational rules below:
user authorization of scope, material-change escalation, independent review,
and honest verification reporting are not negotiable locally.

This workflow never rewrites a project's architecture or guidance.

## Roles

| Role | Owns | Does not own |
| :--- | :--- | :--- |
| **Delivery Lead** | The default entry point and accountable owner: clarification, repository investigation, the Implementation Plan, implementation, delegation, integration, self-verification | Authorizing scope on the user's behalf, independently verifying its own change |
| **Product Partner** | Optional specialist for broad discovery, ambiguous product goals, or product-alignment review; contributes to the same plan | Technical architecture, implementation, technical verification, approving on the user's behalf |
| **Verifier** | Independent evidence: criterion validation, regression inspection, honest passed/failed/unverified/skipped reporting | Redesigning the feature, editing application source |

The plan has exactly one active owner, normally the Delivery Lead. Other agents
return findings for the owner to integrate rather than writing competing
requirements. When the Product Partner starts a discovery task it may create
the plan and own it until it hands ownership to the Delivery Lead; record the
handoff in the plan.

## Flow

1. **Clarify and investigate** — the plan owner asks questions whose answers
   materially affect the work and inspects the repository, in whatever order
   helps. A complete interview is not a prerequisite for investigation.
2. **Plan** — write the Implementation Plan in proportion to the task.
3. **Confirm authorization** — identify the authorization that covers the
   plan's scope, or present the plan and ask for it.
4. **Implement** — execute phases, delegate where it helps, and keep the plan's
   execution record and checkpoint current.
5. **Self-review** — the implementer reviews the complete diff and runs the
   appropriate checks.
6. **Independent verification** — at least one fresh Verifier reviews the
   actual change unless the user explicitly waives it for this change.
7. **User acceptance** — the user accepts, or returns the work.

Small work may compress these steps into a short plan and a short report, but no
step is skipped silently. If one is compressed, say so.

## Authorization And Scope

The plan separates two things:

- **Authorized scope** — the goal, required behavior, constraints, preserved
  behavior, non-goals, acceptance criteria, and material choices the user has
  settled. It carries a lightweight scope revision (`r1`, `r2`, …) and the
  source of the authorization that covers it.
- **Execution record** — findings, approach, progress, internal technical
  decisions, verification evidence, and the checkpoint. Routine updates to it
  never invalidate authorization and never trigger another approval request.

Authorization comes only from the user. Honor authorization already present in
the conversation: a request to implement a described change authorizes that
scope, and writing it into the plan does not require the user to approve the
same work again. Authorization covers what the user described and the
non-material detail needed to deliver it. Record that detail — criteria or
behavior the plan adds beyond the user's words — as `assumption` items; work
may proceed on them, and they stay open to correction without blocking. An
addition that would be a material change is a proposal, not part of the
baseline, until the user decides. A request to plan first, or for a plan alone,
does not authorize implementation; present the plan and wait. One
authorization covers the plan's scope; never split it into separate approvals
of different sections.

A **material change** is a discovery or proposal that would change agreed
behavior, weaken or reinterpret an acceptance criterion, expand scope, create
destructive migration risk, or introduce a new security or privacy
implication. For a material change:

1. Record it as a proposal, separate from the authorized baseline.
2. Present the concrete choice — options, consequences, and a recommendation —
   and obtain the user's decision before the affected action.
3. Pause dependent work; continue independent work that remains authorized.
4. After the decision, update the baseline, increment the scope revision, keep
   the prior criterion wording readable, and record the decision and its
   source.

Silence, an artifact status, a checked box, or an agent's assertion is never
user approval. In the plan, distinguish confirmed requirements (`user`),
observed repository facts (`repo`), reversible working assumptions
(`assumption`), and unresolved decisions (`open`).

## Foundational Invariants

1. Implementation requires the user's authorization of its scope.
2. An agent's statement that the user approved something is not approval.
3. A plan-only request, or an approved legacy Product Brief alone, never
   authorizes implementation.
4. Routine execution-record updates never invalidate authorization.
5. A material change requires the user's decision before the affected action.
6. The plan owner may make internal technical decisions within the authorized
   scope.
7. Delegation never transfers accountability away from the plan owner.
8. Verification distinguishes passed, failed, unverified, and skipped checks.
   Missing evidence is never reported as a successful result.
9. The Implementation Plan is the authoritative task record. Summaries and
   optional artifacts may assist but never replace it or compete with it.
10. Every implementation receives the implementer's own verification and one
    fresh independent review by default. Only the user may waive that review
    for a specific change.

These are process and authority rules, not authentication. No local file, CLI
command, or artifact field proves that a human supplied an approval. Recording
an authorization is bookkeeping for humans reading the plan later; it is not
evidence, and no agent should treat it as such.

## Clarification

Ask when the answer materially affects the work — during planning or during
implementation. Do not repeat a question the user already answered or reliable
repository evidence settles. Record answers and working assumptions in the
plan with their sources so later phases and resumed sessions do not ask again.

## Resumption And Checkpoints

Consult the plan before starting a new phase, before delegating, when resuming
interrupted work, and before final self-review and independent verification.

Update the checkpoint after a meaningful discovery or milestone and before a
handoff or a known context reset. It names completed work with its evidence,
current work, blockers, open questions, the next concrete action, repository
state (branch, commit, working-diff summary), and pending review findings.

To resume, read the plan and applicable project guidance, then inspect the
actual branch, commit, and working diff. Reconcile them with the checkpoint and
continue the next unfinished action. Do not restart discovery automatically.
A checked box is a claim, not proof of completion; confirm it against the
repository and its evidence.

## Delegation

Specialist agents are an optional inner mechanism. The plan owner decides
whether delegation materially helps, consults the plan first, gives each
specialist a bounded assignment with clear ownership and required evidence,
avoids overlapping file ownership where practical, inspects what comes back,
and integrates it into the plan and the change.

A specialist saying "done" is not evidence. The plan owner inspects the actual
result. The handoff between roles is the shared plan, not automatic
inter-agent messaging.

## Verification Expectations

Every implementation receives the implementer's own verification and at least
one independent Verifier review before it is called merge-ready or complete.
The implementer's verification includes inspecting the complete diff for
correctness, regressions, maintainability, unintended scope, and unrelated
changes. The independent reviewer must not have implemented the change. It
inspects the actual change, the authorized criteria, the decision history, and
the evidence rather than accepting implementer claims, which never establish an
independent pass.

Record the repository state each review covered. A later implementation change
needs appropriate follow-up checks and review; an earlier pass does not cover a
new diff. Product Partner alignment review never replaces technical
verification.

The user may explicitly waive independent review for a specific change. Record
the waiver and its reason; missing independent evidence remains waived, not
passed.

The user may request additional independent reviewers. After the first
independent review, the plan owner gives a firm recommendation on whether
another reviewer is warranted, naming the remaining risk or coverage gap, and
records it in the Verification Report. Honor the user's request even when the
recommendation is that another review is optional. Do not add reviewers
without a material reason or a user request.

The Verifier normally does not edit application source. It returns its report
to the plan owner, which records the final Verification Report.

## Artifacts

Templates live in `~/.agents/workflows/product-delivery/templates/`.

| Artifact | Owner | Template | Use |
| :--- | :--- | :--- | :--- |
| Implementation Plan | Plan owner | `implementation-plan.md` | Normal |
| Verification Report | Verifier drafts, plan owner records | `verification-report.md` | Normal |
| Implementation Report | Plan owner | `implementation-report.md` | Optional |
| Alignment Review | Product Partner | `alignment-review.md` | Optional |
| Decision Log | Plan owner | `decision-log.md` | Optional |
| Change Request | Plan owner | `change-request.md` | Optional |

A full-workflow task normally creates only the Implementation Plan and the
Verification Report. Create an optional artifact only when it adds useful
detail, and link it from the plan; it never restates or overrides the plan's
requirements. Never create empty placeholder artifacts. Ordinary work outside
this workflow creates none of these artifacts by default. Keep the plan
proportional; link detailed evidence rather than copying it.

`product-brief.md` and `delivery-plan.md` remain only as deprecated redirects
for installations upgraded from 1.x.

The default location for task artifacts is `.agent-work/tasks/<task-id>/`
inside the project. Keep active artifacts local by default; the starter project
`.gitignore` excludes `.agent-work/`.

When a project tracks its agent guidance/configuration and `CONTINUITY.md`, it
removes that ignore rule and also tracks each completed
`.agent-work/tasks/<task-id>/` directory referenced by that continuity ledger.
Use `[TASK <task-id>]` in the continuity entry. Never commit a continuity link
to an unavailable local artifact; if task artifacts remain local, make the
durable continuity summary self-contained.

## Legacy 1.x Tasks

Completed 1.x artifacts are historical records; leave them unchanged. When an
active 1.x task resumes, the plan owner consolidates the existing intent,
authorization, questions, decisions, and evidence into a new
`implementation-plan.md` and links the originals as historical references.
Resolve material conflicts between them with the user before dependent work.
A Delivery Plan version the user approved under 1.x that was still in force —
not superseded and not invalidated by a later change to it or its brief —
carries forward as authorization for exactly that scope; if the record is
ambiguous, ask the user. An approved Product Brief alone never authorizes
implementation.

## Provider Notes

The workflow does not depend on any orchestration service, agent-team feature,
inter-session messaging, or model choice. Role contracts are the source of
truth; provider agent definitions are generated from them.

Launch instructions for each provider are documented in the `machine-bootstrap`
`README.md`, because they are installation facts rather than workflow rules.
