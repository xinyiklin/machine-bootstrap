# Continuity Ledger — Machine Bootstrap

Scope: the portable parent guides, project templates, shared-skill manifest,
workflow foundation, and safe setup scripts in this repository. Each computer's
workspace state belongs in its parent `MACHINE.md` and local continuity ledger.

## Snapshot

- 2026-08-14 [USER+CODE] Added a portable Git/GitHub delivery baseline from
  CareFlow and RoleFit conventions: typed branches, Conventional Commits and
  squash-compatible PR titles, a reviewable PR template, exact-head merge and
  post-merge gates, release/deploy receipts, and explicit publication state.
  New projects receive a self-contained copy under
  `docs/engineering/git-workflow.md` and `.github/pull_request_template.md`;
  project commands and CI remain project-owned.
- 2026-08-13 [USER] Implementation guidance now requires the smallest
  maintainable solution, discourages narrative comments and speculative
  abstractions, and requires user approval before implementing useful ideas
  outside the requested scope.
- 2026-08-13 [USER] Every implementation now defaults to the implementer's own
  verification plus one fresh independent review. Only the user may waive that
  review for a specific change; requested additional reviewers are honored
  after a firm risk-based recommendation.
- 2026-08-13 [CODE] Product Delivery workflow 1.1.0 makes implementer diff
  review and one independent review the default, and records the Delivery
  Lead's post-review recommendation on whether additional reviewers are needed.
- 2026-08-13 [USER] Product Delivery workflow 1.2.0 keeps five standard task
  artifacts and makes Decision Log and Change Request conditional. Active work
  stays local by default; tracked continuity references require the matching
  completed task folder to be tracked too.
- 2026-08-13 [USER] Dependency versions must be established from current
  official sources rather than model memory. Prefer the latest compatible
  stable release, preserve each project's package-manager/version-range policy,
  update tracked lockfiles, and explain deliberate older or prerelease choices.
- 2026-07-27 [USER] This repository exists so the same general agent guidance
  and shared Claude Code/Codex skills can be restored on another machine.
- 2026-07-27 [CODE] The skill manifest declares eight portable skills. The
  installer adds missing canonical copies under `~/.agents/skills`, creates
  Claude Code symlinks, and rejects redundant Codex-specific copies.
- 2026-07-27 [CODE] Setup places portable parent guides without overwriting
  differences by default, creates missing machine notes, and seeds project
  templates. `--replace` creates timestamped guide backups.
- 2026-07-27 [CODE] Machine-specific paths, project maps, ports, lifecycle
  notes, and local tool preferences are intentionally excluded.
- 2026-07-27 [USER] Ownership flows from the bootstrap repository to the
  workspace guidance layer and then to self-contained child project guidance.
- 2026-07-27 [CODE] `scripts/init-workspace.mjs` is the single safe entry point:
  it rejects a Git-owned workspace root, initializes guidance and skills, and
  finishes with read-only verification. Check mode also rejects unresolved
  `MACHINE.md` placeholders.
- 2026-07-27 [CODE] Differing portable guides or templates now fail closed.
  Reviewed `--replace` operations preserve timestamped backups; `MACHINE.md`
  remains machine-owned and is never replaced.
- 2026-07-27 [CODE] Shared skills are materialized from exact reviewed Git
  revisions and portable SHA-256 content checks. Bootstrap executes no upstream
  package installer or lifecycle code.
- 2026-07-27 [TOOL] Clean-home reconstruction caught and corrected an
  Impeccable moving-branch pin; the manifest now uses the peeled 4.0.2 release
  commit whose Git subtree exactly matches the reviewed installed content.
- 2026-07-27 [CODE] Skill integrity ordering is deterministic UTF-8 byte order
  rather than host locale order, and every directory entry—including OS
  metadata and injected empty directories—is covered by the reviewed hash.
  Empty directories carry their own record, which a reviewed Git tree can never
  contain, so the eight pinned hashes were unaffected by closing that gap.
