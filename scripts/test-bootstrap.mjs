#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
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

async function test(name, callback, { needsInstalledRoster = false } = {}) {
  if (needsInstalledRoster && !rosterInstalled) {
    skipped.push(name);
    console.log(`SKIP ${name}: shared skills are not installed yet`);
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

    assert.throws(
      () =>
        materializeReviewedSkill(
          repositoryRoot,
          linkRevision.stdout.trim(),
          "skills/fixture",
          join(testRoot, "unsafe-materialized")
        ),
      /symbolic link escapes reviewed skill/
    );
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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
}, { needsInstalledRoster: true });

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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
}, { needsInstalledRoster: true });

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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
        env: {
          ...process.env,
          HOME: testHome,
          USERPROFILE: testHome,
          PATH: ""
        },
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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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
    const result = spawnSync(
      process.execPath,
      [join(scriptDir, script), ...scriptArgs],
      { encoding: "utf8", shell: false }
    );
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
        env: { ...process.env, HOME: testRoot, USERPROFILE: testRoot },
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
        env: { ...process.env, HOME: testRoot, USERPROFILE: testRoot },
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
      { encoding: "utf8", shell: false }
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
  assert.match(ignore, /^\.claude\/$/m);
  assert.match(ignore, /^CLAUDE\.local\.md$/m);
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.match(ignore, /^\.DS_Store$/m);
});

await test("clean workspace initializes the portable guidance layer", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      { encoding: "utf8", shell: false }
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
      { encoding: "utf8", shell: false }
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
      { encoding: "utf8", shell: false }
    );

    assert.match(result.stdout, /Current: .*CLAUDE\.md/);
    assert.doesNotMatch(result.stderr, /CLAUDE\.md is not a regular file/);
    assert.doesNotMatch(result.stderr, /CLAUDE\.md differs/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a broken symlink is named rather than called drift", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    symlinkSync(join(testRoot, "absent.md"), join(workspaceRoot, "CLAUDE.md"));

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      { encoding: "utf8", shell: false }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CLAUDE\.md is a broken symbolic link/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

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
      { encoding: "utf8", shell: false }
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
});

await test("a wrong-typed workspace guide is named, not called drift", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    mkdirSync(join(workspaceRoot, "AGENTS.md"));

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills"],
      { encoding: "utf8", shell: false }
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
      { encoding: "utf8", shell: false }
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /_templates is not readable/);
    assert.doesNotMatch(result.stderr, /EACCES|node:internal/);
    assert.equal(existsSync(join(workspaceRoot, "AGENTS.md")), false);
  } finally {
    chmodSync(templatesPath, 0o755);
    rmSync(testRoot, { recursive: true, force: true });
  }
});

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
      { encoding: "utf8", shell: false }
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
      { encoding: "utf8", shell: false }
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
      { encoding: "utf8", shell: false }
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
      { encoding: "utf8", shell: false }
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
        env: { ...process.env, PATH: join(testRoot, "no-tools") },
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
        env: { ...process.env, HOME: testHome, USERPROFILE: testHome },
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

if (failures.length) {
  console.error(`\n${failures.length} bootstrap test(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (skipped.length) {
  console.log(
    `\n${skipped.length} test(s) skipped; they read this machine's installed ` +
    `roster, which is not present yet:`
  );
  for (const name of skipped) console.log(`- ${name}`);
  console.log(
    "Run node scripts/init-workspace.mjs, then rerun to cover them."
  );
}

console.log(
  `\nAll bootstrap tests passed${skipped.length ? ` (${skipped.length} skipped)` : ""}.`
);
