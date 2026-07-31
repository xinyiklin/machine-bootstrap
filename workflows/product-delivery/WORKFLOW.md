# Product Delivery Workflow

Workflow id: `product-delivery` · version `1.0.0` · schema `1`

Portable, provider-neutral contract for taking work from a broad idea to
accepted delivery. Installed from the `machine-bootstrap` repository to
`~/.agents/workflows/product-delivery/`. Provider agent definitions are
generated from the role contracts in `roles/`; edit the contracts, never the
generated adapters.

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
9. **Verification** — Verifier (or, for small changes, the Delivery Lead)
   validates against the artifacts.
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

Independent verification is strongly recommended, and a project may require it,
for: destructive operations, migrations, authentication or authorization,
sensitive-data handling, document serialization or file formats, major
persistence changes, and cross-layer workflows with substantial regression
risk.

Small and obvious changes may use Delivery Lead self-verification. Skipping
independent review is a stated choice, never a silent one.

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

The default location for task artifacts is `.agent-work/tasks/<task-id>/`
inside the project. A project decides whether those artifacts stay local or are
tracked; the starter project `.gitignore` ignores `.agent-work/` by default.

Artifact versions are simple and monotonic: `v1`, `v2`, `v3`. Status is one of
`draft`, `awaiting approval`, `approved`, or `superseded`.

## Provider Notes

The workflow does not depend on any orchestration service, agent-team feature,
inter-session messaging, or model choice. Role contracts are the source of
truth; provider agent definitions are generated from them.

Launch instructions for each provider are documented in the `machine-bootstrap`
`README.md`, because they are installation facts rather than workflow rules.
