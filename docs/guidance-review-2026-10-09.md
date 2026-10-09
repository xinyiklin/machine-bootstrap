# Guidance and setup review fixes

Date: 2026-10-09. Scope: machine-bootstrap boundary checks, generated adapters,
skill reporting, and starter/operator guidance. This receipt
contains portable source facts only, not machine inventory.

## Authorization and workflow accounting

The user asked for a review of the setup against current official provider
documentation, then said "apply the recommended fixes". Answers to follow-up
questions committed the reviewed Product Delivery 2.0.0 work first, limited
machine settings to secret deny rules and a workflow read allow rule, approved
installing the reviewed workflow afterward, and routed sibling-owned fixes to
separate sessions. The user then gave full ownership of the `CLAUDE.md`
question and of commit, push, PR, CI repair, and merge.

Classification: the full workflow activated under the `AGENTS.md` hook — the
change alters generated adapter fields, provider discovery guidance, workspace
boundary invariants, and starter guidance propagated to siblings. It ran under
the committed 2.0.0 contract with one local Implementation Plan, while the
installed contract was still 1.3.0. That mismatch is a recorded deviation, not
a waiver. No review waiver was requested.

## Findings that drove the change

| Source fact | Change |
| :--- | :--- |
| Claude Code 2.1.277+ reads `AGENTS.md` natively only when no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` is on the path | Guidance no longer says Claude cannot read `AGENTS.md`; starters keep the thin `@AGENTS.md` adapter (D027) |
| Claude loads `CLAUDE.md`, `CLAUDE.local.md`, `.claude/CLAUDE.md`, and native `AGENTS.md`/`.claude/AGENTS.md` from every folder above its start directory | Initialization stops on those files at the workspace root and above it, plus `AGENTS.override.md` and `.claude/rules/` at the root; only a home or config-dir `.claude/CLAUDE.md` (user memory) is exempt, and an uninspectable path fails closed |
| Claude subagents support `disallowedTools` | The generated Claude Verifier removes `Edit`, `Write`, `NotebookEdit`; workflow 2.1.0 |
| Codex custom agents support `sandbox_mode`, but read-only blocks writing test fixtures | Codex Verifier keeps the inherited sandbox |
| Codex discovers every skill in the shared root; Claude sees only bootstrap links | Skill install and check report unmanaged entries without failing |
| Shorter context files are followed more reliably and cost less (arXiv 2602.11988; Claude memory guidance) | Starter `AGENTS.md` trimmed and reordered |
| Claude reads outside the working directory only with approval; deny rules cover its file tools | README documents recommended user permission rules; installers still never edit `settings.json` |

## Decision: keep `CLAUDE.md`

Retiring the adapter would make Claude depend on native `AGENTS.md` reading,
which any `CLAUDE.local.md` (a documented starter option) or ancestor
`CLAUDE.md` silently disables, which some sessions and versions lack, and which
skips `InstructionsLoaded` hooks. The single import never loads `AGENTS.md`
twice. Moving Claude-only mechanics into `AGENTS.md` would also put them into
every Codex context. `AGENTS.md` therefore stays the only shared policy and
`CLAUDE.md` holds only the import plus Claude-specific mechanics.

## Verification

- Full suite with the external TOML parser (Python 3.13 `tomllib`): all passed,
  none skipped. New tests cover root and ancestor guidance (both modes, home
  `CLAUDE.md` and `CLAUDE_CONFIG_DIR` exemptions, uninspectable paths),
  tool-restriction validation and generation, unmanaged skill reporting, the
  native-loading model, and guidance wording.
- `git diff --check`: clean.
- Runtime provider behavior (Claude native loading, Verifier tool removal) is
  documented but unverified by the static suite; see
  `docs/guidance-loading-smoke.md`.
- Independent review and publication evidence are recorded in the pull request
  and the local task plan, because this receipt is part of the diff they cover.

Existing project-owned starters are not synchronized. Sibling-owned guidance
findings are routed to sessions in those projects.
