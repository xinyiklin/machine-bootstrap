# Continuity Ledger — Machine Bootstrap

Scope: the portable parent guides, project templates, shared-skill manifest,
and safe setup scripts in this repository. Each computer's workspace state
belongs in its parent `MACHINE.md` and local continuity ledger.

## Snapshot

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

## Working Set

- `README.md`
- `INIT.md`
- `guides/{AGENTS,CLAUDE,MACHINE.example}.md`
- `project-templates/`
- `skills.json`
- `scripts/{init-workspace,install-skills,setup-guides,test-bootstrap}.mjs`
- `scripts/lib/{skill-integrity,skill-manifest,skill-source}.mjs`

## Next

- Review and commit the initial repository when ready.
- Add a private remote only with explicit user authorization.

## Open Questions

- 2026-07-27 [USER] UNCONFIRMED which private remote will host this repository.
