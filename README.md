# Machine Bootstrap

Portable AI-agent setup and guidance for a development workspace.

This repository is intentionally separate from the projects it configures. It
can be cloned into the root folder that contains your projects without making
those child folders part of one parent Git repository.

## Ownership hierarchy

The control flow is:

1. **`machine-bootstrap/`** owns initialization: the shared-skill roster, setup
   scripts, portable workspace guides, and project-guide templates.
2. **The workspace root** owns guidance shared across the project collection:
   installed `AGENTS.md` and `CLAUDE.md`, machine-local `MACHINE.md`, and inert
   `_templates/` used to initialize projects.
3. **Each project** owns its self-contained product and engineering guidance.
   Its nearest current `AGENTS.md` and owning documentation govern work inside
   that project.

`machine-bootstrap/` may physically live inside the workspace root, but it is
the portable source of truth for initializing the layer above the individual
projects. The workspace root can remain outside Git, and child projects remain
independent repositories.

The resulting filesystem stays flat at the repository boundary:

```text
Workspace/
├── AGENTS.md
├── CLAUDE.md
├── MACHINE.md
├── _templates/
├── machine-bootstrap/   # its own Git repository
├── project-a/           # its own Git repository
└── project-b/           # its own Git repository
```

The ownership hierarchy does not require moving projects inside the bootstrap
repository.

## What belongs here

- `guides/AGENTS.md` — portable, provider-agnostic working agreements.
- `guides/CLAUDE.md` — portable Claude Code overlay.
- `guides/MACHINE.example.md` — structure for facts that differ by machine.
- `project-templates/` — starter guidance for a new repository.
- `skills.json` — the desired shared Claude Code/Codex skill roster.
- `INIT.md` — concise instructions an AI agent can follow on a fresh machine.
- `scripts/init-workspace.mjs` — safe, one-command workspace initialization.
- `scripts/install-skills.mjs` — installs missing skills and verifies their
  canonical content and harness-facing paths.
- `scripts/setup-guides.mjs` — installs workspace guides and seeds `_templates/`
  beside this repository.
- `scripts/test-bootstrap.mjs` — isolated regression checks for bootstrap safety.

## What stays machine-local

The workspace root's `MACHINE.md` records absolute paths, project inventory,
port reservations, local lifecycle notes, browser preferences, and other facts
that should not be copied blindly to another computer.

Do not put credentials, private keys, tokens, resume contents, patient-style
data, or provider responses in either this repository or `MACHINE.md`.

## Set up another machine

Prerequisites: Git, Node.js 18 or newer, Claude Code and/or Codex.

1. Clone this repository as a direct child of the dedicated folder that will
   contain your projects. Its parent directory becomes the workspace root; the
   filesystem root and user home are rejected as unsafe targets.
2. Initialize and verify the workspace:

   ```bash
   node scripts/init-workspace.mjs
   ```

   This command verifies that the workspace root is outside Git, installs the
   portable guidance layer and project templates, installs missing shared
   skills directly from exact reviewed Git revisions, verifies their content
   hashes before installation, and runs a final read-only verification. It
   does not execute upstream package installers or lifecycle scripts.

3. Customize the generated `MACHINE.md` with facts verified on that computer.
4. Confirm the complete setup after replacing all `TODO` placeholders:

   ```bash
   node scripts/init-workspace.mjs --check
   ```

   Check mode is read-only and fails when portable files drift, skills are
   missing, or `MACHINE.md` still contains placeholders.

   Add `--skip-skills` to install and verify only the workspace files, without
   touching the shared skill roster.

5. Initialize each project from the workspace `_templates/`, then replace
   placeholders with facts verified from that project.
6. Start a new Claude Code or Codex session so it rediscovers the skills and
   workspace guidance.

To delegate setup, tell an AI agent: **“Follow `machine-bootstrap/INIT.md`.”**

Existing workspace files are never silently overwritten. Differing portable
guides or templates make setup fail with a review-required message. After
review, `node scripts/init-workspace.mjs --replace` creates timestamped backups
and installs the portable versions. `MACHINE.md` is always preserved once it
exists.

A workspace guide may be a symlink; it is compared through the link, so one
pointing at its portable source verifies as current. Replacement renames the
existing entry to a backup before writing, so a link target is never written
through.

## Updating

The installer adds only missing skills and rejects content that differs from
`skills.json`. To update a skill, review the upstream change at its repository,
then revise its exact `sourceRevision`, `sourcePath` when needed, expected
version when applicable, and `contentSha256` together. A changed skill must not
pass bootstrap verification until that portable manifest is updated
intentionally. Generated global lockfiles from other skill managers remain
machine state and are not authoritative for this bootstrap.

Print the installed content hashes after review with:

```bash
node scripts/install-skills.mjs --print-hashes
```

Keep project-specific architecture, commands, safety invariants, and
verification in each project's own `AGENTS.md` and engineering documentation.

## Verification

```bash
node scripts/test-bootstrap.mjs
node scripts/init-workspace.mjs --check
```

The regression suite uses disposable workspaces and disposable home directories
for clean initialization, reviewed replacement recovery, portable drift,
malformed machine state, deterministic skill integrity, reviewed Git-tree
materialization, safe target boundaries, invalid manifests and portable
sources, missing prerequisites, rejected arguments, and concise acquisition
failures. It does not execute upstream code.

The suite runs before the first install. Checks that read this machine's
installed roster are reported as skipped, by name, until the skills are
installed; rerun after initialization to cover them.
