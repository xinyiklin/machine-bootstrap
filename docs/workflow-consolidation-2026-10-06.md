# Product Delivery 2.0.0 consolidation

Date: 2026-10-06. Scope: the portable `product-delivery` workflow package and
the guidance that describes it. This receipt contains portable source facts
only, not machine inventory.

## Authorization and workflow accounting

The user requested, in the session, a scoped consolidation of the separate
Product Brief and Delivery Plan into one living Implementation Plan, explicitly
replacing the old separate brief and plan approval gates. That request
authorized implementation of the described scope and kept all changes local;
commit, push, PR, merge, and real global installation were not authorized.

Classification: the full workflow activated under the `AGENTS.md`
product-delivery hook because the change alters workflow approval, delegation,
and review policy, generated instruction meaning, and guidance propagated into
sibling projects. It ran under the requested 2.0.0 model: one Implementation
Plan kept locally under `.agent-work/`, one authorization from the user's
request, and no separate gates. No review waiver was requested.

## Outcome

| Area | Result |
| :--- | :--- |
| Workflow contract | Delivery Lead is the default entry and plan owner; authorized scope is separate from the execution record; material changes need a user decision; clarification and resumption rules are explicit |
| Roles and templates | Product Partner is optional and contributes to the same plan; Verifier semantics preserved; Implementation Plan is new; other templates are optional; `product-brief.md` and `delivery-plan.md` remain as deprecated redirects because the installer never deletes undeclared files |
| Compatibility | Role ids, agent names, and profiles unchanged; manifest schema, provider formats, and model settings unchanged; version 1.3.0 → 2.0.0 |
| Upgrade path | Default install refuses before writing; reviewed `--replace` backs up every replaced file; repeated replacement is idempotent |

## Verification

The regression suite passes with the TOML parser check enabled, and
`git diff --check` is clean. `node scripts/init-workspace.mjs --check` fails on
this machine only because the real installation is still 1.3.0; every
installed file matched the 1.3.0 sources, so the drift is the version delta.
Live Claude and Codex behavior under the new contracts is unverified.

The installed `mb-verifier`, which did not implement the change, reviewed it
independently in three passes on working trees over `55d9b10`:

| Pass | Reviewed diff (sha256 of `git diff`) | Outcome |
| :--- | :--- | :--- |
| 1 | `a51b62cc…aae2` | No failed criterion; authorization-wording, test, and documentation findings |
| 2 | `dd0a49a5…d82f` | Fixes confirmed; two low findings |
| 3 | `3b9f0b71…efeef` | Nine implementer self-review fixes confirmed; seven low wording, test, and receipt findings |

Each pass's overall result was **incomplete verification**, not a pass: the
real-installation check cannot pass before the user's reviewed upgrade, and
live provider behavior is untested. No pass found a failed criterion or a
regression, and none recommended an additional reviewer. The third pass's
findings were then fixed and that final diff re-checked independently (suite,
`git diff --check`, and an authorization-guard probe). That last record lives
in the local task plan rather than here, because this receipt is part of the
diff it covers.

The repository's `.gitignore` now excludes `.agent-work/`, matching project
starters, so the local task plan cannot be committed by accident. The user may
revert that line if they prefer to track task artifacts.

Existing project-owned starters are not synchronized. Active 1.x task
artifacts in projects are consolidated into an Implementation Plan when their
task resumes.
