# Provider Guidance Loading Smoke Checks

These checks establish runtime loading behavior. The deterministic Node suite
validates only static topology and modeled contracts.

`node scripts/smoke-providers.mjs` automates the core scenarios against the
real, signed-in Claude Code and Codex CLIs: the adapter import, Claude's native
`AGENTS.md`, `CLAUDE.local.md` turning native reading off, Claude-only files in
Codex, folders with no guidance, and discovery of installed skills and roles.
It is opt-in because it makes model calls, uses random markers in a deleted
fixture, and counts a reply after any tool use as unverified. Use
`--claude-only` or `--codex-only` for one provider. The manual checks below
remain for the workspace-root start, duplicate and file-level Claude evidence,
nested guides, overrides, custom configuration roots, and the desktop apps.

Use a disposable directory with non-secret markers:

```text
Workspace/
|-- MACHINE.md
|-- machine-bootstrap/
|   |-- .git/
|   |-- AGENTS.md       # BOOTSTRAP_ROOT
|   `-- CLAUDE.md       # @AGENTS.md
|-- project-a/
|   |-- .git/
|   |-- AGENTS.md       # PROJECT_A_ROOT
|   `-- CLAUDE.md       # @AGENTS.md
|-- project-b/
|   |-- .git/
|   |-- AGENTS.md       # PROJECT_B_ROOT
|   `-- CLAUDE.md       # @AGENTS.md
`-- scratch/
```

The workspace root has no `AGENTS.md` or `CLAUDE.md`. Do not reuse real
projects, credentials, personal data, or machine guidance.

## Core scenarios

The smoke script runs the adapter, native `AGENTS.md`, `CLAUDE.local.md`, and
scratch scenarios above, with the user's approval. Check the rest by hand in
the fixture, starting a fresh session for each directory: navigating after
startup is not a new discovery run.

- Start both providers at `Workspace/` itself: it has children with guidance,
  but no repository marker may load.
- With the adapter present, Claude's `/context` lists `AGENTS.md` once.
- With the adapter removed, `/memory` lists the natively read `AGENTS.md`, and
  a temporary `InstructionsLoaded` hook does not fire for it; it does fire for
  an imported `AGENTS.md`. `docs/provider-contracts.md` gives the expected
  behavior. Restore the adapter afterward.

## Nested guidance and overrides

Extend the disposable project A with `src/scoped/AGENTS.md` carrying
`PROJECT_A_SCOPED`, a sibling `CLAUDE.md` containing only `@AGENTS.md`, and
`example.txt` containing a harmless fixture marker.

| Scenario | Codex expectation | Claude expectation |
| :--- | :--- | :--- |
| Start at project A root | Root guide loaded; scoped guide not automatically in startup chain | Root import loaded; scoped import loads when reading the scoped fixture |
| Start at `src/scoped/` | Root and scoped guides in startup chain | Root and scoped imports loaded |
| Add scoped `AGENTS.override.md` with `PROJECT_A_OVERRIDE` | A fresh scoped run selects override instead of scoped `AGENTS.md` | Explicit `@AGENTS.md` still imports the shared guide; no automatic override selection |
| Access project B from project A | Access does not switch the startup guide chain | Record actual sources; additional-directory options can affect loading |

Remove the temporary override before testing shared-policy parity. Codex
overrides are a provider mechanism, not a portable way to change shared policy.
Do not rely on a root-started Codex task navigating into a subtree to rebuild
its startup chain; it must explicitly inspect the applicable shared guide.

## Configuration roots and role discovery

Use disposable homes and configuration directories for these checks. Never
copy real authentication, settings, global guidance, or session logs into them.
If provider authentication cannot be supplied through an approved isolated
runtime, perform static installation checks and mark runtime discovery
unverified. Do not weaken permissions or transplant credentials to get a pass.

Repeat the checks with default roots, custom absolute roots, and relative roots
containing spaces. Supply environment overrides only to the fixture process;
do not change the user's shell or global defaults.

Where directory symlinks are supported, also relocate a custom configuration
root to a target at a different depth. Confirm the installed skill is readable
through its link, not merely that the link text looks correct. A regular file
blocking any ancestor of a custom root must fail preflight before acquisition.

1. Install audited skill fixtures and workflow adapters into the disposable
   home. With custom roots selected, confirm the defaults are untouched.
2. Confirm canonical skill content remains at the fixture home's
   `.agents/skills/`; Claude links appear under the selected
   `CLAUDE_CONFIG_DIR/skills/`. A missing selected link must fail `--check`
   even when the default Claude directory has a valid link.
3. Confirm custom Codex agents/profiles appear under `CODEX_HOME`. A redundant
   skill under the selected `CODEX_HOME/skills/` must fail installation/check
   without writing, while unrelated inactive default entries remain preserved.
4. In a fresh provider run, establish loaded skill paths and role discovery.
   Both providers should find the three namespaced roles; Codex discovers the
   canonical shared skills, while Claude uses its selected skill links.
5. Launch both primary CLI roles using the commands in
   `docs/product-delivery.md`. Record role activation and instruction sources;
   launch is not approval of an artifact.

The Node regression suite covers fixture installation, custom-root false
success, and invalid destinations. It does not launch a model or establish
runtime skill discovery.

## Desktop apps

In a fresh desktop task for the disposable project, follow the ordinary-review
prompt in `docs/product-delivery.md`. Confirm `mb_verifier` actually runs as a
separate reviewer and returns evidence without requesting an unrelated full
workflow. Check the full-workflow prompt separately: the Delivery Lead keeps one
Implementation Plan, asks only material questions, does not re-request approval
for routine progress, and still delegates independent review. A CLI profile
command is not proof of desktop role activation.

Where the app supports a separate worktree, repeat root/scoped discovery there
and verify the effective repository and instruction sources. In a Claude Code
desktop worktree session under `.claude/worktrees/`, `/context` should list the
worktree's `CLAUDE.md` and imported `AGENTS.md`, and
`node scripts/init-workspace.mjs --check` should report the main checkout's
workspace. Record the app version separately from the CLI version; one does not
prove the other's behavior. Replacing generated adapters requires a new
discovery run.

## Reporting

Runtime loading is `verified` only for the provider version and scenario
actually observed. Otherwise report it as `unverified`; do not promote the
static Node suite to runtime evidence. Record provider version, date, launch
directory, exact command, observed sources, and ambiguity. Remove the fixture
and logs after recording a non-sensitive summary.

Record each scenario separately as passed, failed, unverified, or skipped.
Report role availability, successful delegation, profile activation, and nested
guidance as separate observations; none is a substitute for the others.
