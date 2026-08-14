# Initialize This Workspace

This is the agent-facing entry point for a fresh checkout.

Prerequisites: Git and Node.js 18 or newer.

## Instruction for an AI agent

Read this file and `README.md`, then run from this repository:

```bash
node scripts/init-workspace.mjs
```

Before running it, confirm this checkout is a direct child of the intended
dedicated workspace folder. The script treats its parent as the workspace root
and refuses to use the filesystem root or user home.

After the command succeeds:

1. Inspect the generated workspace-root `MACHINE.md`.
2. Replace its `TODO` placeholders only with facts verified on this machine.
   Never add credentials, tokens, private documents, or secret filenames.
3. Run the read-only verification:

   ```bash
   node scripts/init-workspace.mjs --check
   ```

4. Report installed guidance, skill verification, installed workflow paths,
   remaining `MACHINE.md` placeholders, and anything that requires review. Do
   not initialize Git at the workspace root and do not stage, commit, publish,
   or overwrite differing files unless the user explicitly asks.

The seeded `_templates/` directory includes a project-owned Git/GitHub workflow
guide and `.github/pull_request_template.md`. Fill in project-specific checks,
CI, release, and deployment details before using them.

If initialization reports differing workspace guides, templates, workflow
files, or provider adapters, stop and show the differences. Use `--replace`
only after the user reviews them; the replacement is recoverable because the
existing files are renamed to timestamped backups.

Initialization also installs the portable `product-delivery` workflow to
`~/.agents/workflows/product-delivery/` and generates its Claude and Codex
adapters under `$CLAUDE_CONFIG_DIR/agents/` when that variable is set (otherwise
`~/.claude/agents/`) and under `$CODEX_HOME/agents/` plus two
`$CODEX_HOME/mb-*.config.toml` profiles when that variable is set (otherwise
the equivalent paths under `~/.codex/`). It does not read or modify
`settings.json` in the Claude configuration root or `config.toml` in the Codex
home. Tell the user to start a new session so the provider rediscovers the
definitions, and point them at `README.md` for the launch commands.

Use `--skip-skills` only when the user explicitly wants workspace files without
installing or verifying shared skills, and `--skip-workflows` only when they
explicitly want no workflow writes or verification.
