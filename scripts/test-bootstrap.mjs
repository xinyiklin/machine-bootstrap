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
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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

function createTestWorkspace() {
  const testRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-test-"));
  const workspaceRoot = join(testRoot, "Workspace");
  const checkoutRoot = join(workspaceRoot, "machine-bootstrap");
  mkdirSync(checkoutRoot, { recursive: true });
  const gitRoot = join(bootstrapRoot, ".git");
  cpSync(bootstrapRoot, checkoutRoot, {
    recursive: true,
    filter: (source) =>
      source !== gitRoot && !source.startsWith(`${gitRoot}${sep}`)
  });
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
    ["setup-guides.mjs", ["--bogus"]],
    ["setup-guides.mjs", ["--check", "--replace"]],
    ["install-skills.mjs", ["--bogus"]],
    ["init-workspace.mjs", ["--bogus"]]
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
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("an invalid manifest entry fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const manifestPath = join(checkoutRoot, "skills.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.skills[0].sourceRevision = "main";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

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
    assert.match(result.stderr, /Invalid skill entry in .*skills\.json/);
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a wrong-typed portable source fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    rmSync(join(checkoutRoot, "guides", "AGENTS.md"));
    mkdirSync(join(checkoutRoot, "guides", "AGENTS.md"));

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
    assert.match(
      result.stderr,
      /guides\/AGENTS\.md must be a readable regular file/
    );
    assert.doesNotMatch(result.stderr, /EISDIR|file:\/\/|node:internal/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project template ignores local agent state", () => {
  const ignorePath = join(bootstrapRoot, "project-templates", ".gitignore");
  assert.equal(existsSync(ignorePath), true);
  const ignore = readFileSync(ignorePath, "utf8");
  assert.match(ignore, /^CLAUDE\.local\.md$/m);
  assert.match(ignore, /^\.claude\/settings\.local\.json$/m);
  assert.match(ignore, /^\.agent-work\/$/m);
});

await test("project template no longer ignores all of .claude/", () => {
  const ignore = readFileSync(
    join(bootstrapRoot, "project-templates", ".gitignore"),
    "utf8"
  );
  assert.doesNotMatch(ignore, /^\.claude\/?$/m);
  assert.doesNotMatch(ignore, /^\.codex\/?$/m);

  // A project that chooses to own reviewable agent configuration must be able
  // to track it. These paths are only allowed, never created.
  for (const trackable of [
    ".claude/agents/reviewer.md",
    ".claude/settings.json",
    ".claude/rules/api.md",
    ".codex/agents/reviewer.toml",
    ".codex/config.toml"
  ]) {
    assert.equal(
      ignore.split(/\r?\n/).some((line) => {
        const pattern = line.trim();
        if (!pattern || pattern.startsWith("#") || pattern.startsWith("!")) {
          return false;
        }
        const bare = pattern.replace(/\/$/, "");
        return trackable === bare || trackable.startsWith(`${bare}/`);
      }),
      false,
      `${trackable} must stay trackable`
    );
  }
});

await test("project template keeps its existing safety exclusions", () => {
  const ignore = readFileSync(
    join(bootstrapRoot, "project-templates", ".gitignore"),
    "utf8"
  );
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.match(ignore, /^\.DS_Store$/m);
  assert.match(ignore, /^Thumbs\.db$/m);
});

await test("project template documents the workflow adaptation points", () => {
  const template = readFileSync(
    join(bootstrapRoot, "project-templates", "AGENTS.md"),
    "utf8"
  );
  assert.match(template, /## Workflow Adaptations/);
  assert.match(template, /~\/\.agents\/workflows\/product-delivery\//);
  assert.match(template, /may not weaken exact user\s+approval/);
  assert.match(template, /one fresh reviewer after the\s+implementer's own verification/);
  assert.match(template, /Only the user may waive it for a specific\s+change/);
  // The portable contract must be referenced, not copied into every project.
  assert.doesNotMatch(template, /Foundational Invariants/);
});

await test("portable GitHub workflow and PR templates are present", () => {
  const portableGuide = readFileSync(
    join(bootstrapRoot, "guides", "git-workflow.md"),
    "utf8"
  );
  const projectGuide = readFileSync(
    join(
      bootstrapRoot,
      "project-templates",
      "docs",
      "engineering",
      "git-workflow.md"
    ),
    "utf8"
  );
  const projectTemplate = readFileSync(
    join(
      bootstrapRoot,
      "project-templates",
      ".github",
      "pull_request_template.md"
    ),
    "utf8"
  );
  const bootstrapTemplate = readFileSync(
    join(bootstrapRoot, ".github", "pull_request_template.md"),
    "utf8"
  );

  for (const guide of [portableGuide, projectGuide]) {
    assert.match(guide, /Conventional Commit/);
    assert.match(guide, /exact reviewed head/);
    assert.match(guide, /squash merge/);
    assert.match(guide, /Publication receipt/);
  }
  assert.match(projectTemplate, /## Summary/);
  assert.match(projectTemplate, /## Verification/);
  assert.match(projectTemplate, /## Publication/);
  assert.match(bootstrapTemplate, /guides\/git-workflow\.md/);
});

await test("portable guidance requires current dependency selection", () => {
  for (const relativePath of [
    ["guides", "AGENTS.md"],
    ["project-templates", "AGENTS.md"]
  ]) {
    const guide = readFileSync(join(bootstrapRoot, ...relativePath), "utf8");
    assert.match(guide, /current stable or maintainer-recommended release/);
    assert.match(guide, /official registry, documentation, or release notes/);
    assert.match(
      guide,
      /never select a dependency\s+version from model memory alone/
    );
    assert.match(guide, /latest compatible stable release/);
    assert.match(
      guide,
      /Preserve the project's package\s+manager and version-range policy/
    );
    assert.match(guide, /update its lockfile when the project tracks\s+one/);
    assert.match(
      guide,
      /explain any\s+deliberate use of an older or prerelease version/
    );
  }
});

await test("workflow defaults to one independent review", () => {
  const workflow = readFileSync(
    join(bootstrapRoot, "workflows", "product-delivery", "WORKFLOW.md"),
    "utf8"
  );
  const deliveryLead = readFileSync(
    join(
      bootstrapRoot,
      "workflows",
      "product-delivery",
      "roles",
      "delivery-lead.md"
    ),
    "utf8"
  );

  assert.match(workflow, /version `1\.2\.0`/);
  assert.match(workflow, /one\s+independent review by default/);
  assert.match(workflow, /Only the user may waive that review/);
  assert.match(workflow, /inspect(?:ing)? the complete diff/);
  assert.match(deliveryLead, /give a firm\s+recommendation/);
  assert.match(deliveryLead, /Honor\s+the request/);
  assert.match(deliveryLead, /inspect the complete diff yourself/);

  const verificationReport = readFileSync(
    join(
      bootstrapRoot,
      "workflows",
      "product-delivery",
      "templates",
      "verification-report.md"
    ),
    "utf8"
  );
  assert.match(verificationReport, /Additional review recommendation/);
  assert.match(verificationReport, /after\s+reviewing the first Verifier's evidence/);
  assert.match(verificationReport, /not applicable — independent review waived/);

  assert.match(workflow, /normal completed task uses Product Brief, Delivery Plan/);
  assert.match(workflow, /Decision Log only for\s+material product decisions/);
  assert.match(workflow, /Never create empty placeholder artifacts/);
  assert.match(workflow, /\[TASK <task-id>\]/);
  assert.match(workflow, /removes that ignore rule and also tracks each completed/);

  const productPartner = readFileSync(
    join(
      bootstrapRoot,
      "workflows",
      "product-delivery",
      "roles",
      "product-partner.md"
    ),
    "utf8"
  );
  assert.match(productPartner, /Decision Log only when a\s+material product decision/);
  assert.match(productPartner, /do not create an empty one/);
});

await test("clean workspace initializes the portable guidance layer", () => {
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
    assert.equal(
      readFileSync(join(workspaceRoot, "AGENTS.md"), "utf8"),
      readFileSync(join(checkoutRoot, "guides", "AGENTS.md"), "utf8")
    );
    assert.equal(
      readFileSync(join(workspaceRoot, "CLAUDE.md"), "utf8"),
      readFileSync(join(checkoutRoot, "guides", "CLAUDE.md"), "utf8")
    );
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
    assert.equal(existsSync(join(workspaceRoot, "_templates", ".gitignore")), true);
    assert.match(result.stdout, /Next required step: replace \d+ TODO/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("portable drift fails before any partial workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const templatesRoot = join(workspaceRoot, "_templates");
    mkdirSync(templatesRoot);
    copyFileSync(
      join(checkoutRoot, "README.md"),
      join(templatesRoot, "AGENTS.md")
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
    assert.match(result.stderr, /requires review before making changes/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a byte-identical symlinked guide verifies as current", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    copyFileSync(
      join(checkoutRoot, "guides", "AGENTS.md"),
      join(workspaceRoot, "AGENTS.md")
    );
    symlinkSync(
      join(checkoutRoot, "guides", "CLAUDE.md"),
      join(workspaceRoot, "CLAUDE.md")
    );
    copyFileSync(
      join(checkoutRoot, "guides", "MACHINE.example.md"),
      join(workspaceRoot, "MACHINE.md")
    );
    cpSync(
      join(checkoutRoot, "project-templates"),
      join(workspaceRoot, "_templates"),
      { recursive: true }
    );

    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--check",
        "--skip-skills"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.match(result.stdout, /Current: .*CLAUDE\.md/);
    assert.doesNotMatch(result.stderr, /CLAUDE\.md is not a regular file/);
    assert.doesNotMatch(result.stderr, /CLAUDE\.md differs/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("a broken symlink is named rather than called drift", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    symlinkSync(join(testRoot, "absent.md"), join(workspaceRoot, "CLAUDE.md"));

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
    assert.match(result.stderr, /CLAUDE\.md is a broken symbolic link/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("reviewed replacement never writes through a symlinked guide", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const externalPath = join(testRoot, "external.md");
    writeFileSync(externalPath, "external content\n");
    symlinkSync(externalPath, join(workspaceRoot, "CLAUDE.md"));

    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--replace"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(externalPath, "utf8"),
      "external content\n",
      "the symlink target must not be overwritten"
    );
    assert.equal(
      readFileSync(join(workspaceRoot, "CLAUDE.md"), "utf8"),
      readFileSync(join(checkoutRoot, "guides", "CLAUDE.md"), "utf8")
    );
    const backupName = readdirSync(workspaceRoot).find((name) =>
      name.startsWith("CLAUDE.md.backup-")
    );
    assert.ok(backupName, "the replaced symlink was preserved as a backup");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("a wrong-typed workspace guide is named, not called drift", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    mkdirSync(join(workspaceRoot, "AGENTS.md"));

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
    assert.match(result.stderr, /AGENTS\.md is a directory where a file belongs/);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("an unreadable destination is reported instead of crashing", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const templatesPath = join(workspaceRoot, "_templates");
  try {
    mkdirSync(templatesPath);
    chmodSync(templatesPath, 0o000);

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
    assert.match(result.stderr, /_templates is not readable/);
    assert.doesNotMatch(result.stderr, /EACCES|node:internal/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
  } finally {
    chmodSync(templatesPath, 0o755);
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsPosixPermissions: true });

await test("reviewed replacement recovers from a wrong-typed guide", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    mkdirSync(join(workspaceRoot, "AGENTS.md"));
    writeFileSync(join(workspaceRoot, "AGENTS.md", "stray.txt"), "stray\n");

    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--replace"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "AGENTS.md"), "utf8"),
      readFileSync(join(checkoutRoot, "guides", "AGENTS.md"), "utf8")
    );
    const backupName = readdirSync(workspaceRoot).find((name) =>
      name.startsWith("AGENTS.md.backup-")
    );
    assert.ok(backupName, "the replaced directory was backed up");
    assert.equal(
      readFileSync(join(workspaceRoot, backupName, "stray.txt"), "utf8"),
      "stray\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("reviewed replacement backs up portable drift and preserves machine facts", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    writeFileSync(join(workspaceRoot, "AGENTS.md"), "old agents\n");
    writeFileSync(join(workspaceRoot, "CLAUDE.md"), "old claude\n");
    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    mkdirSync(join(workspaceRoot, "_templates"));
    writeFileSync(join(workspaceRoot, "_templates", "old.txt"), "old template\n");

    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--replace"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "AGENTS.md"), "utf8"),
      readFileSync(join(checkoutRoot, "guides", "AGENTS.md"), "utf8")
    );
    assert.equal(
      readFileSync(join(workspaceRoot, "CLAUDE.md"), "utf8"),
      readFileSync(join(checkoutRoot, "guides", "CLAUDE.md"), "utf8")
    );
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );
    assert.equal(
      readFileSync(join(workspaceRoot, "_templates", ".gitignore"), "utf8"),
      readFileSync(join(checkoutRoot, "project-templates", ".gitignore"), "utf8")
    );

    const backupNames = readdirSync(workspaceRoot).filter((name) =>
      name.includes(".backup-")
    );
    assert.equal(backupNames.length, 3);
    const agentBackup = backupNames.find((name) =>
      name.startsWith("AGENTS.md.backup-")
    );
    const claudeBackup = backupNames.find((name) =>
      name.startsWith("CLAUDE.md.backup-")
    );
    const templateBackup = backupNames.find((name) =>
      name.startsWith("_templates.backup-")
    );
    assert.ok(agentBackup);
    assert.ok(claudeBackup);
    assert.ok(templateBackup);
    assert.equal(
      readFileSync(join(workspaceRoot, agentBackup), "utf8"),
      "old agents\n"
    );
    assert.equal(
      readFileSync(join(workspaceRoot, claudeBackup), "utf8"),
      "old claude\n"
    );
    assert.equal(
      readFileSync(join(workspaceRoot, templateBackup, "old.txt"), "utf8"),
      "old template\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("malformed MACHINE.md fails before workspace writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    mkdirSync(join(workspaceRoot, "MACHINE.md"));

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
    assert.match(result.stderr, /MACHINE\.md must be a readable regular file/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
    assert.doesNotMatch(result.stderr, /EISDIR|node:fs:/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("Git-owned workspace is rejected before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: workspaceRoot,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);

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
    assert.match(result.stderr, /Workspace root must stay outside Git/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "CLAUDE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    assert.equal(existsSync(join(workspaceRoot, "_templates")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a missing Git prerequisite is reported plainly before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot, {
          PATH: join(testRoot, "no-tools")
        }),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Git is required on PATH/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
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
    const gitRoot = join(bootstrapRoot, ".git");
    cpSync(bootstrapRoot, checkoutRoot, {
      recursive: true,
      filter: (source) =>
        source !== gitRoot && !source.startsWith(`${gitRoot}${sep}`)
    });

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root cannot be the user home/);
    assert.equal(existsSync(join(testHome, "AGENTS.md")), false);
    assert.equal(existsSync(join(testHome, "CLAUDE.md")), false);
    assert.equal(existsSync(join(testHome, "MACHINE.md")), false);
    assert.equal(existsSync(join(testHome, "_templates")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

// --- Workflow foundation ------------------------------------------------
// These checks never make a model or API call and never need Claude Code or
// Codex authentication: they read canonical files and generated bytes only.

const workflowSourceRoot = join(bootstrapRoot, "workflows", "product-delivery");
const workflowManifest = JSON.parse(
  readFileSync(join(workflowSourceRoot, "manifest.json"), "utf8")
);

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
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), true);
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
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), true);
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