- 2026-07-27 [CODE] Skill acquisition runs Git non-interactively
  (`GIT_TERMINAL_PROMPT=0`, no inherited stdin), so an unreachable or private
  repository fails fast instead of blocking unattended setup on a credential
  prompt. Inherited askpass programs and credential helpers are also disabled;
  Git errors name the real subcommand rather than a leading `-C`.
- 2026-07-27 [CODE] Initialization treats the checkout's direct parent as the
  workspace and rejects the filesystem root or user home before any writes.
- 2026-07-27 [CODE] Setup validates `MACHINE.md` before any workspace writes.
  New-project templates include a baseline `.gitignore` for personal agent
  state, environment configuration, and OS metadata.
- 2026-07-27 [CODE] Known argument, prerequisite, manifest, and hash-report
  failures now report concise messages instead of raw stacks, including
  `setup-guides.mjs` argument errors, an uninstalled `--print-hashes` roster,
  invalid manifest data, wrong-typed portable sources, and missing Git.
- 2026-07-27 [CODE] A canonical skill directory without `SKILL.md` fails closed
  before any network fetch, with a message naming the path to review, rather
  than surfacing "destination appeared during setup" after fetching sources.
- 2026-07-27 [CODE] A skill root that exists as a non-directory is rejected with
  a named path before any fetch or link, instead of raising `ENOTDIR` from
  `lstat`; a non-directory ancestor now reads as "entry absent". SUPERSEDED
  below: that check first used `lstat` and wrongly rejected a symlinked root.
- 2026-07-27 [CODE] Skill roots and skill directories are resolved with `stat`,
  so a root or a skill relocated behind a symlink stays supported while a
  regular file in either position is still rejected. Entries inside a skill are
  unchanged: they are still recorded as links, not as their targets.
- 2026-07-27 [TOOL] A disposable-home end-to-end install fetched, hash-verified,
  and linked all eight skills, and the follow-up `--check` passed.
- 2026-07-27 [CODE] Workspace destinations are classified before comparison, so
  a wrong-typed, symlinked, or unreadable guide reports its actual condition
  instead of "differs", and an unreadable directory no longer raises `EACCES`
  from `readdir`. Reviewed `--replace` still recovers by backing the entry up.
  SUPERSEDED below on symlinks: classification first used `lstat`, so a
  byte-identical symlinked guide could never pass `--check`.
- 2026-07-27 [CODE] Workspace guides are compared through symlinks, because the
  content an agent loads at that path is what the check is about. A symlinked
  guide matching its portable source verifies as current; drifted, broken, and
  wrong-typed links each report their own condition. Placement still renames
  the existing entry to a backup before writing, so a link target is never
  written through — covered by a test that asserts the external file survives.
- 2026-07-27 [CODE] Guide and template placement share one `place()` helper, and
  presence checks use `lstat` so a dangling symlink is not written through.
- 2026-07-27 [CODE] A reviewed-hash mismatch names any stray OS metadata found
  in the skill directory; the hash still covers every entry, unchanged by D007.
- 2026-07-27 [CODE] Post-install verification covers newly installed skills
  only; already-present skills are verified once per run instead of hashed
  twice. Roster size is derived from the manifest in tests rather than pinned.
- 2026-07-27 [TOOL] Running the suite against a disposable home showed five
  checks failing with raw `ENOENT` before the first install, including three
  added during this review. Those checks read the machine's own installed
  roster; they now skip with a named reason and a rerun instruction, so the
  documented verification command works on a fresh machine without hiding
  coverage.
- 2026-07-27 [CODE] Skill-manifest parsing and validation have one shared owner
  used by initialization and installation. Invalid JSON, invalid entries, and
  wrong-typed portable sources now fail before any workspace write, without a
  raw runtime stack.
- 2026-07-27 [CODE] Missing-skill installation atomically claims each
  destination directory before adding it to rollback state. A path that appears
  concurrently is rejected and never removed as if the bootstrap created it.
