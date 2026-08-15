#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  accessSync,
  chmodSync,
  constants,
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const failures = [];
const skipped = [];

const manifestSkills = JSON.parse(
  readFileSync(join(bootstrapRoot, "skills.json"), "utf8")
).skills;

// Some checks read the machine's own installed roster. Before the first
// install there is nothing to read, so they are skipped rather than failing
// the documented verification command with confusing ENOENT errors.
const rosterInstalled = manifestSkills.every((skill) =>
  existsSync(join(homedir(), ".agents", "skills", skill.name, "SKILL.md"))
);

// Other checks need a host capability rather than installed state: creating a
// symbolic link, or POSIX permission bits that actually deny reads. Probing for
// them keeps the documented verification command honest on a host that lacks
// one, instead of reporting an environment limit as a bootstrap failure.
function detectCapabilities() {
  const probe = mkdtempSync(join(tmpdir(), "machine-bootstrap-capability-"));
  const capabilities = { symlinks: false, posixPermissions: false };
  try {
    writeFileSync(join(probe, "target.txt"), "probe\n");
    try {
      symlinkSync(join(probe, "target.txt"), join(probe, "link.txt"));
      capabilities.symlinks = true;
    } catch {
      capabilities.symlinks = false;
    }

    const guarded = join(probe, "guarded");
    mkdirSync(guarded);
    try {
      chmodSync(guarded, 0o000);
      try {
        accessSync(guarded, constants.R_OK);
      } catch {
        capabilities.posixPermissions = true;
      }
    } finally {
      chmodSync(guarded, 0o755);
    }
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
  return capabilities;
}

const capabilities = detectCapabilities();

// Test workspaces need the repository's source and fixtures, not ignored local
// caches or generated output. Copying those directories can turn a small test
// fixture into gigabytes and make every integration test repeat that cost.
const fixtureRootLocalDirectoryNames = new Set([
  ".agents",
  ".claude",
  ".codex",
  ".idea",
  ".vscode"
]);

const fixtureExcludedDirectoryNames = new Set([
  ".git",
  ".cache",
  "coverage",
  "dist",
  "node_modules",
  "tmp"
]);

const fixtureExcludedFileNames = new Set([
  ".env",
  ".npmrc",
  ".skill-lock.json",
  ".DS_Store",
  "CLAUDE.local.md",
  "MACHINE.md",
  "Thumbs.db"
]);

function includeInTestFixture(source) {
  if (source === bootstrapRoot) return true;

  const pathParts = source.slice(bootstrapRoot.length + 1).split(sep);
  if (fixtureRootLocalDirectoryNames.has(pathParts[0])) {
    return false;
  }
  if (pathParts.some((part) => fixtureExcludedDirectoryNames.has(part))) {
    return false;
  }

  const name = pathParts.at(-1);
  if (fixtureExcludedFileNames.has(name)) return false;
  if (name.startsWith(".env.") && name !== ".env.example") return false;
  if (
    name.endsWith(".log") ||
    name.endsWith(".swp") ||
    name.includes(".backup-")
  ) return false;
  return true;
}

function createTestWorkspace() {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-test-"));
  const workspaceRoot = join(testRoot, "Workspace");
  const checkoutRoot = join(workspaceRoot, "machine-bootstrap");
  mkdirSync(checkoutRoot, { recursive: true });
  cpSync(bootstrapRoot, checkoutRoot, {
    recursive: true,
    filter: includeInTestFixture
  });
  const gitResult = spawnSync("git", ["init", "-q"], {
    cwd: checkoutRoot,
    encoding: "utf8",
    shell: false
  });
  assert.equal(gitResult.status, 0, gitResult.stderr);
  return { testRoot, workspaceRoot, checkoutRoot };
}

function createTestHome(prefix) {
  return mkdtempSync(join(tmpdir(), `machine-bootstrap-${prefix}-`));
}

function isolatedEnvironment(testHome, overrides = {}) {
  const environment = {
    ...process.env,
    HOME: testHome,
    USERPROFILE: testHome
  };
  delete environment.CLAUDE_CONFIG_DIR;
  delete environment.CODEX_HOME;
  return { ...environment, ...overrides };
}

function runScript(script, scriptArgs, testHome, environmentOverrides = {}) {
  const isolatedHome = testHome ?? createTestHome("subprocess-home");
  let result;
  try {
    result = spawnSync(process.execPath, [join(scriptDir, script), ...scriptArgs], {
      encoding: "utf8",
      env: isolatedEnvironment(isolatedHome, environmentOverrides),
      shell: false
    });
  } finally {
    if (!testHome) rmSync(isolatedHome, { recursive: true, force: true });
  }
  return result;
}

async function test(
  name,
  callback,
  {
    needsInstalledRoster = false,
    needsSymlinks = false,
    needsPosixPermissions = false
  } = {}
) {
  const missing =
    (needsInstalledRoster && !rosterInstalled &&
      "shared skills are not installed yet") ||
    (needsSymlinks && !capabilities.symlinks &&
      "this host cannot create symbolic links") ||
    (needsPosixPermissions && !capabilities.posixPermissions &&
      "this host does not enforce POSIX permission bits");

  if (missing) {
    skipped.push({ name, reason: missing });
    console.log(`SKIP ${name}: ${missing}`);
    return;
  }

  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

await test("manifest pins direct Git sources and skill content", () => {
  const manifest = JSON.parse(
    readFileSync(join(bootstrapRoot, "skills.json"), "utf8")
  );

  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.installers, undefined);

  for (const skill of manifest.skills) {
    assert.match(
      skill.repository ?? "",
      /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/
    );
    assert.match(skill.sourcePath ?? "", /^(?!\/)(?!.*\.\.)(?!.*\\).+$/);
    assert.match(skill.sourceRevision ?? "", /^[a-f0-9]{40}$/);
    assert.match(skill.contentSha256 ?? "", /^[a-f0-9]{64}$/);
  }
});

await test("skill acquisition does not execute package runners", () => {
  const installer = readFileSync(
    join(scriptDir, "install-skills.mjs"),
    "utf8"
  );
  const skillSource = readFileSync(
    join(scriptDir, "lib", "skill-source.mjs"),
    "utf8"
  );
  assert.doesNotMatch(installer, /\bnpx\b|\bnpm\b/);
  assert.match(installer, /fetchReviewedSource/);
  assert.match(skillSource, /delete gitEnvironment\.GIT_ASKPASS/);
  assert.match(skillSource, /delete gitEnvironment\.SSH_ASKPASS/);
  assert.match(skillSource, /credential\.helper=/);
});

await test("skill hashes are byte-ordered and cover OS metadata", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-hash-test-"));
  try {
    writeFileSync(join(testRoot, "Z.txt"), "upper\n");
    writeFileSync(join(testRoot, "a.txt"), "lower\n");

    const expected = createHash("sha256");
    for (const [name, contents] of [
      ["Z.txt", "upper\n"],
      ["a.txt", "lower\n"]
    ]) {
      expected.update("file\0");
      expected.update(name);
      expected.update("\0");
      expected.update(contents);
      expected.update("\0");
    }

    const { hashDirectory } = await import("./lib/skill-integrity.mjs");
    const initialHash = hashDirectory(testRoot);
    assert.equal(initialHash, expected.digest("hex"));

    writeFileSync(join(testRoot, ".DS_Store"), "unexpected\n");
    assert.notEqual(hashDirectory(testRoot), initialHash);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("skill hashes cover injected empty directories", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-empty-test-"));
  try {
    const { hashDirectory } = await import("./lib/skill-integrity.mjs");
    writeFileSync(join(testRoot, "SKILL.md"), "# fixture\n");
    const initialHash = hashDirectory(testRoot);

    mkdirSync(join(testRoot, "injected"));
    const withEmptyDirectory = hashDirectory(testRoot);
    assert.notEqual(withEmptyDirectory, initialHash);

    mkdirSync(join(testRoot, "injected", "nested"));
    assert.notEqual(hashDirectory(testRoot), withEmptyDirectory);

    rmSync(join(testRoot, "injected"), { recursive: true, force: true });
    assert.equal(hashDirectory(testRoot), initialHash);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

// Fails the same way offline ("could not resolve host"), so this stays green
// without network access; the point is that it returns instead of prompting.
await test("an unreachable repository fails fast instead of prompting", async () => {
  const { fetchReviewedSource } = await import("./lib/skill-source.mjs");
  assert.throws(
    () =>
      fetchReviewedSource(
        "https://github.com/machine-bootstrap-absent-probe/private.git",
        "0".repeat(40)
      ),
    (error) => {
      assert.match(error.message, /^git fetch exited with status \d+: /);
      return true;
    }
  );
});

await test("reviewed skill trees materialize from Git objects only", async () => {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-git-test-"));
  const repositoryRoot = join(testRoot, "source");
  const sourceRoot = join(repositoryRoot, "skills", "fixture");
  const destination = join(testRoot, "materialized");

  try {
    mkdirSync(join(sourceRoot, "references"), { recursive: true });
    writeFileSync(join(sourceRoot, "SKILL.md"), "# Fixture\n");
    writeFileSync(join(sourceRoot, "references", "guide.md"), "Reviewed.\n");

    for (const gitArgs of [
      ["init", "--quiet", repositoryRoot],
      ["-C", repositoryRoot, "add", "skills/fixture"],
      [
        "-C",
        repositoryRoot,
        "-c",
        "user.name=Bootstrap Test",
        "-c",
        "user.email=bootstrap@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "fixture"
      ]
    ]) {
      const result = spawnSync("git", gitArgs, {
        encoding: "utf8",
        shell: false
      });
      assert.equal(result.status, 0, result.stderr);
    }

    const revisionResult = spawnSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8", shell: false }
    );
    assert.equal(revisionResult.status, 0, revisionResult.stderr);

    const { materializeReviewedSkill } = await import("./lib/skill-source.mjs");
    const { hashDirectory } = await import("./lib/skill-integrity.mjs");
    materializeReviewedSkill(
      repositoryRoot,
      revisionResult.stdout.trim(),
      "skills/fixture",
      destination
    );

    assert.equal(hashDirectory(destination), hashDirectory(sourceRoot));
    assert.equal(existsSync(join(destination, ".git")), false);

    const linkObject = spawnSync(
      "git",
      ["-C", repositoryRoot, "hash-object", "-w", "--stdin"],
      { encoding: "utf8", input: "../../../outside", shell: false }
    );
    assert.equal(linkObject.status, 0, linkObject.stderr);
    const indexResult = spawnSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "update-index",
        "--add",
        "--cacheinfo",
        `120000,${linkObject.stdout.trim()},skills/fixture/escape`
      ],
      { encoding: "utf8", shell: false }
    );
    assert.equal(indexResult.status, 0, indexResult.stderr);
    const linkCommit = spawnSync(
      "git",
      [
        "-C",
        repositoryRoot,
        "-c",
        "user.name=Bootstrap Test",
        "-c",
        "user.email=bootstrap@example.invalid",
        "commit",
        "--quiet",
        "-m",
        "escaping link fixture"
      ],
      { encoding: "utf8", shell: false }
    );
    assert.equal(linkCommit.status, 0, linkCommit.stderr);
    const linkRevision = spawnSync(
      "git",
      ["-C", repositoryRoot, "rev-parse", "HEAD"],
      { encoding: "utf8", shell: false }
    );
    assert.equal(linkRevision.status, 0, linkRevision.stderr);

    // Windows rejects any reviewed symbolic link before the escape check, so
    // both refusals are correct; the point is that the escaping link is never
    // materialized.
    assert.throws(
      () =>
        materializeReviewedSkill(
          repositoryRoot,
          linkRevision.stdout.trim(),
          "skills/fixture",
          join(testRoot, "unsafe-materialized")
        ),
      process.platform === "win32"
        ? /symbolic link (escapes reviewed skill|unsupported on Windows)/
        : /symbolic link escapes reviewed skill/
    );
    assert.equal(existsSync(join(testRoot, "unsafe-materialized")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test(
  "installed skills match pinned content hashes",
  async () => {
    const { hashDirectory } = await import("./lib/skill-integrity.mjs");

    for (const skill of manifestSkills) {
      const actual = hashDirectory(
        join(homedir(), ".agents", "skills", skill.name)
      );
      assert.equal(actual, skill.contentSha256, `${skill.name} content drift`);
    }
  },
  { needsInstalledRoster: true }
);

await test("incompatible Claude state fails before skill installation", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-home-test-"));
  try {
    const claudeRoot = join(testHome, ".claude", "skills");
    mkdirSync(claudeRoot, { recursive: true });
    writeFileSync(join(claudeRoot, "find-skills"), "not a symlink\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Claude destination exists but is not a symlink/);
    assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
    assert.equal(existsSync(join(testHome, ".agents", "skills")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("stray OS metadata fails verification with a named remedy", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-metadata-test-"));
  try {
    const [firstSkill] = manifestSkills;
    const installed = join(testHome, ".agents", "skills", firstSkill.name);
    mkdirSync(dirname(installed), { recursive: true });
    cpSync(join(homedir(), ".agents", "skills", firstSkill.name), installed, {
      recursive: true,
      verbatimSymlinks: true
    });
    writeFileSync(join(installed, ".DS_Store"), "os metadata\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      new RegExp(`${firstSkill.name}: content hash [a-f0-9]{64} does not match`)
    );
    assert.match(result.stderr, /remove stray OS metadata first \(\.DS_Store\)/);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsInstalledRoster: true });

await test("a relocated skill root reached through a symlink stays supported", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-symlink-test-"));
  try {
    const [firstSkill] = manifestSkills;
    const relocated = join(testHome, "shared-skills");
    mkdirSync(join(testHome, ".agents"), { recursive: true });
    mkdirSync(relocated, { recursive: true });
    symlinkSync(relocated, join(testHome, ".agents", "skills"));
    cpSync(
      join(homedir(), ".agents", "skills", firstSkill.name),
      join(relocated, firstSkill.name),
      { recursive: true, verbatimSymlinks: true }
    );

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.doesNotMatch(result.stderr, /skill root must be a directory/);
    assert.doesNotMatch(
      result.stderr,
      new RegExp(`${firstSkill.name}: (canonical skill is missing|skill)`)
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsInstalledRoster: true, needsSymlinks: true });

await test("a skill reached through a symlink verifies by content", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-skilllink-test-"));
  try {
    const [firstSkill] = manifestSkills;
    const checkout = join(testHome, "dev", firstSkill.name);
    mkdirSync(join(testHome, ".agents", "skills"), { recursive: true });
    mkdirSync(dirname(checkout), { recursive: true });
    cpSync(join(homedir(), ".agents", "skills", firstSkill.name), checkout, {
      recursive: true,
      verbatimSymlinks: true
    });
    symlinkSync(checkout, join(testHome, ".agents", "skills", firstSkill.name));

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.doesNotMatch(
      result.stderr,
      new RegExp(`${firstSkill.name}: skill directory is missing`)
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
}, { needsInstalledRoster: true, needsSymlinks: true });

await test("a malformed skill root is reported instead of crashing", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-root-test-"));
  try {
    mkdirSync(join(testHome, ".claude"), { recursive: true });
    writeFileSync(join(testHome, ".claude", "skills"), "not a directory\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Claude skill root must be a directory/);
    assert.doesNotMatch(result.stderr, /ENOTDIR|node:internal/);
    assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
    assert.equal(existsSync(join(testHome, ".agents", "skills")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("a partial skill directory fails before any network fetch", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-partial-test-"));
  try {
    const partial = join(testHome, ".agents", "skills", "find-skills");
    mkdirSync(partial, { recursive: true });
    writeFileSync(join(partial, "notes.md"), "leftover\n");

    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exists without SKILL\.md/);
    assert.doesNotMatch(result.stdout, /Fetching reviewed source/);
    assert.equal(existsSync(join(partial, "notes.md")), true);
    assert.equal(
      readdirSync(join(testHome, ".agents", "skills")).length,
      1,
      "no other skill was installed"
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("skill acquisition failures are concise and leave no partial install", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-fetch-test-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome, { PATH: "" }),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Skill setup failed:/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);
    assert.equal(existsSync(join(testHome, ".agents", "skills")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test(
  "hash report is read-only and covers the complete roster",
  () => {
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--print-hashes"],
      { encoding: "utf8", shell: false }
    );
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, manifestSkills.length);
    for (const line of lines) {
      assert.match(line, /^[a-z0-9-]+ [a-f0-9]{64}$/);
    }
  },
  { needsInstalledRoster: true }
);

await test("hash report fails concisely when a skill is not installed", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-hash-report-"));
  try {
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--print-hashes"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Skill setup failed:/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);
    assert.equal(result.stdout.trim(), "");
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("setup scripts reject bad arguments without stack traces", () => {
  for (const [script, scriptArgs] of [
    ["install-skills.mjs", ["--bogus"]],
    ["init-workspace.mjs", ["--bogus"]],
    ["init-workspace.mjs", ["--check", "--migrate-legacy-layout"]],
    ["init-project.mjs", []],
    ["init-project.mjs", ["../project-a", "--bogus"]]
  ]) {
    const result = runScript(script, scriptArgs);
    const label = `${script} ${scriptArgs.join(" ")}`;
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /failed:/, label);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/, label);
  }
});

await test("an invalid skill manifest fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    writeFileSync(join(checkoutRoot, "skills.json"), "{ invalid json\n");
    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs")],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /skills\.json must contain valid JSON/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal|SyntaxError/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false);
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a wrong-typed machine template fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const source = join(checkoutRoot, "machine-templates", "MACHINE.example.md");
    rmSync(source);
    mkdirSync(source);
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /machine-templates\/MACHINE\.example\.md must be a readable regular file/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a symlinked machine template fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const source = join(checkoutRoot, "machine-templates", "MACHINE.example.md");
    const externalSource = join(testRoot, "external-machine-notes.md");
    writeFileSync(externalSource, "external private machine bytes\n");
    rmSync(source);
    symlinkSync(externalSource, source);

    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /machine-templates\/MACHINE\.example\.md must be a readable regular file/
    );
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    assert.equal(
      readFileSync(externalSource, "utf8"),
      "external private machine bytes\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project template keeps local-state safety exclusions trackable", () => {
  const ignore = readFileSync(
    join(bootstrapRoot, "project-templates", ".gitignore"),
    "utf8"
  );
  for (const pattern of [
    "CLAUDE.local.md",
    ".claude/settings.local.json",
    ".agent-work/",
    ".env",
    ".env.*",
    "!.env.example",
    ".DS_Store",
    "Thumbs.db"
  ]) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(ignore, new RegExp(`^${escaped}$`, "m"));
  }
  assert.doesNotMatch(ignore, /^\.claude\/?$/m);
  assert.doesNotMatch(ignore, /^\.codex\/?$/m);
});

await test("repository and project guidance are self-contained", () => {
  const rootAgents = readFileSync(join(bootstrapRoot, "AGENTS.md"), "utf8");
  const rootClaude = readFileSync(join(bootstrapRoot, "CLAUDE.md"), "utf8");
  const readme = readFileSync(join(bootstrapRoot, "README.md"), "utf8");
  const init = readFileSync(join(bootstrapRoot, "INIT.md"), "utf8");
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
  assert.match(projectAgents, /repository may be cloned outside its current workspace/);
  assert.match(usage, /node scripts\/init-project\.mjs <target-project>/);
  assert.match(usage, /not a project README/);
  assert.match(readme, /Agent-assisted setup \(recommended for normal use\)/);
  assert.match(readme, /Set up this workspace using machine-bootstrap/);
  assert.match(readme, /Initialize `\.\.\/project-a` using machine-bootstrap/);
  assert.match(init, /ordinary language without naming any script/);
  assert.match(init, /use the audited scripts/);
  assert.match(usage, /canonical initializer rather than copying/);
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
    function modeledClaudeFiles(root) {
      const adapter = join(root, "CLAUDE.md");
      if (!existsSync(adapter)) return [];
      const files = [adapter];
      for (const match of readFileSync(adapter, "utf8").matchAll(/^@([^\s]+)\s*$/gm)) {
        files.push(resolve(root, match[1]));
      }
      return files;
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
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("automatically loaded guidance stays within byte budgets", () => {
  for (const [relativePath, budget] of [
    ["AGENTS.md", 8 * 1024],
    ["CLAUDE.md", 2 * 1024],
    ["project-templates/AGENTS.md", 8 * 1024],
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

await test("continuity stays bounded and preserves archived history", () => {
  const continuity = readFileSync(join(bootstrapRoot, "CONTINUITY.md"), "utf8");
  assert.ok(Buffer.byteLength(continuity, "utf8") <= 12 * 1024);
  assert.ok(continuity.split(/\r?\n/).length <= 160);
  assert.match(continuity, /docs\/continuity\/2026-07\.md/);
  assert.equal(existsSync(join(bootstrapRoot, "docs", "continuity", "2026-07.md")), true);
});

await test("CI covers the full bootstrap suite on Linux and Windows", () => {
  const workflow = readFileSync(
    join(bootstrapRoot, ".github", "workflows", "bootstrap.yml"),
    "utf8"
  );
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /node scripts\/test-bootstrap\.mjs/);

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

await test("clean workspace initialization creates only the machine registry", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const command = [
      join(checkoutRoot, "scripts", "init-workspace.mjs"),
      "--skip-skills",
      "--skip-workflows"
    ];
    const result = spawnSync(process.execPath, command, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      readFileSync(
        join(checkoutRoot, "machine-templates", "MACHINE.example.md"),
        "utf8"
      )
    );
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false, name);
    }

    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    const second = spawnSync(process.execPath, command, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );

    const check = spawnSync(process.execPath, [...command, "--check"], {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(check.status, 0, check.stderr);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workspace check is read-only and allows an absent registry", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const args = [
      join(checkoutRoot, "scripts", "init-workspace.mjs"),
      "--check",
      "--skip-skills",
      "--skip-workflows"
    ];
    const absent = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(absent.status, 0, absent.stderr);
    assert.match(absent.stdout, /Optional machine registry is not present/);
    assert.equal(readdirSync(workspaceRoot).sort().join(","), "machine-bootstrap");

    copyFileSync(
      join(checkoutRoot, "machine-templates", "MACHINE.example.md"),
      join(workspaceRoot, "MACHINE.md")
    );
    const incomplete = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /TODO placeholder/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("malformed MACHINE.md and Git-owned workspaces fail before writes", () => {
  for (const kind of ["machine-directory", "git-workspace"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      if (kind === "machine-directory") mkdirSync(join(workspaceRoot, "MACHINE.md"));
      else {
        const gitResult = spawnSync("git", ["init", "-q"], {
          cwd: workspaceRoot,
          encoding: "utf8",
          shell: false
        });
        assert.equal(gitResult.status, 0, gitResult.stderr);
      }
      const result = spawnSync(
        process.execPath,
        [
          join(checkoutRoot, "scripts", "init-workspace.mjs"),
          "--skip-skills",
          "--skip-workflows"
        ],
        {
          encoding: "utf8",
          env: isolatedEnvironment(testRoot),
          shell: false
        }
      );
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        kind === "machine-directory"
          ? /MACHINE\.md must be a readable regular file/
          : /Workspace root must stay outside Git/
      );
      for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
        assert.equal(existsSync(join(workspaceRoot, name)), false);
      }
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("a missing Git prerequisite is reported plainly before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot, { PATH: join(testRoot, "no-tools") }),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Git is required on PATH/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a checkout directly under the user home is rejected before writes", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-home-root-test-"));
  const checkoutRoot = join(testHome, "machine-bootstrap");
  try {
    mkdirSync(checkoutRoot);
    cpSync(bootstrapRoot, checkoutRoot, {
      recursive: true,
      filter: includeInTestFixture
    });
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root cannot be the user home/);
    assert.equal(existsSync(join(testHome, "MACHINE.md")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("legacy workspace entries stop for manual review without writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const legacyTemplates = join(workspaceRoot, "_templates");
    mkdirSync(legacyTemplates);
    writeFileSync(join(workspaceRoot, "AGENTS.md"), "existing workspace policy\n");
    writeFileSync(join(workspaceRoot, "CLAUDE.md"), "existing Claude policy\n");
    writeFileSync(join(legacyTemplates, "README.md"), "existing templates\n");
    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    const sibling = join(workspaceRoot, "project-b");
    mkdirSync(sibling);
    writeFileSync(join(sibling, "owned.txt"), "sibling bytes\n");
    const siblingBefore = readFileSync(join(sibling, "owned.txt"));

    const normal = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(normal.status, 0);
    assert.match(normal.stderr, /Legacy workspace layout detected/);
    assert.match(normal.stderr, /automatic migration is not supported/i);
    assert.match(normal.stderr, /move .* manually/i);
    assert.equal(existsSync(legacyTemplates), true);
    assert.equal(
      readFileSync(join(workspaceRoot, "AGENTS.md"), "utf8"),
      "existing workspace policy\n"
    );
    assert.equal(existsSync(join(workspaceRoot, ".machine-bootstrap-backup")), false);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );
    assert.deepEqual(readFileSync(join(sibling, "owned.txt")), siblingBefore);

    const removedOption = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--migrate-legacy-layout",
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(removedOption.status, 0);
    assert.match(removedOption.stderr, /Unknown argument.*--migrate-legacy-layout/);
    assert.equal(existsSync(legacyTemplates), true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

function runProjectInitializer(checkoutRoot, target, testHome, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [join(checkoutRoot, "scripts", "init-project.mjs"), target, ...extraArgs],
    {
      cwd: checkoutRoot,
      encoding: "utf8",
      env: isolatedEnvironment(testHome),
      shell: false
    }
  );
}

function gitCheckIgnore(project, relativePath) {
  return spawnSync(
    "git",
    ["-C", project, "check-ignore", "--quiet", "--no-index", "--", relativePath],
    { encoding: "utf8", shell: false }
  );
}

function directoryByteHash(root) {
  const hash = createHash("sha256");
  function visit(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      hash.update(relativePath);
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else hash.update(readFileSync(absolutePath));
    }
  }
  visit(root);
  return hash.digest("hex");
}

await test("project initialization changes only its explicit target", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const projectA = join(workspaceRoot, "project-a");
    const projectB = join(workspaceRoot, "project-b");
    mkdirSync(projectB);
    writeFileSync(join(projectB, "owned.txt"), "project b\n");
    const siblingBefore = directoryByteHash(projectB);

    const result = runProjectInitializer(
      checkoutRoot,
      projectA,
      testRoot,
      ["--create"]
    );
    assert.equal(result.status, 0, result.stderr);
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      ".gitignore",
      "docs/engineering/git-workflow.md",
      ".github/pull_request_template.md"
    ]) {
      assert.equal(existsSync(join(projectA, ...path.split("/"))), true, path);
    }
    assert.equal(existsSync(join(projectA, "README.md")), false);
    assert.equal(existsSync(join(projectA, "TEMPLATE-USAGE.md")), false);
    assert.equal(directoryByteHash(projectB), siblingBefore);
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates", "MACHINE.md"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false, name);
    }
    const claude = readFileSync(join(projectA, "CLAUDE.md"), "utf8");
    assert.equal((claude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
    assert.match(result.stdout, /Remaining template placeholders:/);
    assert.match(result.stdout, /Start a new Codex or Claude session/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization reports a dangling target link cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const target = join(workspaceRoot, "project-a");
    symlinkSync(join(workspaceRoot, "missing-project"), target, "dir");

    const result = runProjectInitializer(checkoutRoot, target, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Project initialization failed: Target must resolve to an existing directory/
    );
    assert.doesNotMatch(result.stderr, /\n\s+at canonicalCandidate/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization reports a dangling target parent cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const parent = join(workspaceRoot, "dangling-parent");
    const target = join(parent, "project-a");
    symlinkSync(join(workspaceRoot, "missing-parent"), parent, "dir");

    const result = runProjectInitializer(
      checkoutRoot,
      target,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Project initialization failed: Target parent must resolve to an existing directory/
    );
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal|at canonicalCandidate/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization rejects a symlinked template source", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalSource = join(testRoot, "external-agent-policy.md");
    const templateSource = join(
      checkoutRoot,
      "project-templates",
      "AGENTS.md"
    );
    writeFileSync(externalSource, "external private policy bytes\n");
    rmSync(templateSource);
    symlinkSync(externalSource, templateSource);

    const result = runProjectInitializer(
      checkoutRoot,
      project,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Template must be a regular file: AGENTS\.md/);
    assert.equal(existsSync(project), false);
    assert.equal(
      readFileSync(externalSource, "utf8"),
      "external private policy bytes\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test(
  "project initialization rejects a starter symlink that appears mid-run",
  () => {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      const externalTarget = join(testRoot, "external-private.txt");
      mkdirSync(project);
      writeFileSync(externalTarget, "external private bytes\n");

      const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
      const initializer = readFileSync(initializerPath, "utf8");
      const needle = "    const destination = join(canonicalTarget, ...parts);";
      assert.ok(initializer.includes(needle), "starter injection point must exist");
      assert.equal(
        initializer.indexOf(needle),
        initializer.lastIndexOf(needle),
        "starter injection point must be unique"
      );
      writeFileSync(
        initializerPath,
        initializer.replace(
          needle,
          needle +
            `\n` +
            `    if (relativePath === "AGENTS.md") {\n` +
            `      symlinkSync(${JSON.stringify(externalTarget)}, destination);\n` +
            `    }`
        )
      );

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /(?:appeared during initialization|Managed project path must be a real file)/
      );
      assert.equal(
        readFileSync(externalTarget, "utf8"),
        "external private bytes\n"
      );
      assert.equal(lstatSync(join(project, "AGENTS.md")).isSymbolicLink(), true);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  },
  { needsSymlinks: true }
);

await test("project initialization does not follow a replaced managed parent", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalParent = join(testRoot, "external-parent");
    mkdirSync(project);
    mkdirSync(externalParent);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle =
      "    copyTrackedFile(templateContents.get(relativePath), destination);";
    assert.ok(initializer.includes(needle), "parent injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `    if (relativePath === "docs/engineering/git-workflow.md") {\n` +
          `      const managedParent = join(canonicalTarget, "docs", "engineering");\n` +
          `      renameSync(managedParent, managedParent + ".original");\n` +
          `      symlinkSync(${JSON.stringify(externalParent)}, managedParent, "dir");\n` +
          `    }\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Managed parent (?:changed during initialization|must be a real directory)/
    );
    assert.equal(existsSync(join(externalParent, "git-workflow.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization pins the original target directory", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const originalProject = `${project}.original`;
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    const destination = join(canonicalTarget, ...parts);";
    assert.ok(initializer.includes(needle), "target injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "target injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        needle +
          `\n` +
          `    if (relativePath === "CLAUDE.md") {\n` +
          `      renameSync(canonicalTarget, ${JSON.stringify(originalProject)});\n` +
          `      mkdirSync(canonicalTarget);\n` +
          `    }`
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent changed during initialization/);
    assert.equal(existsSync(join(project, "CLAUDE.md")), false);
    assert.equal(existsSync(join(originalProject, "AGENTS.md")), true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization pins a newly created directory before publication", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    renameSync(stagingLeaf, leaf);";
    assert.ok(initializer.includes(needle), "new directory injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "new directory injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "    renameSync(stagingLeaf, stagingLeaf + \".original\");\n" +
          "    mkdirSync(stagingLeaf);\n" +
          needle
      )
    );

    const result = runProjectInitializer(
      checkoutRoot,
      project,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent changed during initialization/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization fails before rewriting a vanished starter", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, "AGENTS.md"), "project-owned policy\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    const expected = managedFileAnchors.get(destination);";
    assert.ok(initializer.includes(needle), "starter disappearance injection must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "starter disappearance injection must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `    if (relativePath === "AGENTS.md") rmSync(destination);\n` + needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md disappeared during initialization/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
    assert.equal(existsSync(join(project, "CLAUDE.md")), false);
    assert.equal(existsSync(join(project, ".gitignore")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization preflights parents before starter writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const writeMarker = join(testRoot, "starter-write-attempted.txt");
    mkdirSync(project);
    writeFileSync(join(project, "docs"), "user-owned file\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "function copyTrackedFile(expectedContents, destination) {";
    assert.ok(initializer.includes(needle), "copy marker injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        needle +
          `\n  writeFileSync(${JSON.stringify(writeMarker)}, destination + "\\n", { flag: "a" });`
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent must be a real directory/);
    assert.equal(existsSync(writeMarker), false);
    assert.deepEqual(readdirSync(project), ["docs"]);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("existing project guidance is preserved and gitignore entries merge", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    writeFileSync(join(project, "AGENTS.md"), "custom project policy\n");
    writeFileSync(join(project, "CLAUDE.md"), "@AGENTS.md\ncustom adapter\n");
    writeFileSync(join(project, ".gitignore"), "dist/\n");
    writeFileSync(join(project, ".env.example"), "SAFE=value\n");

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "custom project policy\n"
    );
    assert.equal(
      readFileSync(join(project, "CLAUDE.md"), "utf8"),
      "@AGENTS.md\ncustom adapter\n"
    );
    const ignore = readFileSync(join(project, ".gitignore"), "utf8");
    assert.match(ignore, /^dist\/$/m);
    for (const entry of [
      "CLAUDE.local.md",
      ".claude/settings.local.json",
      ".agent-work/",
      ".env",
      ".env.*",
      "!.env.example",
      ".DS_Store",
      "Thumbs.db"
    ]) {
      const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(ignore, new RegExp(`^${escaped}$`, "m"));
    }
    assert.ok(ignore.indexOf(".env\n.env.*\n!.env.example") >= 0);
    assert.equal(gitCheckIgnore(project, ".env.example").status, 1);
    assert.equal(gitCheckIgnore(project, ".env.local").status, 0);
    assert.equal(gitCheckIgnore(project, ".env.production").status, 0);
    assert.match(result.stdout, /Preserved: AGENTS\.md, CLAUDE\.md/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("ambiguous existing environment ignore policy is preserved for review", () => {
  for (const original of [
    ".env\n!.env.example\n",
    ".env.*\n!.env.example\n"
  ]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      mkdirSync(project);
      const gitResult = spawnSync("git", ["init", "-q"], {
        cwd: project,
        encoding: "utf8",
        shell: false
      });
      assert.equal(gitResult.status, 0, gitResult.stderr);
      writeFileSync(join(project, ".gitignore"), original);

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /environment rules.*manual review/i);
      assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
      assert.equal(existsSync(join(project, "AGENTS.md")), false);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("ineffective env example exception is preserved for review", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    const original = ".env\n.env.*\n!.env.example\n*.example\n";
    writeFileSync(join(project, ".gitignore"), original);

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /environment rules.*manual review/i);
    assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("environment variant exceptions are preserved for review", () => {
  for (const exception of ["!*.production", "!*.development"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      mkdirSync(project);
      const original = `.env\n.env.*\n!.env.example\n${exception}\n`;
      writeFileSync(join(project, ".gitignore"), original);

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /environment rules.*manual review/i);
      assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
      assert.equal(existsSync(join(project, "AGENTS.md")), false);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("project rollback preserves a concurrent gitignore and its original backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "          descriptor = openSync(";
    assert.ok(initializer.includes(needle), "rollback injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "rollback injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "          writeFileSync(basename(gitignorePath), \"concurrent ignore\\n\", { flag: \"wx\" });\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(join(project, ".gitignore"), "utf8"),
      "concurrent ignore\n"
    );
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-") && name.endsWith(".backup")
    );
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(join(project, backups[0]), "utf8"), "dist/\n");
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /original preserved at/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project cleanup preserves a replaced gitignore backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  if (gitignoreBackup) {";
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "backup cleanup injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  const displacedBackup = gitignoreBackup + ".original";\n` +
          `  renameSync(gitignoreBackup, displacedBackup);\n` +
          `  writeFileSync(gitignoreBackup, "concurrent backup\\n");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /backup remains.*changed concurrently/i);
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-")
    );
    assert.equal(backups.length, 2);
    const concurrentBackup = backups.find((name) => !name.endsWith(".original"));
    const originalBackup = backups.find((name) => name.endsWith(".original"));
    assert.equal(readFileSync(join(project, concurrentBackup), "utf8"), "concurrent backup\n");
    assert.equal(readFileSync(join(project, originalBackup), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never restores a replaced gitignore backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "          descriptor = openSync(";
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "backup replacement injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `          renameSync(gitignoreBackup, gitignoreBackup + ".original");\n` +
          `          writeFileSync(gitignoreBackup, "replacement backup\\n");\n` +
          `          throw new Error("injected backup replacement");\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /backup changed concurrently.*manual recovery/i);
    assert.equal(existsSync(join(project, ".gitignore")), false);
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-")
    );
    assert.equal(backups.length, 2);
    const replacement = backups.find((name) => !name.endsWith(".original"));
    const original = backups.find((name) => name.endsWith(".original"));
    assert.equal(readFileSync(join(project, replacement), "utf8"), "replacement backup\n");
    assert.equal(readFileSync(join(project, original), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates a preserved gitignore", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const canonicalIgnore = readFileSync(
      join(checkoutRoot, "project-templates", ".gitignore")
    );
    writeFileSync(join(project, ".gitignore"), canonicalIgnore);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  if (!entryExists(gitignorePath)) {";
    assert.ok(initializer.includes(needle), "gitignore injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  renameSync(gitignorePath, gitignorePath + ".original");\n` +
          `  writeFileSync(gitignorePath, "dist/\\n");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /.gitignore changed during initialization/);
    assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates every seeded file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "seed verification injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  renameSync(join(canonicalTarget, \"AGENTS.md\"), join(canonicalTarget, \"AGENTS.md.original\"));\n" +
          "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent replacement policy\\n\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md changed during initialization/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent replacement policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates every preserved starter file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, "AGENTS.md"), "original project policy\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "preserved verification injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  renameSync(join(canonicalTarget, \"AGENTS.md\"), join(canonicalTarget, \"AGENTS.md.original\"));\n" +
          "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent preserved policy\\n\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md changed during initialization/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent preserved policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a file changed after ownership review", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    let initializer = readFileSync(initializerPath, "utf8");
    const ownershipNeedle =
      "          if (isOwnedFile(transaction, quarantineLeaf)) {";
    const failureNeedle =
      "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(ownershipNeedle), "ownership injection point must exist");
    assert.ok(initializer.includes(failureNeedle), "failure injection point must exist");
    initializer = initializer.replace(
      ownershipNeedle,
      ownershipNeedle +
        `\n            if (transaction.destination.endsWith("AGENTS.md")) {` +
        ` writeFileSync(quarantineLeaf, "concurrent after review\\n"); }`
    );
    initializer = initializer.replace(
      failureNeedle,
      `  throw new Error("injected rollback failure");\n\n` + failureNeedle
    );
    writeFileSync(initializerPath, initializer);

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    const quarantines = readdirSync(project).filter((name) =>
      name.startsWith("AGENTS.md.rollback-")
    );
    assert.equal(quarantines.length, 1);
    assert.equal(
      readFileSync(join(project, quarantines[0]), "utf8"),
      "concurrent after review\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a concurrently changed starter file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "late rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent user policy\\n\");\n" +
          "  throw new Error(\"injected late failure\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected late failure/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent user policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a concurrent starter directory in place", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  const concurrentStarter = join(canonicalTarget, \"AGENTS.md\");\n" +
          "  rmSync(concurrentStarter);\n" +
          "  mkdirSync(concurrentStarter);\n" +
          "  writeFileSync(join(concurrentStarter, \"keep.txt\"), \"keep me\\n\");\n" +
          "  throw new Error(\"injected starter directory replacement\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected starter directory replacement/);
    const starter = join(project, "AGENTS.md");
    assert.equal(lstatSync(starter).isDirectory(), true);
    assert.equal(readFileSync(join(starter, "keep.txt"), "utf8"), "keep me\n");
    assert.equal(
      readdirSync(project).some((name) => name.startsWith("AGENTS.md.rollback-")),
      false
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never dereferences a concurrent starter symlink", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalTarget = join(testRoot, "external-private.txt");
    mkdirSync(project);
    writeFileSync(externalTarget, "external private bytes\n");
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "symlink rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  const concurrentStarter = join(canonicalTarget, "AGENTS.md");\n` +
          `  const linkResult = spawnSync(process.execPath, [\n` +
          `    "-e",\n` +
          `    "const { symlinkSync, unlinkSync } = require('node:fs'); " +\n` +
          `      "unlinkSync(process.argv[1]); symlinkSync(process.argv[2], process.argv[1]);",\n` +
          `    concurrentStarter,\n` +
          `    ${JSON.stringify(externalTarget)}\n` +
          `  ], { encoding: "utf8", shell: false });\n` +
          `  if (linkResult.status !== 0) throw new Error(linkResult.stderr);\n` +
          `  throw new Error("injected symlink replacement");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected symlink replacement/);
    const restoredStarter = join(project, "AGENTS.md");
    assert.equal(lstatSync(restoredStarter).isSymbolicLink(), true);
    assert.equal(readlinkSync(restoredStarter), externalTarget);
    assert.equal(readFileSync(externalTarget, "utf8"), "external private bytes\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project rollback preserves a concurrently replaced empty directory", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  const concurrentDirectory = join(canonicalTarget, \"docs\", \"engineering\");\n" +
          "  renameSync(concurrentDirectory, `${concurrentDirectory}.concurrent-original`);\n" +
          "  mkdirSync(concurrentDirectory);\n" +
          "  throw new Error(\"injected directory replacement\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected directory replacement/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /docs.*engineering.*not removed.*manually/i);
    assert.equal(existsSync(join(project, "docs", "engineering")), true);
    assert.equal(
      existsSync(join(project, "docs", "engineering.concurrent-original")),
      true
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback reports a run-created directory with concurrent content", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory content injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  writeFileSync(join(canonicalTarget, \".github\", \"concurrent.txt\"), \"keep me\\n\");\n" +
          "  throw new Error(\"injected concurrent directory content\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected concurrent directory content/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /\.github.*not removed.*manually/i);
    assert.equal(
      readFileSync(join(project, ".github", "concurrent.txt"), "utf8"),
      "keep me\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never deletes directories by pathname", () => {
  const initializer = readFileSync(
    join(bootstrapRoot, "scripts", "init-project.mjs"),
    "utf8"
  );
  assert.doesNotMatch(initializer, /\brmdirSync\b/);
  assert.doesNotMatch(initializer, /unlinkSync\(quarantineLeaf\)/);
  assert.match(initializer, /review directory cleanup manually/);
  assert.match(initializer, /review target cleanup manually/);
  assert.match(initializer, /run-owned entry preserved at/);
});

await test("project initialization rejects a Git-owned workspace", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    for (const root of [project, workspaceRoot]) {
      const gitResult = spawnSync("git", ["init", "-q"], {
        cwd: root,
        encoding: "utf8",
        shell: false
      });
      assert.equal(gitResult.status, 0, gitResult.stderr);
    }

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root must stay outside Git/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project target boundaries reject unsafe or ambiguous roots", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const outside = join(testRoot, "outside");
    mkdirSync(outside);
    const outsideResult = runProjectInitializer(checkoutRoot, outside, testRoot);
    assert.notEqual(outsideResult.status, 0);
    assert.match(outsideResult.stderr, /inside the workspace/);

    const bootstrapResult = runProjectInitializer(checkoutRoot, checkoutRoot, testRoot);
    assert.notEqual(bootstrapResult.status, 0);
    assert.match(bootstrapResult.stderr, /cannot be machine-bootstrap/);

    const project = join(workspaceRoot, "project-a");
    const nested = join(project, "nested");
    mkdirSync(nested, { recursive: true });
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    const nestedResult = runProjectInitializer(checkoutRoot, nested, testRoot);
    assert.notEqual(nestedResult.status, 0);
    assert.match(nestedResult.stderr, /must be its Git root/);
    assert.equal(existsSync(join(nested, "AGENTS.md")), false);

    const missingNested = join(project, "new-nested");
    const missingNestedResult = runProjectInitializer(
      checkoutRoot,
      missingNested,
      testRoot,
      ["--create"]
    );
    assert.notEqual(missingNestedResult.status, 0);
    assert.match(
      missingNestedResult.stderr,
      /cannot be created inside existing Git repository/
    );
    assert.equal(existsSync(missingNested), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

// --- Workflow foundation ------------------------------------------------
// These checks never make a model or API call and never need Claude Code or
// Codex authentication: they read canonical files and generated bytes only.

const workflowSourceRoot = join(bootstrapRoot, "workflows", "product-delivery");
const workflowManifest = JSON.parse(
  readFileSync(join(workflowSourceRoot, "manifest.json"), "utf8")
);

await test("implementation reporting preserves waiver and status ownership", () => {
  const template = readFileSync(
    join(workflowSourceRoot, "templates", "implementation-report.md"),
    "utf8"
  );
  const deliveryLead = readFileSync(
    join(workflowSourceRoot, "roles", "delivery-lead.md"),
    "utf8"
  );
  assert.match(template, /Independent review status.*pending.*waived/i);
  assert.match(template, /Waiver reason/i);
  assert.match(template, /pending unless.*waived/i);
  assert.match(
    deliveryLead,
    /implemented`, `not implemented`, `deferred`, or\s+`self-unverified`/
  );
  assert.match(
    deliveryLead,
    /Verifier and\s+Verification Report alone use final `passed`, `failed`, `unverified`/
  );
  assert.doesNotMatch(deliveryLead, /check you did not\s+run is `unverified`/);
});

function workflowRelativePaths(manifest) {
  return [
    "manifest.json",
    manifest.workflowDocument,
    ...manifest.roles.map((role) => role.source),
    ...manifest.templates.map((template) => template.source)
  ];
}

function defaultAdapterPath(home, adapter) {
  const providerRoot = join(
    home,
    adapter.provider === "claude" ? ".claude" : ".codex"
  );
  return join(providerRoot, ...adapter.segments);
}

function snapshotTree(root) {
  const entries = [];
  const walk = (directory, prefix) => {
    const found = readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name)
    );
    for (const entry of found) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(join(directory, entry.name), relativePath);
      } else {
        const digest = createHash("sha256")
          .update(readFileSync(join(directory, entry.name)))
          .digest("hex");
        entries.push(`${relativePath}:${digest}`);
      }
    }
  };
  walk(root, "");
  return entries;
}

await test("workflow manifests and sources fail closed when invalid", async () => {
  const { loadWorkflowPackages } = await import("./lib/workflow-manifest.mjs");
  const testRoot = createTestHome("workflow-manifest");
  try {
    const workflowsRoot = join(testRoot, "workflows");
    cpSync(join(bootstrapRoot, "workflows"), workflowsRoot, {
      recursive: true
    });

    const { packages } = loadWorkflowPackages(workflowsRoot);
    assert.equal(packages.length, 1);
    assert.equal(packages[0].workflowId, "product-delivery");
    assert.equal(packages[0].manifest.roles.length, 3);

    const manifestPath = join(
      workflowsRoot,
      "product-delivery",
      "manifest.json"
    );
    const registryPath = join(workflowsRoot, "registry.json");
    const originalManifest = readFileSync(manifestPath, "utf8");
    const originalRegistry = readFileSync(registryPath, "utf8");

    const mutateManifest = (change) => {
      const manifest = JSON.parse(originalManifest);
      change(manifest);
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    };

    for (const [label, change, pattern] of [
      [
        "unsupported schema",
        (m) => { m.schemaVersion = 2; },
        /Unsupported workflow manifest/
      ],
      [
        "id does not match its directory",
        (m) => { m.workflowId = "somewhere-else"; },
        /does not match its directory/
      ],
      [
        "non-semver version",
        (m) => { m.workflowVersion = "1.0"; },
        /Invalid workflow version/
      ],
      [
        "traversing role source",
        (m) => { m.roles[0].source = "../escape.md"; },
        /unsafe source path/
      ],
      [
        "absent role source",
        (m) => { m.roles[0].source = "roles/absent.md"; },
        /must be a readable regular file/
      ],
      [
        "absent template source",
        (m) => { m.templates[0].source = "templates/absent.md"; },
        /must be a readable regular file/
      ],
      [
        "plugin-scoped Claude name",
        (m) => { m.roles[0].claude.name = "plugin:partner"; },
        /invalid Claude adapter/
      ],
      [
        "hyphenated Codex agent name",
        (m) => { m.roles[0].codex.name = "mb-product-partner"; },
        /invalid Codex adapter/
      ],
      [
        "duplicate Claude name",
        (m) => { m.roles[1].claude.name = m.roles[0].claude.name; },
        /Duplicate Claude agent name/
      ],
      [
        "duplicate Codex profile",
        (m) => { m.roles[1].codex.profile = m.roles[0].codex.profile; },
        /Duplicate Codex profile name/
      ],
      [
        "multi-line summary",
        (m) => { m.roles[0].summary = "first line\nsecond line"; },
        /single-line summary/
      ],
      [
        "no roles",
        (m) => { m.roles = []; },
        /declares no roles/
      ],
      [
        "no templates",
        (m) => { m.templates = []; },
        /declares no templates/
      ]
    ]) {
      mutateManifest(change);
      assert.throws(
        () => loadWorkflowPackages(workflowsRoot),
        pattern,
        `${label} must be rejected`
      );
    }

    writeFileSync(manifestPath, originalManifest);
    assert.equal(loadWorkflowPackages(workflowsRoot).packages.length, 1);

    for (const [label, contents, pattern] of [
      ["invalid JSON", "{ not json\n", /must contain valid JSON/],
      [
        "unsupported registry schema",
        '{ "schemaVersion": 9, "workflows": ["product-delivery"] }\n',
        /Unsupported workflow registry/
      ],
      [
        "empty roster",
        '{ "schemaVersion": 1, "workflows": [] }\n',
        /Unsupported workflow registry/
      ],
      [
        "traversing workflow id",
        '{ "schemaVersion": 1, "workflows": ["../escape"] }\n',
        /Invalid workflow id/
      ],
      [
        "unknown workflow",
        '{ "schemaVersion": 1, "workflows": ["absent-workflow"] }\n',
        /must be a readable regular file/
      ]
    ]) {
      writeFileSync(registryPath, contents);
      assert.throws(
        () => loadWorkflowPackages(workflowsRoot),
        pattern,
        `${label} must be rejected`
      );
    }

    writeFileSync(registryPath, originalRegistry);
    assert.equal(loadWorkflowPackages(workflowsRoot).packages.length, 1);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test(
  "absent provider overrides use the default configuration roots",
  () => {
  const testHome = createTestHome("workflow-install");
  try {
    const result = runScript("install-workflows.mjs", [], testHome);
    assert.equal(result.status, 0, result.stderr);

    const installedRoot = join(
      testHome,
      ".agents",
      "workflows",
      "product-delivery"
    );
    for (const relativePath of workflowRelativePaths(workflowManifest)) {
      const segments = relativePath.split("/");
      assert.deepEqual(
        readFileSync(join(installedRoot, ...segments)),
        readFileSync(join(workflowSourceRoot, ...segments)),
        `${relativePath} must install byte-identically`
      );
    }

    for (const role of workflowManifest.roles) {
      assert.equal(
        existsSync(join(testHome, ".claude", "agents", `${role.claude.name}.md`)),
        true,
        `${role.id} Claude agent`
      );
      assert.equal(
        existsSync(join(testHome, ".codex", "agents", `${role.codex.name}.toml`)),
        true,
        `${role.id} Codex agent`
      );
      assert.equal(
        existsSync(
          join(testHome, ".codex", `${role.codex.profile ?? "absent"}.config.toml`)
        ),
        Boolean(role.codex.profile),
        `${role.id} Codex profile`
      );
    }

    // Provider settings and agent teams are never created or enabled.
    assert.equal(existsSync(join(testHome, ".claude", "settings.json")), false);
    assert.equal(existsSync(join(testHome, ".codex", "config.toml")), false);

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
    assert.match(verify.stdout, /Verified 1 workflow\(s\)/);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
  }
);

await test("custom provider configuration roots receive only their adapters", () => {
  const testHome = createTestHome("workflow-custom-provider-roots");
  const claudeConfigRoot = join(testHome, "provider-roots", "claude");
  const codexHome = join(testHome, "provider-roots", "codex");
  const preserved = [
    [join(claudeConfigRoot, "settings.json"), '{ "custom": "claude" }\n'],
    [join(claudeConfigRoot, "agents", "mine.md"), "# mine\n"],
    [join(codexHome, "config.toml"), 'custom = "codex"\n'],
    [join(codexHome, "agents", "mine.toml"), 'name = "mine"\n'],
    [
      join(testHome, ".claude", "settings.json"),
      '{ "inactiveDefault": "claude" }\n'
    ],
    [
      join(testHome, ".codex", "config.toml"),
      'inactive_default = "codex"\n'
    ]
  ];
  try {
    for (const [path, contents] of preserved) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    const overrides = {
      CLAUDE_CONFIG_DIR: claudeConfigRoot,
      CODEX_HOME: codexHome
    };
    const result = runScript("install-workflows.mjs", [], testHome, overrides);
    assert.equal(result.status, 0, result.stderr);

    for (const role of workflowManifest.roles) {
      assert.equal(
        existsSync(join(claudeConfigRoot, "agents", `${role.claude.name}.md`)),
        true,
        `${role.id} Claude agent uses CLAUDE_CONFIG_DIR`
      );
      assert.equal(
        existsSync(join(codexHome, "agents", `${role.codex.name}.toml`)),
        true,
        `${role.id} Codex agent uses CODEX_HOME`
      );
      if (role.codex.profile) {
        assert.equal(
          existsSync(join(codexHome, `${role.codex.profile}.config.toml`)),
          true,
          `${role.id} Codex profile uses CODEX_HOME`
        );
      }
      assert.equal(
        existsSync(join(testHome, ".claude", "agents", `${role.claude.name}.md`)),
        false,
        "the default Claude root is not used when overridden"
      );
      assert.equal(
        existsSync(join(testHome, ".codex", "agents", `${role.codex.name}.toml`)),
        false,
        "the default Codex root is not used when overridden"
      );
    }

    for (const [path, contents] of preserved) {
      assert.equal(readFileSync(path, "utf8"), contents, path);
    }
    assert.equal(
      existsSync(
        join(testHome, ".agents", "workflows", "product-delivery", "WORKFLOW.md")
      ),
      true,
      "the provider-neutral package remains under the isolated home"
    );

    const verify = runScript(
      "install-workflows.mjs",
      ["--check"],
      testHome,
      overrides
    );
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("provider adapters generate deterministically", async () => {
  const { loadWorkflowPackages } = await import("./lib/workflow-manifest.mjs");
  const { generateProviderAdapters } = await import(
    "./lib/workflow-adapters.mjs"
  );
  const { packages } = loadWorkflowPackages(join(bootstrapRoot, "workflows"));

  const first = generateProviderAdapters(packages[0]);
  const second = generateProviderAdapters(packages[0]);
  assert.deepEqual(second, first);
  assert.equal(first.length, 8);

  const homeA = createTestHome("workflow-determinism-a");
  const homeB = createTestHome("workflow-determinism-b");
  try {
    for (const home of [homeA, homeB]) {
      const result = runScript("install-workflows.mjs", [], home);
      assert.equal(result.status, 0, result.stderr);
    }
    for (const adapter of first) {
      const relativePath = `${adapter.provider}/${adapter.segments.join("/")}`;
      assert.deepEqual(
        readFileSync(defaultAdapterPath(homeA, adapter)),
        readFileSync(defaultAdapterPath(homeB, adapter)),
        `${relativePath} must be identical across installs`
      );
      assert.equal(
        readFileSync(defaultAdapterPath(homeA, adapter), "utf8"),
        adapter.contents,
        `${relativePath} must match its generated bytes`
      );
    }
  } finally {
    rmSync(homeA, { recursive: true, force: true });
    rmSync(homeB, { recursive: true, force: true });
  }
});

await test("Codex TOML encoding round-trips adversarial Markdown contracts", async () => {
  const testRoot = createTestHome("workflow-toml-fixture");
  const source = join(testRoot, "role.md");
  const fixture =
    "  leading whitespace\r\n" +
    'Double quotes: "quoted" and triple: """\r\n' +
    "Single delimiter too: '''\r\n" +
    "Windows path: C:\\Users\\Example\\workflow.md\r\n" +
    "\r\n```powershell\r\n" +
    'Write-Output "héllo 世界"\r\n' +
    "```\r\n" +
    "TOML controls: " +
    Array.from({ length: 0x20 }, (_, index) => String.fromCharCode(index)).join("") +
    String.fromCharCode(0x7f) +
    "\r\n" +
    "trailing whitespace   ";
  const normalizedFixture = fixture
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n") + "\n";
  try {
    writeFileSync(source, fixture);
    const role = {
      id: "adversarial",
      summary: 'Quotes " and path C:\\docs\\role',
      source: "role.md",
      claude: { name: "adversarial", primarySession: true },
      codex: { name: "adversarial", profile: "adversarial" }
    };
    const pkg = {
      root: testRoot,
      manifest: {
        workflowId: "fixture",
        workflowVersion: "1.0.0",
        schemaVersion: 1
      }
    };
    const { generateCodexAgent, generateCodexProfile } = await import(
      "./lib/workflow-adapters.mjs"
    );

    const externalParser = process.env.MACHINE_BOOTSTRAP_TOML_PYTHON;
    let externallyParsed = 0;
    for (const generated of [
      generateCodexAgent(pkg, role),
      generateCodexProfile(pkg, role)
    ]) {
      const encoded =
        generated.match(/^developer_instructions = (.+)$/m)?.[1] ?? "null";
      assert.equal(JSON.parse(encoded), normalizedFixture);
      assert.equal(
        encoded,
        JSON.stringify(normalizedFixture).replaceAll("\u007f", "\\u007F")
      );
      assert.match(generated, /\\"\\"\\"/);
      assert.match(generated, /C:\\\\Users\\\\Example/);
      assert.match(generated, /héllo 世界/);
      assert.doesNotMatch(generated, /\u007f/);
      assert.match(generated, /\\u007F/);
      assert.doesNotMatch(generated, /^developer_instructions = '''/m);

      if (externalParser) {
        const parsed = spawnSync(
          externalParser,
          [
            "-c",
            "import sys, tomllib; tomllib.loads(sys.stdin.read())"
          ],
          {
            encoding: "utf8",
            env: { ...process.env, PYTHONUTF8: "1" },
            input: generated,
            shell: false
          }
        );
        assert.equal(parsed.status, 0, parsed.stderr || parsed.error?.message);
        externallyParsed += 1;
      }
    }
    if (externalParser) {
      console.log(
        `TOML parser validation: Python tomllib parsed ${externallyParsed} ` +
        "adversarial fixture(s)"
      );
    } else {
      console.log(
        "TOML parser validation: not run; set " +
        "MACHINE_BOOTSTRAP_TOML_PYTHON to an available Python 3.11+ executable"
      );
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("adapters carry provenance and the canonical role contract", () => {
  const testHome = createTestHome("workflow-provenance");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);
    const version = workflowManifest.workflowVersion.replaceAll(".", "\\.");

    for (const role of workflowManifest.roles) {
      const contract = readFileSync(
        join(workflowSourceRoot, ...role.source.split("/")),
        "utf8"
      )
        .replaceAll("\r\n", "\n")
        .replaceAll("\r", "\n");
      const normalizedContract = contract.endsWith("\n")
        ? contract
        : `${contract}\n`;

      const claudeFile = readFileSync(
        join(testHome, ".claude", "agents", `${role.claude.name}.md`),
        "utf8"
      );
      assert.match(claudeFile, new RegExp(`^---\\nname: ${role.claude.name}\\n`));
      assert.match(claudeFile, /^description: "/m);
      assert.match(claudeFile, /Generated by machine-bootstrap/);
      assert.match(
        claudeFile,
        new RegExp(`workflow: product-delivery ${version} \\(schema 1\\)`)
      );
      assert.match(claudeFile, new RegExp(`role: ${role.id}\\b`));
      assert.match(
        claudeFile,
        new RegExp(`source: workflows/product-delivery/${role.source}`)
      );
      assert.ok(
        claudeFile.includes(normalizedContract),
        `${role.id} Claude adapter must carry the canonical contract`
      );

      const codexFile = readFileSync(
        join(testHome, ".codex", "agents", `${role.codex.name}.toml`),
        "utf8"
      );
      assert.match(codexFile, /^# Generated by machine-bootstrap/);
      assert.match(codexFile, new RegExp(`^name = "${role.codex.name}"$`, "m"));
      assert.match(codexFile, /^description = "/m);
      const codexInstructions = JSON.parse(
        codexFile.match(/^developer_instructions = (.+)$/m)?.[1] ?? "null"
      );
      assert.equal(
        codexInstructions,
        normalizedContract,
        `${role.id} Codex adapter must carry the canonical contract`
      );

      if (!role.codex.profile) continue;
      const profile = readFileSync(
        join(testHome, ".codex", `${role.codex.profile}.config.toml`),
        "utf8"
      );
      assert.match(
        profile,
        new RegExp(`Launch: codex --profile ${role.codex.profile}`)
      );
      const profileInstructions = JSON.parse(
        profile.match(/^developer_instructions = (.+)$/m)?.[1] ?? "null"
      );
      assert.equal(profileInstructions, normalizedContract);
      // Profiles are separate files with top-level keys, not [profiles.x]
      // tables inside config.toml.
      assert.doesNotMatch(profile, /^\[profiles\./m);
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("generated adapters pin no model", () => {
  const testHome = createTestHome("workflow-model");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);

    const claudeAgents = join(testHome, ".claude", "agents");
    const codexAgents = join(testHome, ".codex", "agents");
    const codexHome = join(testHome, ".codex");
    const generated = [
      ...readdirSync(claudeAgents).map((name) => join(claudeAgents, name)),
      ...readdirSync(codexAgents).map((name) => join(codexAgents, name)),
      ...readdirSync(codexHome)
        .filter((name) => name.endsWith(".config.toml"))
        .map((name) => join(codexHome, name))
    ];
    assert.equal(generated.length, 8);

    for (const file of generated) {
      const contents = readFileSync(file, "utf8");
      assert.doesNotMatch(contents, /^\s*model\s*[:=]/m, file);
      assert.doesNotMatch(contents, /^\s*model_reasoning_effort\s*=/m, file);
      assert.doesNotMatch(
        contents,
        /claude-(opus|sonnet|haiku|fable)|gpt-\d|\bo\d-(mini|preview)\b/i,
        file
      );
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workflow installation leaves unrelated provider files untouched", () => {
  const testHome = createTestHome("workflow-untouched");
  try {
    const preserved = [
      [join(testHome, ".claude", "settings.json"), '{ "theme": "dark" }\n'],
      [
        join(testHome, ".claude", "agents", "my-own-agent.md"),
        "---\nname: my-own-agent\ndescription: mine\n---\n\nMine.\n"
      ],
      [join(testHome, ".codex", "config.toml"), 'approval_policy = "on-request"\n'],
      [
        join(testHome, ".codex", "agents", "my_own_agent.toml"),
        'name = "my_own_agent"\n'
      ],
      [join(testHome, ".codex", "my-own.config.toml"), 'sandbox_mode = "read-only"\n'],
      [join(testHome, ".agents", "skills", "keep", "SKILL.md"), "# keep\n"]
    ];
    for (const [path, contents] of preserved) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    const result = runScript("install-workflows.mjs", [], testHome);
    assert.equal(result.status, 0, result.stderr);

    for (const [path, contents] of preserved) {
      assert.equal(readFileSync(path, "utf8"), contents, path);
    }
    for (const directory of [
      join(testHome, ".claude"),
      join(testHome, ".claude", "agents"),
      join(testHome, ".codex"),
      join(testHome, ".codex", "agents")
    ]) {
      assert.equal(
        readdirSync(directory).some((name) => name.includes(".backup-")),
        false,
        `${directory} must have no backups`
      );
    }
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workflow installation is missing-only by default", () => {
  const testHome = createTestHome("workflow-missing-only");
  try {
    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);

    const adapterPath = join(testHome, ".claude", "agents", "mb-verifier.md");
    const workflowDocument = join(
      testHome,
      ".agents",
      "workflows",
      "product-delivery",
      "WORKFLOW.md"
    );
    const documentBefore = readFileSync(workflowDocument);
    rmSync(adapterPath);

    const second = runScript("install-workflows.mjs", [], testHome);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /Placed .*mb-verifier\.md/);
    assert.equal(
      (second.stdout.match(/^Placed /gm) ?? []).length,
      1,
      "only the missing adapter is written"
    );
    assert.match(second.stdout, /Current: .*WORKFLOW\.md/);
    assert.deepEqual(readFileSync(workflowDocument), documentBefore);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("a differing workflow destination is rejected before any write", () => {
  const testHome = createTestHome("workflow-drift");
  try {
    const adapterPath = join(testHome, ".claude", "agents", "mb-verifier.md");
    mkdirSync(dirname(adapterPath), { recursive: true });
    writeFileSync(adapterPath, "my own verifier\n");

    const result = runScript("install-workflows.mjs", [], testHome);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires review before making changes/);
    assert.match(result.stderr, /use --replace if approved/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);

    assert.equal(readFileSync(adapterPath, "utf8"), "my own verifier\n");
    assert.equal(existsSync(join(testHome, ".agents")), false);
    assert.equal(existsSync(join(testHome, ".codex")), false);
    assert.deepEqual(readdirSync(join(testHome, ".claude", "agents")), [
      "mb-verifier.md"
    ]);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("reviewed workflow replacement preserves recoverable backups", () => {
  const testHome = createTestHome("workflow-replace");
  try {
    const adapterPath = join(testHome, ".claude", "agents", "mb-verifier.md");
    const documentPath = join(
      testHome,
      ".agents",
      "workflows",
      "product-delivery",
      "WORKFLOW.md"
    );
    for (const [path, contents] of [
      [adapterPath, "customized verifier\n"],
      [documentPath, "customized workflow\n"]
    ]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents);
    }

    const result = runScript("install-workflows.mjs", ["--replace"], testHome);
    assert.equal(result.status, 0, result.stderr);

    assert.match(readFileSync(adapterPath, "utf8"), /^---\nname: mb-verifier\n/);
    assert.deepEqual(
      readFileSync(documentPath),
      readFileSync(join(workflowSourceRoot, "WORKFLOW.md"))
    );

    for (const [path, contents] of [
      [adapterPath, "customized verifier\n"],
      [documentPath, "customized workflow\n"]
    ]) {
      const backupName = readdirSync(dirname(path)).find((name) =>
        name.startsWith(`${path.split(sep).pop()}.backup-`)
      );
      assert.ok(backupName, `${path} was preserved as a backup`);
      assert.equal(
        readFileSync(join(dirname(path), backupName), "utf8"),
        contents
      );
    }

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("a later workflow failure restores replacements and removes partial writes", () => {
  const testHome = createTestHome("workflow-rollback");
  const installedRoot = join(
    testHome,
    ".agents",
    "workflows",
    "product-delivery"
  );
  const manifestPath = join(installedRoot, "manifest.json");
  const claudeRoot = join(testHome, "custom-claude");
  const adapterPath = join(claudeRoot, "agents", "mb-product-partner.md");
  // This is absent during root validation but becomes a regular workflow file
  // before the Codex phase, forcing a deterministic late ENOTDIR failure.
  const codexHome = join(installedRoot, "WORKFLOW.md");
  try {
    mkdirSync(dirname(manifestPath), { recursive: true });
    mkdirSync(dirname(adapterPath), { recursive: true });
    writeFileSync(manifestPath, "original manifest\n");
    writeFileSync(adapterPath, "original Claude adapter\n");

    const result = runScript(
      "install-workflows.mjs",
      ["--replace"],
      testHome,
      { CLAUDE_CONFIG_DIR: claudeRoot, CODEX_HOME: codexHome }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workflow setup failed:/);
    assert.equal(readFileSync(manifestPath, "utf8"), "original manifest\n");
    assert.equal(
      readFileSync(adapterPath, "utf8"),
      "original Claude adapter\n"
    );
    assert.deepEqual(readdirSync(installedRoot), ["manifest.json"]);
    assert.deepEqual(readdirSync(join(claudeRoot, "agents")), [
      "mb-product-partner.md"
    ]);
    assert.equal(
      snapshotTree(testHome).some((entry) => entry.includes(".backup-")),
      false,
      "restored originals leave no orphan backup"
    );
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workflow check mode is read-only", () => {
  const testHome = createTestHome("workflow-check");
  try {
    const missing = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /Workflow verification failed:/);
    assert.match(missing.stderr, /is missing/);
    assert.doesNotMatch(missing.stderr, /file:\/\/|node:internal/);
    assert.deepEqual(readdirSync(testHome), [], "check mode wrote nothing");

    assert.equal(runScript("install-workflows.mjs", [], testHome).status, 0);
    const before = snapshotTree(testHome);

    const verify = runScript("install-workflows.mjs", ["--check"], testHome);
    assert.equal(verify.status, 0, verify.stderr);
    assert.doesNotMatch(verify.stdout, /^Placed /m);
    assert.deepEqual(snapshotTree(testHome), before);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("workspace initialization installs and verifies workflows", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
    assert.equal(
      existsSync(
        join(testRoot, ".agents", "workflows", "product-delivery", "WORKFLOW.md")
      ),
      true
    );
    assert.equal(
      existsSync(join(testRoot, ".claude", "agents", "mb-delivery-lead.md")),
      true
    );
    assert.equal(
      existsSync(join(testRoot, ".codex", "agents", "mb_verifier.toml")),
      true
    );
    assert.equal(
      existsSync(join(testRoot, ".codex", "mb-product-partner.config.toml")),
      true
    );
    assert.match(result.stdout, /Verified 1 workflow\(s\)/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workspace initialization preflights workflow conflicts before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const conflict = join(testRoot, ".claude", "agents", "mb-verifier.md");
  try {
    mkdirSync(dirname(conflict), { recursive: true });
    writeFileSync(conflict, "my verifier\n");

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workflow preflight failed:/);
    assert.match(result.stderr, /mb-verifier\.md/);
    assert.equal(readFileSync(conflict, "utf8"), "my verifier\n");
    for (const path of ["AGENTS.md", "CLAUDE.md", "MACHINE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, path)), false, path);
    }
    assert.equal(existsSync(join(testRoot, ".agents")), false);
    assert.equal(existsSync(join(testRoot, ".codex")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("--skip-workflows performs no workflow writes or verification", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Workflow foundation: skipped by request/);
    assert.doesNotMatch(result.stdout, /Verified 1 workflow\(s\)/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
    assert.equal(existsSync(join(testRoot, ".agents")), false);
    assert.equal(existsSync(join(testRoot, ".claude")), false);
    assert.equal(existsSync(join(testRoot, ".codex")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("malformed workflow data fails before workspace writes", () => {
  for (const [label, relativePath, contents, pattern] of [
    [
      "invalid manifest JSON",
      join("workflows", "product-delivery", "manifest.json"),
      "{ invalid json\n",
      /Workflow manifest must contain valid JSON/
    ],
    [
      "invalid registry roster",
      join("workflows", "registry.json"),
      '{ "schemaVersion": 1, "workflows": ["../escape"] }\n',
      /Invalid workflow id/
    ]
  ]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      writeFileSync(join(checkoutRoot, relativePath), contents);

      const result = spawnSync(
        process.execPath,
        [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
        {
          encoding: "utf8",
          env: isolatedEnvironment(testRoot),
          shell: false
        }
      );

      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, pattern, label);
      assert.doesNotMatch(
        result.stderr,
        /file:\/\/|node:internal|SyntaxError/,
        label
      );
      assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false, label);
      assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false, label);
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false, label);
      assert.equal(existsSync(join(workspaceRoot, "_templates")), false, label);
      assert.equal(existsSync(join(testRoot, ".agents")), false, label);
      assert.equal(existsSync(join(testRoot, ".claude")), false, label);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("a missing role contract fails before any workflow write", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    rmSync(
      join(checkoutRoot, "workflows", "product-delivery", "roles", "verifier.md")
    );

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must be a readable regular file/);
    assert.doesNotMatch(result.stderr, /ENOENT|file:\/\/|node:internal/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(testRoot, ".agents")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workflow setup rejects bad arguments without stack traces", () => {
  for (const scriptArgs of [["--bogus"], ["--check", "--replace"]]) {
    const result = runScript("install-workflows.mjs", scriptArgs);
    const label = `install-workflows.mjs ${scriptArgs.join(" ")}`;
    assert.notEqual(result.status, 0, label);
    assert.match(result.stderr, /Workflow setup failed:/, label);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/, label);
  }

  const skipped = runScript("init-workspace.mjs", ["--skip-workflow"]);
  assert.notEqual(skipped.status, 0);
  assert.match(skipped.stderr, /Unknown argument\(s\): --skip-workflow/);
  assert.doesNotMatch(skipped.stderr, /file:\/\/|node:internal/);
});

if (failures.length) {
  console.error(`\n${failures.length} bootstrap test(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (skipped.length) {
  const byReason = new Map();
  for (const entry of skipped) {
    if (!byReason.has(entry.reason)) byReason.set(entry.reason, []);
    byReason.get(entry.reason).push(entry.name);
  }

  console.log(`\n${skipped.length} test(s) skipped:`);
  for (const [reason, names] of byReason) {
    console.log(`\n${reason}:`);
    for (const name of names) console.log(`- ${name}`);
  }
  if (!rosterInstalled) {
    console.log(
      "\nRun node scripts/init-workspace.mjs, then rerun to cover the roster " +
      "checks."
    );
  }
}

console.log(
  `\nAll executed bootstrap tests passed${skipped.length ? ` (${skipped.length} skipped)` : ""}.`
);
