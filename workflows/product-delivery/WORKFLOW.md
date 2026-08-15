# Product Delivery Workflow

Workflow id: `product-delivery` · version `1.3.0` · schema `1`

Portable, provider-neutral contract for taking work from a broad idea to
accepted delivery. Installed from the `machine-bootstrap` repository to
`~/.agents/workflows/product-delivery/`. Provider agent definitions are
generated from the role contracts in `roles/`; edit the contracts, never the
generated adapters.

## Activation

Installation makes this workflow available; it does not make the workflow
active for every project task. The workflow activates when any one condition is
true:

1. The user launches or selects the Product Partner or Delivery Lead role or
   profile.
2. The user explicitly asks to use the complete `product-delivery` workflow.
3. The task continues an active Product Brief or Delivery Plan.
4. Project guidance requires this workflow for a named class of work.

An ordinary bug fix, documentation edit, review, or maintenance task does not
activate the workflow merely because the package is installed or mentioned by
project guidance. Once activated, the complete contract applies to that task;
do not cherry-pick its artifacts, approvals, change control, or verification
rules. If required entry artifacts are missing, the selected role reports that
state and follows its documented entry condition rather than inventing them.

Selecting the Verifier is the one role-specific exception: it activates only
the independent verification portion for the supplied change. It does not
retroactively create missing discovery, approval, execution, or implementation
artifacts. Missing or ambiguous upstream artifacts remain explicit verification
limitations, while all evidence-honesty and outcome rules still apply.

## Ownership Boundary

This workflow foundation owns the **process**: role contracts, stages,
approval and invalidation rules, handoffs, artifact shapes, and verification
honesty.

Each project owns its **substance**: product behavior, architecture,
engineering rules, commands, security and privacy requirements, required
project verification, and its own specialist roles. The nearest project
`AGENTS.md` and its owning documentation govern work inside that project.

A project may **strengthen** this workflow — additional high-risk triggers,
mandatory Delivery Plan sections, required project verification, required
specialist reviews. A project must not **weaken** the foundational rules
below: exact user approval, scope-change escalation, and honest verification
reporting are not negotiable locally.

This workflow never rewrites a project's architecture or guidance.

## Roles

| Role | Owns | Does not own |
| :--- | :--- | :--- |
| **Product Partner** | Why and what: problem, workflow, requirements, constraints, non-goals, acceptance criteria, Product Brief, Decision Log, alignment review | Technical architecture, implementation, approving scope on the user's behalf |
| **Delivery Lead** | How and delivery: repository investigation, technical design, Delivery Plan, execution, delegation, integration, Implementation Report | Redefining product scope, self-approving its own plan |
| **Verifier** | Independent evidence: acceptance-criteria validation, regression inspection, honest pass/fail/unverified/skipped reporting | Redesigning the feature, editing application source |

"Consultant" and "orchestrator" describe how these roles feel in use. They are
not the role names. Use Product Partner, Delivery Lead, and Verifier.

## Stages

When the complete discovery-to-delivery flow is active, the stages are:

1. **Product discovery** — Product Partner explores the real problem with the
   user.
2. **Product Brief drafting** — Product Partner writes the brief.
3. **Product Brief approval** — the user approves an exact brief version.
4. **Repository investigation** — Delivery Lead inspects the actual code.
5. **Delivery Plan creation** — Delivery Lead writes an implementation-ready
   plan.
6. **Alignment review** — Product Partner checks the plan against the approved
   brief.
7. **Delivery Plan approval** — the user approves an exact plan version.
8. **Execution** — Delivery Lead implements, delegating where it helps.
9. **Verification** — after self-verification, Delivery Lead delegates at least
   one independent review unless the user explicitly waives it for this change.
10. **User acceptance** — the user accepts, or returns the work.

Small work may move quickly through these stages, but no stage is skipped
silently. If a stage is compressed, say so.

## The Two Approval Gates

They are different approvals and are never merged.

**Product Brief approval** means: *"This exact version accurately describes the
problem, intended workflow, requirements, constraints, non-goals, and
acceptance criteria."* It approves no technical design.

**Delivery Plan approval** means: *"This exact version and its technical
approach, phases, tradeoffs, risk treatment, and verification strategy are
approved for execution."* It authorizes implementation only within the
approved scope.

When requesting approval, present the artifact identity and version, then ask
for approval of that exact version. A summary may help the user read it; the
summary never replaces the artifact.

## Foundational Invariants

1. Approval applies only to the exact identified artifact version.
2. An agent's statement that the user approved something is not itself user
   approval.
3. Approval of a Product Brief does not approve a Delivery Plan.
4. Changing an approved Product Brief invalidates dependent Delivery Plans and
   any execution authorization derived from them.
5. Changing an approved Delivery Plan invalidates its previous execution
   authorization.