- 2026-07-27 [CODE] New workspace files use exclusive creation and template
  directories are atomically claimed before copying. A guide, machine file, or
  template path that appears during setup is never overwritten or written
  through.
- 2026-07-31 [USER] The bootstrap now also owns a portable, provider-neutral
  product-to-delivery workflow: Product Partner (why and what), Delivery Lead
  (how and delivery), and Verifier (independent evidence), with two distinct
  exact-version user approval gates.
- 2026-07-31 [CODE] `workflows/registry.json` names the installed packages
  explicitly; nothing is discovered by scanning directories. The
  `product-delivery` package carries `manifest.json` (schema 1, version 1.0.0),
  `WORKFLOW.md`, three role contracts, and seven artifact templates.
- 2026-07-31 [CODE] Provider adapters are generated from the Markdown role
  contracts rather than maintained separately: Claude subagents in
  `$CLAUDE_CONFIG_DIR/agents/mb-*.md` when set (otherwise
  `~/.claude/agents/mb-*.md`), Codex agents in `$CODEX_HOME/agents/mb_*.toml`
  when set (otherwise `~/.codex/agents/mb_*.toml`), and Codex profiles following
  the same `$CODEX_HOME` default. Each carries provenance naming its source
  contract and pins no model.
- 2026-07-31 [TOOL] Provider formats were verified against current official
  documentation before implementation: Claude Code requires only `name` and
  `description` frontmatter and runs a session-wide agent through
  `claude --agent`; Codex custom agents require `name`, `description`, and
  `developer_instructions`, and profiles are separate
  `$CODEX_HOME/<name>.config.toml` files activated with `codex --profile`. The
  legacy `[profiles.x]` table form is not used.
- 2026-07-31 [CODE] `scripts/install-workflows.mjs` validates every manifest and
  source, stages generated adapters in a temporary directory, preflights all
  destinations, and only then writes. It owns exactly its namespaced paths and
  never reads or writes `settings.json` in the Claude configuration root or
  `config.toml` in the Codex home.
- 2026-07-31 [CODE] Placement rules that guidance setup and workflow
  installation share now live in `scripts/lib/fs-safety.mjs`; the portable path
  predicate shared by reviewed skills and workflow sources lives in
  `scripts/lib/portable-path.mjs`. `setup-guides.mjs` behavior is unchanged.
- 2026-07-31 [CODE] The project template no longer ignores all of `.claude/`.
  It excludes `CLAUDE.local.md`, `.claude/settings.local.json`, and
  `.agent-work/`, so a project can track `.claude/agents/`, `.claude/rules/`,
  `.claude/settings.json`, `.codex/agents/`, and `.codex/config.toml` when it
  chooses. Nothing creates those files.
- 2026-07-31 [TOOL] Environment-dependent checks now skip by name instead of
  failing: a host that cannot create symbolic links skips five checks, and a
  host that does not enforce POSIX permission bits skips one. The reviewed
  Git-tree check accepts the Windows refusal of any reviewed symlink, still
  asserting the escaping link is never materialized. Baseline confirmed these
  same seven were already failing on this host before the change.
- 2026-07-31 [TOOL] Every test that runs initialization now points `HOME` and
  `USERPROFILE` at its disposable root. An earlier run of the suite, before that
  fix, installed the workflow layer into the real user home; all twenty files
  were verified byte-identical to generated artifacts and removed, leaving
  skills and provider configuration untouched.

## Decisions

- 2026-07-27 [USER] D001 ACTIVE: portable guidance and skill setup live in this
  dedicated repository rather than a Git repository around all child projects.
- 2026-07-27 [CODE] D002 ACTIVE: `skills.json` is the desired roster; generated
  global lockfiles remain machine state and are not the portable source.
- 2026-07-27 [CODE] D003 ACTIVE: installation is missing-only. Updates and
  unexpected existing paths require review rather than silent replacement.
- 2026-07-27 [CODE] D004 ACTIVE: Impeccable installs without optional hooks;
  hooks remain an explicit per-project choice.
