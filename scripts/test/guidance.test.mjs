// Guidance budgets, import topology, continuity bounds, PR size, CI, and the smoke harness.
// Runs through scripts/test-bootstrap.mjs; see harness.mjs for shared helpers.

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  scriptDir,
  bootstrapRoot,
  skipped,
  includeInTestFixture,
  test,
  readNormalized
} from "./harness.mjs";

await test("repository and project guidance are self-contained", () => {
  const rootAgents = readFileSync(join(bootstrapRoot, "AGENTS.md"), "utf8");
  const rootClaude = readFileSync(join(bootstrapRoot, "CLAUDE.md"), "utf8");
  const readme = readFileSync(join(bootstrapRoot, "README.md"), "utf8");
  const projectAgents = readFileSync(
    join(bootstrapRoot, "project-templates", "AGENTS.md"),
    "utf8"
  );
  const projectClaude = readFileSync(
    join(bootstrapRoot, "project-templates", "CLAUDE.md"),
    "utf8"
  );
  const usage = readFileSync(
    join(bootstrapRoot, "project-templates", "TEMPLATE-USAGE.md"),
    "utf8"
  );

  assert.match(rootAgents, /Applies only to this repository/);
  assert.match(rootAgents, /workspace root never owns live `AGENTS\.md`, `CLAUDE\.md`, or `_templates\/`/);
  assert.equal((rootClaude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
  assert.equal((projectClaude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
  // Claude reads AGENTS.md natively; guidance explains why the adapter stays.
  for (const [label, source] of [
    ["starter AGENTS.md", projectAgents],
    ["starter CLAUDE.md", projectClaude],
    ["template usage", usage],
    ["README", readme]
  ]) {
    assert.doesNotMatch(source, /Claude does not (discover|read|load) (nested )?`?AGENTS\.md/, label);
  }
  // Provider loading facts have one owner that the operator docs link to.
  const contracts = readFileSync(join(bootstrapRoot, "docs", "provider-contracts.md"), "utf8");
  assert.match(contracts, /^## Why starters keep `CLAUDE\.md`$/m);
  assert.match(contracts, /CLAUDE\.local\.md/);
  assert.match(usage, /provider-contracts\.md/);
  assert.match(readme, /provider-contracts\.md/);
  // The template note is a block comment, which Claude strips before loading.
  assert.match(projectClaude, /<!-- Template:[^]*?keep this file even though Claude can read\s+AGENTS\.md natively[^]*?-->/);
  // Review is tiered identically in this repository and the project starter.
  for (const [label, source] of [["root AGENTS.md", rootAgents], ["starter AGENTS.md", projectAgents]]) {
    const normalized = source.replace(/\s+/g, " ");
    assert.match(normalized, /After your own verification and before local completion, every change gets one fresh independent review/, label);
    assert.match(
      normalized,
      /confined to typos, broken links, formatting, or comments with no change in meaning, behavior, or configuration; it needs only your own verification, and you state that classification/,
      label
    );
    assert.match(normalized, /Only the user may waive a required review/, label);
  }
  // Operator docs point to those two owners instead of restating the rule.
  for (const path of [
    "README.md",
    "docs/product-delivery.md",
    "docs/engineering/git-workflow.md",
    "project-templates/TEMPLATE-USAGE.md",
    "project-templates/docs/engineering/git-workflow.md"
  ]) {
    const normalized = readFileSync(join(bootstrapRoot, path), "utf8").replace(/\s+/g, " ");
    assert.doesNotMatch(normalized, /typos?, (broken )?links?, formatting,? (and |or )?comment/i, path);
  }
  // Authoring notes live in the template note that project-init deletes, not
  // in lines every seeded session loads.
  assert.doesNotMatch(
    projectAgents.replace(/^>.*$/gm, ""),
    /keep the guide under|cannot infer from the repository/
  );
  // Provider loading limits have one owner; other guides describe them in words.
  for (const path of [
    "AGENTS.md",
    "README.md",
    "INIT.md",
    "project-templates/AGENTS.md",
    "project-templates/TEMPLATE-USAGE.md"
  ]) {
    assert.doesNotMatch(readFileSync(join(bootstrapRoot, path), "utf8"), /project_doc_max_bytes|32 KiB/, path);
  }
  assert.equal(existsSync(join(bootstrapRoot, "project-templates", "README.md")), false);
  const retiredGuides = join(bootstrapRoot, "guides");
  assert.equal(
    existsSync(retiredGuides) && readdirSync(retiredGuides).length > 0,
    false
  );

  const visited = new Set();
  const visiting = new Set();
  function visitImports(path) {
    const canonicalPath = resolve(path);
    assert.equal(visiting.has(canonicalPath), false, `import cycle at ${canonicalPath}`);
    if (visited.has(canonicalPath)) return;
    visiting.add(canonicalPath);
    const markdown = readFileSync(canonicalPath, "utf8");
    for (const match of markdown.matchAll(/^@([^\s]+)\s*$/gm)) {
      const importedPath = resolve(dirname(canonicalPath), match[1]);
      assert.equal(existsSync(importedPath), true, `missing import ${importedPath}`);
      visitImports(importedPath);
    }
    visiting.delete(canonicalPath);
    visited.add(canonicalPath);
  }
  visitImports(join(bootstrapRoot, "CLAUDE.md"));
  visitImports(join(bootstrapRoot, "project-templates", "CLAUDE.md"));
});

await test("test fixtures exclude generated and machine-local state", () => {
  for (const name of [".agents", ".claude", ".codex", ".idea", ".vscode"]) {
    assert.equal(includeInTestFixture(join(bootstrapRoot, name, "artifact")), false);
  }
  for (const name of [".git", ".cache", "coverage", "dist", "node_modules", "tmp"]) {
    assert.equal(includeInTestFixture(join(bootstrapRoot, name, "artifact")), false);
  }
  for (const name of [
    ".env",
    ".env.local",
    ".npmrc",
    ".skill-lock.json",
    ".DS_Store",
    "CLAUDE.local.md",
    "MACHINE.md",
    "Thumbs.db",
    "error.log",
    "notes.swp",
    "AGENTS.md.backup-2026-08-14"
  ]) {
    assert.equal(includeInTestFixture(join(bootstrapRoot, name)), false);
  }
  assert.equal(includeInTestFixture(join(bootstrapRoot, ".env.example")), true);
  assert.equal(
    includeInTestFixture(join(bootstrapRoot, "machine-templates", "MACHINE.example.md")),
    true
  );
});

await test("modeled provider scenarios isolate sibling repositories", () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-guidance-model-"));
  try {
    const workspace = join(testRoot, "Workspace");
    const bootstrap = join(workspace, "machine-bootstrap");
    const projectA = join(workspace, "project-a");
    const projectB = join(workspace, "project-b");
    const scratch = join(workspace, "scratch");
    for (const root of [bootstrap, projectA, projectB]) {
      mkdirSync(join(root, ".git"), { recursive: true });
    }
    mkdirSync(scratch);
    writeFileSync(join(workspace, "MACHINE.md"), "INERT_MACHINE_REGISTRY\n");
    writeFileSync(join(bootstrap, "AGENTS.md"), "BOOTSTRAP_ROOT\n");
    writeFileSync(join(bootstrap, "CLAUDE.md"), "@AGENTS.md\n");
    writeFileSync(join(projectA, "AGENTS.md"), "PROJECT_A_ROOT\n");
    writeFileSync(join(projectA, "CLAUDE.md"), "@AGENTS.md\n");
    writeFileSync(join(projectB, "AGENTS.md"), "PROJECT_B_ROOT\n");
    writeFileSync(join(projectB, "CLAUDE.md"), "@AGENTS.md\n");

    function modeledCodexFiles(projectRoot, cwd) {
      if (!projectRoot) {
        const local = join(cwd, "AGENTS.md");
        return existsSync(local) ? [local] : [];
      }
      const files = [];
      let current = resolve(cwd);
      const root = resolve(projectRoot);
      while (true) {
        const guide = join(current, "AGENTS.md");
        if (existsSync(guide)) files.unshift(guide);
        if (current === root) return files;
        current = dirname(current);
      }
    }
    // Claude (2.1.277+, default setting) loads CLAUDE.md files and their
    // imports from the start directory and every folder above it, and reads
    // AGENTS.md natively only when no CLAUDE.md file exists on that path.
    // The walk stops at the disposable root it does not control.
    function modeledClaudeFiles(cwd) {
      const folders = [];
      for (let current = resolve(cwd); ; current = dirname(current)) {
        folders.unshift(current);
        if (current === testRoot) break;
      }
      const claudeNames = ["CLAUDE.md", join(".claude", "CLAUDE.md"), "CLAUDE.local.md"];
      const files = [];
      for (const folder of folders) {
        for (const name of claudeNames) {
          const file = join(folder, name);
          if (!existsSync(file)) continue;
          files.push(file);
          for (const match of readFileSync(file, "utf8").matchAll(/^@([^\s]+)\s*$/gm)) {
            files.push(resolve(dirname(file), match[1]));
          }
        }
      }
      if (files.length) return files;
      return folders
        .map((folder) => join(folder, "AGENTS.md"))
        .filter((file) => existsSync(file));
    }

    assert.deepEqual(modeledCodexFiles(bootstrap, bootstrap), [join(bootstrap, "AGENTS.md")]);
    assert.deepEqual(modeledCodexFiles(projectA, projectA), [join(projectA, "AGENTS.md")]);
    assert.deepEqual(modeledCodexFiles(projectB, projectB), [join(projectB, "AGENTS.md")]);
    assert.deepEqual(modeledCodexFiles(null, workspace), []);
    assert.deepEqual(modeledCodexFiles(null, scratch), []);
    assert.deepEqual(modeledClaudeFiles(projectA), [
      join(projectA, "CLAUDE.md"),
      join(projectA, "AGENTS.md")
    ]);
    assert.equal(modeledClaudeFiles(projectA).includes(join(bootstrap, "AGENTS.md")), false);
    assert.equal(modeledClaudeFiles(projectB).includes(join(projectA, "AGENTS.md")), false);
    assert.deepEqual(modeledClaudeFiles(workspace), []);
    assert.deepEqual(modeledClaudeFiles(scratch), []);

    // Without the adapter Claude reads AGENTS.md natively, until any personal
    // CLAUDE.local.md switches that off; the adapter's import survives both.
    rmSync(join(projectB, "CLAUDE.md"));
    assert.deepEqual(modeledClaudeFiles(projectB), [join(projectB, "AGENTS.md")]);
    writeFileSync(join(projectB, "CLAUDE.local.md"), "personal notes\n");
    assert.deepEqual(modeledClaudeFiles(projectB), [join(projectB, "CLAUDE.local.md")]);
    writeFileSync(join(projectB, "CLAUDE.md"), "@AGENTS.md\n");
    assert.deepEqual(modeledClaudeFiles(projectB), [
      join(projectB, "CLAUDE.md"),
      join(projectB, "AGENTS.md"),
      join(projectB, "CLAUDE.local.md")
    ]);

    // Guidance anywhere above the workspace would reach every sibling, which
    // is why initialization stops on it.
    writeFileSync(join(testRoot, "CLAUDE.md"), "ANCESTOR\n");
    for (const root of [bootstrap, projectA, projectB, workspace, scratch]) {
      assert.equal(modeledClaudeFiles(root)[0], join(testRoot, "CLAUDE.md"));
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("automatically loaded guidance stays within byte budgets", () => {
  for (const [relativePath, budget] of [
    ["AGENTS.md", 8 * 1024],
    ["CLAUDE.md", 2 * 1024],
    // The starter leaves most of the 8 KiB project budget for project facts.
    ["project-templates/AGENTS.md", 4.5 * 1024],
    ["project-templates/CLAUDE.md", 2 * 1024]
  ]) {
    const bytes = readFileSync(join(bootstrapRoot, ...relativePath.split("/"))).byteLength;
    assert.ok(bytes <= budget, `${relativePath} is ${bytes} bytes (budget ${budget})`);
  }
  const projectChain =
    readFileSync(join(bootstrapRoot, "project-templates", "AGENTS.md")).byteLength +
    readFileSync(join(bootstrapRoot, "project-templates", "CLAUDE.md")).byteLength;
  assert.ok(projectChain < 28 * 1024);
});

await test("this repository's workflow triggers stay narrow and its operator guide is separate", () => {
  const agents = readNormalized(bootstrapRoot, "AGENTS.md");
  const hook = agents.slice(agents.indexOf("## Product-delivery hook"), agents.indexOf("## Working method"));
  for (const contract of [
    "installation ownership, target boundaries, overwrite or recovery behavior",
    "skill acquisition sources, pinned hashes, or integrity validation",
    "generated adapter fields or provider discovery locations",
    "workflow activation, authorization, delegation, review, or artifact policy",
    "starter safety, authorization, or review rules that seeded projects inherit",
    "the hard invariants above"
  ]) {
    assert.ok(hook.includes(contract), contract);
  }
  assert.doesNotMatch(hook, /propagated into sibling projects|generated instruction meaning/);
  assert.match(hook, /are ordinary changes with the normal review/);
  const readme = readFileSync(join(bootstrapRoot, "README.md"), "utf8");
  const guide = readFileSync(join(bootstrapRoot, "docs", "product-delivery.md"), "utf8");
  assert.match(readme, /`docs\/product-delivery\.md`/);
  assert.doesNotMatch(readme, /^#{3,4} Launching a role/m);
  for (const heading of ["## Activation", "## Installed paths", "## Launching a role", "## Updating a workflow"]) {
    assert.match(guide, new RegExp(`^${heading}$`, "m"));
  }
  assert.match(guide, /claude --agent mb-delivery-lead/);
  // The moved guide agrees with the decisions made alongside it.
  assert.doesNotMatch(guide, /propagation to siblings|not an automated CI size limit|artifact-retention/);
  assert.match(
    readFileSync(join(bootstrapRoot, "workflows", "product-delivery", "WORKFLOW.md"), "utf8"),
    /`docs\/product-delivery\.md`/
  );
});

await test("continuity stays bounded and preserves archived history", () => {
  const continuity = readFileSync(join(bootstrapRoot, "CONTINUITY.md"), "utf8");
  assert.ok(Buffer.byteLength(continuity, "utf8") <= 12 * 1024);
  assert.ok(continuity.split(/\r?\n/).length <= 160);
  // The ledger holds current state; decisions and history are read on demand.
  assert.doesNotMatch(continuity, /^## Decisions/m);
  assert.match(continuity, /`docs\/decisions\.md`/);
  assert.match(continuity, /`docs\/continuity\/YYYY-MM\.md`/);
  for (const name of ["2026-07.md", "2026-10.md"]) {
    assert.equal(existsSync(join(bootstrapRoot, "docs", "continuity", name)), true);
  }
  // Decision numbers are unique and sequential, and each carries a status.
  const decisions = readFileSync(join(bootstrapRoot, "docs", "decisions.md"), "utf8");
  const numbers = [
    ...decisions.matchAll(
      /^- \d{4}-\d{2}-\d{2} \[[A-Z+-]+\] D(\d{3}) (ACTIVE|AMENDED by D\d{3}|(PARTLY )?SUPERSEDED by D\d{3}):/gm
    )
  ].map((match) => Number(match[1]));
  assert.equal(numbers.length, (decisions.match(/^- \d{4}-/gm) ?? []).length);
  assert.deepEqual(numbers, numbers.map((_, index) => index + 1));
});

await test("PR size counts the Git contract's lines and enforces its gate", () => {
  const repo = mkdtempSync(join(tmpdir(), "machine-bootstrap-pr-size-"));
  try {
    const run = (gitArgs) => {
      const result = spawnSync("git", ["-C", repo, ...gitArgs], { encoding: "utf8", shell: false });
      assert.equal(result.status, 0, result.stderr);
    };
    const lines = (count, word) => Array.from({ length: count }, (_, i) => `${word} ${i}\n`).join("");
    const commit = (message) => {
      run(["add", "-A"]);
      run(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.com", "commit", "-q", "-m", message]);
    };
    run(["init", "-q"]);
    writeFileSync(join(repo, "app.js"), lines(10, "app"));
    writeFileSync(join(repo, "gone.md"), lines(5, "gone"));
    writeFileSync(join(repo, "package-lock.json"), lines(10, "lock"));
    writeFileSync(join(repo, "image.bin"), Buffer.from([0, 1, 2, 3, 0, 255]));
    writeFileSync(join(repo, "moved.md"), lines(20, "moved"));
    writeFileSync(join(repo, "renamed.md"), lines(20, "renamed"));
    commit("base");
    run(["branch", "base"]);
    // 3 added + 2 removed in app.js, 5 removed with gone.md, and 1 changed line
    // in a renamed file count; the lockfile, binary, pure rename, and excluded
    // generated output do not.
    writeFileSync(join(repo, "app.js"), lines(8, "app") + lines(3, "new"));
    rmSync(join(repo, "gone.md"));
    writeFileSync(join(repo, "package-lock.json"), lines(60, "lock"));
    writeFileSync(join(repo, "image.bin"), Buffer.from([0, 9, 9, 9, 0, 255]));
    renameSync(join(repo, "moved.md"), join(repo, "moved-to.md"));
    renameSync(join(repo, "renamed.md"), join(repo, "renamed-to.md"));
    writeFileSync(join(repo, "renamed-to.md"), lines(19, "renamed") + "renamed edited\n");
    mkdirSync(join(repo, "gen"));
    writeFileSync(join(repo, "gen", "out.js"), lines(7, "generated"));
    commit("change");

    const size = (args) =>
      spawnSync(process.execPath, [join(scriptDir, "pr-size.mjs"), "base", ...args], {
        cwd: repo,
        encoding: "utf8",
        shell: false
      });
    const report = size(["--exclude", "gen/"]);
    assert.equal(report.status, 0, report.stderr);
    assert.match(report.stdout, /: 12 counted \(\+4 −8 in 3 files\)/);
    assert.match(report.stdout, /Band: up to 500/);
    for (const reason of [
      /package-lock\.json \(lockfile\)/,
      /image\.bin \(binary\)/,
      /moved\.md → moved-to\.md \(pure rename\)/,
      /gen\/out\.js \(excluded by --exclude\)/
    ]) {
      assert.match(report.stdout, reason);
    }
    assert.match(size([]).stdout, /: 19 counted/, "unexcluded generated output counts");
    assert.equal(size(["--exclude", "gen/", "--fail-over", "12"]).status, 0);
    const over = size(["--exclude", "gen/", "--fail-over", "11"]);
    assert.equal(over.status, 1);
    assert.match(over.stderr, /12 counted lines exceed 11/);
    assert.equal(size(["--bogus"]).status, 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

await test("CI enforces the PR size gate and the push hook runs the suite", () => {
  const workflow = readFileSync(join(bootstrapRoot, ".github", "workflows", "pr-size.yml"), "utf8");
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited\]/);
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  // Event data reaches the shell only through environment variables.
  assert.match(workflow, /PR_BODY: \$\{\{ github\.event\.pull_request\.body \}\}/);
  assert.doesNotMatch(workflow.slice(workflow.indexOf("run: |")), /\$\{\{/);
  // The base branch's script measures the PR, and an exception names the head.
  assert.match(workflow, /git show "origin\/\$BASE_REF:scripts\/pr-size\.mjs"/);
  assert.match(workflow, /size-exception: \*\\\(\[0-9a-f\]\\\{7,40\\\}\\\)/);
  assert.match(workflow, /node "\$script" "origin\/\$BASE_REF" --fail-over 1000/);
  const hook = join(scriptDir, "hooks", "pre-push");
  // A CRLF checkout would break the shebang under Git for Windows' sh.
  assert.match(readFileSync(join(bootstrapRoot, ".gitattributes"), "utf8"), /^scripts\/hooks\/\* text eol=lf$/m);
  assert.match(readFileSync(hook, "utf8"), /^#!\/bin\/sh\n[^]*exec node scripts\/test-bootstrap\.mjs/);
  if (process.platform !== "win32") {
    assert.ok(statSync(hook).mode & 0o111, "pre-push is executable");
  }
});

await test("provider smoke harness judges loading without calling providers", async () => {
  const smoke = await import("../smoke-providers.mjs");
  const root = mkdtempSync(join(tmpdir(), "machine-bootstrap-smoke-test-"));
  try {
    const fixture = smoke.buildFixture(root, "abc123");
    const at = (...parts) => join(fixture.workspace, ...parts);
    assert.match(readFileSync(at("project-a", "CLAUDE.md"), "utf8"), /^@AGENTS\.md$/m);
    assert.equal(existsSync(at("project-b", "CLAUDE.md")), false);
    assert.match(readFileSync(at("project-c", "CLAUDE.local.md"), "utf8"), /SMOKE_L_abc123/);
    assert.deepEqual(readdirSync(at("scratch")), []);

    assert.deepEqual(
      smoke.parseReply('Result:\n```json\n{"markers":["SMOKE_A_x"],"skills":["continuity"],"agents":[]}\n```'),
      { markers: ["SMOKE_A_x"], skills: ["continuity"], agents: [] }
    );
    assert.equal(smoke.parseReply("no structured reply"), null);

    // A fake provider that loads exactly what each provider documents.
    const expectations = { skills: ["continuity"], agents: { claude: ["mb-verifier"], codex: ["mb_verifier"] } };
    const markersIn = (dir, names) =>
      names
        .filter((name) => existsSync(join(dir, name)))
        .flatMap((name) => readFileSync(join(dir, name), "utf8").match(/SMOKE_[A-Z]+_[0-9a-f]+/g) ?? []);
    const documented = (scenario) => {
      const claudeFiles = ["CLAUDE.md", "CLAUDE.local.md"].filter((name) => existsSync(join(scenario.cwd, name)));
      let markers;
      if (scenario.provider === "codex") markers = markersIn(scenario.cwd, ["AGENTS.md"]);
      else if (claudeFiles.length) {
        const imports = claudeFiles.some((name) => /^@AGENTS\.md$/m.test(readFileSync(join(scenario.cwd, name), "utf8")));
        markers = markersIn(scenario.cwd, [...claudeFiles, ...(imports ? ["AGENTS.md"] : [])]);
      } else markers = markersIn(scenario.cwd, ["AGENTS.md"]);
      const agent = scenario.provider === "claude" ? "mb-verifier" : "mb_verifier";
      return { text: JSON.stringify({ markers, skills: ["plugin:continuity"], agents: [agent] }) };
    };
    const passing = smoke.runSmoke({ run: documented, available: {}, expectations, root: join(root, "pass") });
    assert.equal(passing.length, 7);
    assert.deepEqual([...new Set(passing.map((result) => result.outcome))], ["passed"]);

    // Claude ignoring native AGENTS.md, a tool-using reply, a missing skill,
    // and an unavailable CLI each land in their own outcome.
    const flawed = (scenario) => {
      if (scenario.provider === "claude" && scenario.dir === "project-b") return { text: '{"markers":[]}' };
      if (scenario.provider === "codex" && scenario.dir === "project-c") return { ...documented(scenario), usedTools: true };
      if (scenario.provider === "codex" && scenario.dir === "project-a") return { text: '{"markers":["SMOKE_A_' + scenario.cwd.length + '"]}' };
      if (scenario.provider === "codex") return { skipped: "codex CLI not found" };
      return documented(scenario);
    };
    const outcomes = Object.fromEntries(
      smoke.runSmoke({ run: flawed, available: {}, expectations, root: join(root, "flawed") })
        .map((result) => [`${result.scenario.provider}/${result.scenario.dir}`, result])
    );
    assert.equal(outcomes["claude/project-b"].outcome, "failed");
    assert.match(outcomes["claude/project-b"].detail, /missing SMOKE_B_/);
    assert.equal(outcomes["codex/project-c"].outcome, "unverified");
    assert.equal(outcomes["codex/project-a"].outcome, "failed");
    assert.match(outcomes["codex/project-a"].detail, /not discovered: continuity, mb_verifier/);
    assert.equal(outcomes["codex/scratch"].outcome, "skipped");
    assert.equal(outcomes["claude/scratch"].outcome, "passed");
    assert.match(smoke.prompt, /Do not run commands or read files/);
    // Claude's event stream exposes tool use the same way Codex's does.
    const events = [
      JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Agent" }] } }),
      "progress text",
      JSON.stringify({ type: "result", result: '{"markers":[]}' })
    ].join("\n");
    const parsed = [...smoke.jsonLines(events)];
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].message.content[0].type, "tool_use");
    const source = readFileSync(join(scriptDir, "smoke-providers.mjs"), "utf8");
    assert.match(source, /"--output-format", "stream-json", "--verbose"/);
    assert.match(source, /realpathSync\.native\(resolve\(process\.argv\[1\]\)\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await test("CI covers the full bootstrap suite on Linux, Windows, and macOS", () => {
  const workflow = readFileSync(
    join(bootstrapRoot, ".github", "workflows", "bootstrap.yml"),
    "utf8"
  );
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /macos-latest/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /node scripts\/test-bootstrap\.mjs/);
  // The generated Codex TOML is parsed by a real tomllib on the runners that
  // ship Python 3.11+, so that check is not silently skipped in CI.
  assert.match(workflow, /MACHINE_BOOTSTRAP_TOML_PYTHON:.*runner\.os != 'Windows'/);

  for (const relativePath of [
    "README.md",
    "INIT.md",
    "scripts/init-workspace.mjs",
    "scripts/init-project.mjs"
  ]) {
    const contents = readFileSync(
      join(bootstrapRoot, ...relativePath.split("/")),
      "utf8"
    );
    assert.match(contents, /Node\.js 24\s+or newer/, relativePath);
    assert.doesNotMatch(contents, /Node\.js 18\s+or newer/, relativePath);
  }
});

await test("provider facts have one owner and setup only advises on them", async () => {
  const baseline = await import("../lib/provider-baseline.mjs");
  const reviewed = baseline.loadProviderBaseline(join(bootstrapRoot, "providers.json"));
  const day = (date) => new Date(`${date}T00:00:00Z`);
  const checked = day(reviewed.documentationChecked);
  const tested = reviewed.smokeTested;

  assert.equal(baseline.compareVersions("2.1.300", "2.1.285"), 1);
  assert.equal(baseline.compareVersions("0.159.2", "0.159.2"), 0);
  assert.equal(baseline.compareVersions("0.99.0", "0.159.2"), -1);
  assert.deepEqual(baseline.providerAdvisories(reviewed, { claude: tested.claude, codex: null }, checked), []);
  const advice = baseline.providerAdvisories(
    reviewed,
    { claude: "999.0.0", codex: tested.codex },
    new Date(checked.getTime() + 31 * 86400000)
  );
  assert.equal(advice.length, 2);
  assert.match(advice[0], /last checked 31 days ago/);
  assert.match(advice[1], /Claude Code 999\.0\.0 is newer than the smoke-tested/);

  const scratch = mkdtempSync(join(tmpdir(), "machine-bootstrap-providers-"));
  try {
    for (const invalid of [
      {},
      { ...reviewed, documentationChecked: "soon" },
      { ...reviewed, smokeTested: { ...tested, codex: "latest" } }
    ]) {
      writeFileSync(join(scratch, "providers.json"), JSON.stringify(invalid));
      assert.throws(() => baseline.loadProviderBaseline(join(scratch, "providers.json")));
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  // Versions are stated only by the owner, so a provider release changes one
  // reviewed place instead of every guide that once quoted it.
  for (const relativePath of [
    "AGENTS.md",
    "CLAUDE.md",
    "README.md",
    "INIT.md",
    "docs/guidance-loading-smoke.md",
    "docs/product-delivery.md",
    "project-templates/AGENTS.md",
    "project-templates/CLAUDE.md",
    "project-templates/TEMPLATE-USAGE.md",
    "project-templates/docs/engineering/git-workflow.md",
    "scripts/audit-workspace.mjs",
    ...readdirSync(join(bootstrapRoot, "skills")).map((name) => `skills/${name}/SKILL.md`)
  ]) {
    const text = readFileSync(join(bootstrapRoot, ...relativePath.split("/")), "utf8");
    assert.doesNotMatch(text, /\b2\.1\.\d{3}\b|\b0\.1\d{2}\.\d+\b/, relativePath);
  }
});
