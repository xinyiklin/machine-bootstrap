// Shared harness for the bootstrap regression suite. `scripts/test-bootstrap.mjs`
// runs the layer files in scripts/test/ in order and then calls reportResults().
// Every helper here is used by more than one layer; layer-local helpers stay
// in their layer file.


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
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// This file lives in scripts/test/; the scripts under test are one level up.
const scriptDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

async function createSkillInstallerFixture() {
  const testHome = createTestHome("skill-provider-roots");
  const checkout = join(testHome, "installer");
  const fixtureScriptDir = join(checkout, "scripts");
  mkdirSync(fixtureScriptDir, { recursive: true });
  copyFileSync(
    join(scriptDir, "install-skills.mjs"),
    join(fixtureScriptDir, "install-skills.mjs")
  );
  cpSync(join(scriptDir, "lib"), join(fixtureScriptDir, "lib"), {
    recursive: true
  });
  const name = "fixture-skill";
  const canonical = join(testHome, ".agents", "skills", name);
  mkdirSync(canonical, { recursive: true });
  writeFileSync(join(canonical, "SKILL.md"), "# Disposable test skill\n");
  const { hashDirectory } = await import("../lib/skill-integrity.mjs");
  writeFileSync(join(checkout, "skills.json"), JSON.stringify({
    schemaVersion: 4,
    skills: [{
      name,
      repository: "https://github.com/example/fixture.git",
      sourcePath: "skills/fixture-skill",
      sourceRevision: "a".repeat(40),
      contentSha256: hashDirectory(canonical)
    }]
  }));
  return {
    testHome,
    name,
    canonical,
    run(args = [], overrides = {}) {
      return spawnSync(process.execPath, [
        join(fixtureScriptDir, "install-skills.mjs"), ...args
      ], {
        cwd: testHome,
        encoding: "utf8",
        env: isolatedEnvironment(testHome, { PATH: "", ...overrides }),
        shell: false
      });
    }
  };
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

// Guidance assertions match prose regardless of line wrapping.
function readNormalized(root, relativePath) {
  return readFileSync(join(root, ...relativePath.split("/")), "utf8")
    .replace(/\s+/g, " ");
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

function reportResults() {
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
}

export {
  scriptDir,
  bootstrapRoot,
  failures,
  skipped,
  manifestSkills,
  rosterInstalled,
  capabilities,
  includeInTestFixture,
  createTestWorkspace,
  createTestHome,
  isolatedEnvironment,
  runScript,
  createSkillInstallerFixture,
  test,
  readNormalized,
  snapshotTree,
  reportResults,
};