- 2026-07-27 [USER] D005 ACTIVE: the bootstrap repository owns AI setup and the
  portable root guidance/templates used to initialize the workspace and each
  project; projects retain their scoped product and engineering contracts.
- 2026-07-27 [CODE] D006 ACTIVE: an AI agent initiates a machine through
  `INIT.md` and `scripts/init-workspace.mjs`; silent partial synchronization is
  not considered successful setup.
- 2026-07-27 [CODE] D007 ACTIVE: the portable skill manifest pins both
  acquisition and reviewed content identity; updates require an intentional
  manifest revision rather than passing through presence-only checks.
- 2026-07-31 [USER] D008 ACTIVE: this repository owns the portable workflow
  foundation — role contracts, stages, approval and invalidation rules,
  handoffs, artifact templates, and installation. `skills.json` stays
  exclusively about reusable skills and is unchanged.
- 2026-07-31 [USER] D009 ACTIVE: project architecture, engineering rules,
  commands, and required verification remain project-owned. The workflow never
  rewrites project guidance; a project references the installed contract rather
  than copying it.
- 2026-07-31 [CODE] D010 ACTIVE: the provider-neutral Markdown role contracts
  are the single source of truth. Claude and Codex files are generated
  deterministically from them, so no separate provider prompt can drift.
- 2026-07-31 [USER] D011 ACTIVE: a project may strengthen the workflow with
  extra high-risk triggers, mandatory plan sections, required verification, or
  specialist reviews. It may not weaken exact user approval, scope-change
  escalation, or honest verification reporting.
- 2026-07-31 [CODE] D012 ACTIVE: workflow installation follows the same
  fail-closed contract as guides and skills — validate before writing,
  missing-only by default, reject differing destinations before any partial
  write, and keep timestamped backups on reviewed `--replace`.
- 2026-07-31 [CODE] D013 ACTIVE: approval recording is bookkeeping, not
  authentication. No file or command in this repository claims to prove that a
  human supplied an approval.
- 2026-08-13 [USER] D014 ACTIVE: one independent review is mandatory by default
  after implementer verification. The user may explicitly waive it per change
  or request more reviewers; additional-review recommendations are firm and
  based on risk and coverage.
- 2026-08-13 [USER] D015 ACTIVE: do not create empty task artifacts. Track the
  five standard reports for completed referenced work; create Decision Logs and
  Change Requests only when needed. A tracked `[TASK <task-id>]` continuity
  reference must not point to an untracked local task folder.
- 2026-08-13 [USER] D016 ACTIVE: dependency additions and upgrades require a
  current official-source check for the stable or maintainer-recommended
  release. Use the latest compatible stable version by default, preserve the
  project's package-manager and version-range policy, update any tracked
  lockfile, and explain any intentional older or prerelease choice.

## Working Set

- `README.md`
- `INIT.md`
- `guides/{AGENTS,CLAUDE,MACHINE.example}.md`
- `project-templates/`
- `skills.json`
- `workflows/registry.json`
- `workflows/product-delivery/{manifest.json,WORKFLOW.md,roles/,templates/}`
- `scripts/{init-workspace,install-skills,install-workflows,setup-guides,test-bootstrap}.mjs`
- `scripts/lib/{fs-safety,portable-path,skill-integrity,skill-manifest,skill-source}.mjs`
- `scripts/lib/{workflow-adapters,workflow-manifest}.mjs`

## Next

- Do not expand the workflow beyond a user's requested scope. Present useful
  follow-up recommendations and wait for approval before implementing them.
- Add a private remote only with explicit user authorization.

## Open Questions

- 2026-07-27 [USER] UNCONFIRMED which private remote will host this repository.
- 2026-07-31 [USER] RESOLVED 2026-08-13 by D015: task artifacts stay local while
  active by default. Completed task folders referenced by tracked continuity are
  tracked with it; otherwise the continuity summary is self-contained.