6. The Delivery Lead may make ordinary internal technical decisions that do not
   alter approved product behavior or scope.
7. A discovery that changes user-facing behavior, weakens an acceptance
   criterion, materially expands scope, creates destructive migration risk, or
   introduces a new security or privacy implication requires a structured
   Change Request.
8. Delegating work does not transfer accountability away from the Delivery
   Lead.
9. Verification distinguishes passed, failed, unverified, and skipped checks.
   Missing evidence is never reported as a successful result.
10. The full Product Brief and Delivery Plan remain authoritative. Summaries
    may assist the user but never replace the source artifact.
11. Every implementation receives the implementer's own verification and one
    independent review by default. Only the user may waive that review for a
    specific change.

These are process and authority rules, not authentication. No local file, CLI
command, or artifact field proves that a human supplied an approval. Recording
an approval is bookkeeping for humans reading the artifact later; it is not
evidence, and no agent should treat it as such.

## Change Requests

When invariant 7 triggers, stop and write a Change Request rather than
absorbing the change quietly. It states the discovery, the affected acceptance
criteria, why the approved approach is insufficient, the available options and
their tradeoffs, the Delivery Lead's recommendation, the Product Partner's
assessment, and the exact decision required from the user.

After the user decides, update the affected artifact, bump its version, and
re-request approval of the exact new version. Invariants 4 and 5 apply.

## Delegation

Specialist agents are an optional inner mechanism. The Delivery Lead decides
whether delegation materially helps, gives each specialist a bounded
assignment with clear ownership and required evidence, avoids overlapping file
ownership where practical, inspects what comes back, and integrates it.

A specialist saying "done" is not evidence. The Delivery Lead inspects the
actual result.

The outer handoff between roles is the shared versioned artifacts, not
automatic inter-agent messaging.

## Verification Expectations

Every implementation receives the Delivery Lead's own verification and at least
one independent Verifier review before it is called merge-ready or complete.
The Delivery Lead's verification includes inspecting the complete diff for
correctness, regressions, maintainability, unintended scope, and unrelated
changes. The independent reviewer must not have implemented the change and must
inspect the actual diff and verification evidence rather than accept the
implementation report at face value.

The user may explicitly waive independent review for a specific change. Record
the waiver and its reason; missing independent evidence remains waived, not
passed.

The user may request additional independent reviewers. After the mandatory
review, the Delivery Lead gives a firm recommendation on whether another review
is warranted, based on risk, changed surfaces, unresolved uncertainty, and the
coverage already obtained. Honor the user's request even when the recommendation
is that another review is optional. Record the recommendation in the Verification
Report. Do not add reviewers without a material reason or a user request.

The Verifier normally does not edit application source. It returns its report
to the Delivery Lead, which remains responsible for recording the final
Verification Report.

## Artifacts

Templates live in `~/.agents/workflows/product-delivery/templates/`.

| Artifact | Owner | Template |
| :--- | :--- | :--- |
| Product Brief | Product Partner | `product-brief.md` |
| Decision Log | Product Partner | `decision-log.md` |
| Delivery Plan | Delivery Lead | `delivery-plan.md` |
| Alignment Review | Product Partner | `alignment-review.md` |
| Change Request | Delivery Lead drafts, Product Partner assesses | `change-request.md` |
| Implementation Report | Delivery Lead | `implementation-report.md` |
| Verification Report | Verifier drafts, Delivery Lead records | `verification-report.md` |

The seven templates are a library, not a requirement to create seven files.
An activated task that runs the full discovery-to-delivery sequence normally
uses Product Brief, Delivery Plan, Alignment Review, Implementation Report, and
Verification Report. Create a Decision Log only for material product decisions
and a Change Request only when its trigger occurs. Never create empty
placeholder artifacts. Ordinary work outside this workflow creates none of
these artifacts by default.

The default location for task artifacts is `.agent-work/tasks/<task-id>/`
inside the project. Keep active artifacts local by default; the starter project
`.gitignore` excludes `.agent-work/`.

When a project tracks its agent guidance/configuration and `CONTINUITY.md`, it
removes that ignore rule and also tracks each completed
`.agent-work/tasks/<task-id>/` directory referenced by that continuity ledger.
Use `[TASK <task-id>]` in the continuity entry. Never commit a continuity link
to an unavailable local artifact; if task artifacts remain local, make the
durable continuity summary self-contained.

Artifact versions are simple and monotonic: `v1`, `v2`, `v3`. Status is one of
`draft`, `awaiting approval`, `approved`, or `superseded`.

## Provider Notes

The workflow does not depend on any orchestration service, agent-team feature,
inter-session messaging, or model choice. Role contracts are the source of
truth; provider agent definitions are generated from them.

Launch instructions for each provider are documented in the `machine-bootstrap`
`README.md`, because they are installation facts rather than workflow rules.
