#!/usr/bin/env node

import {
  accessSync,
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(bootstrapRoot, "..");
const canonicalBootstrapRoot = realpathSync.native(bootstrapRoot);
const canonicalWorkspaceRoot = realpathSync.native(workspaceRoot);
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const allowedArgs = new Set([
  "--check",
  "--migrate-legacy-layout",
  "--skip-skills",
  "--skip-workflows"
]);
const unknownArgs = rawArgs.filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const migrateLegacy = args.has("--migrate-legacy-layout");
const skipSkills = args.has("--skip-skills");
const skipWorkflows = args.has("--skip-workflows");

function fail(message) {
  console.error(`\nWorkspace initialization failed: ${message}`);
  process.exit(1);
}

if (unknownArgs.length) fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
if (checkOnly && migrateLegacy) {
  fail("--check and --migrate-legacy-layout cannot be used together");
}
if (canonicalWorkspaceRoot === parse(canonicalWorkspaceRoot).root) {
  fail("Workspace root cannot be the filesystem root");
}

const userHomeCandidates = [homedir(), process.env.HOME, process.env.USERPROFILE]
  .filter(Boolean)
  .map((candidate) => {
    try {
      return realpathSync.native(resolve(candidate));
    } catch {
      return resolve(candidate);
    }
  });
if (userHomeCandidates.includes(canonicalWorkspaceRoot)) {
  fail("Workspace root cannot be the user home; use a dedicated workspace folder");
}
if (dirname(canonicalBootstrapRoot) !== canonicalWorkspaceRoot) {
  fail("machine-bootstrap must resolve as a direct child of the workspace root");
}

const [nodeMajor] = process.versions.node
  .split(".")
  .map((part) => Number.parseInt(part, 10));
if (!Number.isInteger(nodeMajor) || nodeMajor < 18) {
  fail(`Node.js 18 or newer is required; found ${process.versions.node}`);
}

const requiredFiles = [
  "machine-templates/MACHINE.example.md",
  "machine-templates/legacy-layout-manifest.json",
  "project-templates/AGENTS.md",
  "project-templates/CLAUDE.md",
  "project-templates/.gitignore",
  "project-templates/TEMPLATE-USAGE.md",
  "project-templates/docs/engineering/git-workflow.md",
  "project-templates/.github/pull_request_template.md",
  "skills.json",
  "workflows/registry.json",
  "scripts/install-skills.mjs",
  "scripts/install-workflows.mjs",
  "scripts/init-project.mjs",
  "scripts/lib/fs-safety.mjs",
  "scripts/lib/portable-path.mjs",
  "scripts/lib/skill-integrity.mjs",
  "scripts/lib/skill-manifest.mjs",
  "scripts/lib/skill-source.mjs",
  "scripts/lib/workflow-adapters.mjs",
  "scripts/lib/workflow-manifest.mjs"
];

for (const relativePath of requiredFiles) {
  const absolutePath = join(bootstrapRoot, relativePath);
  try {
    if (!statSync(absolutePath).isFile()) {
      fail(`${relativePath} must be a readable regular file`);
    }
    accessSync(absolutePath, constants.R_OK);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      fail(`Bootstrap checkout is incomplete; missing: ${relativePath}`);
    }
    fail(`${relativePath} must be a readable regular file`);
  }
}

try {
  const { loadSkillManifest } = await import("./lib/skill-manifest.mjs");
  loadSkillManifest(join(bootstrapRoot, "skills.json"));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (!skipWorkflows) {
  try {
    const { loadWorkflowPackages } = await import("./lib/workflow-manifest.mjs");
    loadWorkflowPackages(join(bootstrapRoot, "workflows"));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? bootstrapRoot,
    encoding: options.encoding,
    env: options.env ?? process.env,
    stdio: options.stdio ?? "inherit",
    shell: false
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    fail(`${options.label ?? command} exited with status ${result.status}`);
  }
  return result;
}

function gitProbe(path) {
  return spawnSync("git", ["-C", path, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
    shell: false
  });
}

const bootstrapGit = gitProbe(bootstrapRoot);
if (bootstrapGit.error) {
  fail(
    bootstrapGit.error.code === "ENOENT"
      ? "Git is required on PATH; install Git, then rerun"
      : bootstrapGit.error.message
  );
}
if (bootstrapGit.status !== 0) {
  fail(`machine-bootstrap must be a Git repository: ${bootstrapGit.stderr.trim()}`);
}
let canonicalGitRoot;
try {
  canonicalGitRoot = realpathSync.native(bootstrapGit.stdout.trim());
} catch (error) {
  fail(`Could not resolve the machine-bootstrap Git root: ${error.message}`);
}
if (canonicalGitRoot !== canonicalBootstrapRoot) {
  fail(`machine-bootstrap checkout must be its Git root; found ${canonicalGitRoot}`);
}

const workspaceGit = gitProbe(workspaceRoot);
if (workspaceGit.status === 0) {
  fail(`Workspace root must stay outside Git; found worktree ${workspaceGit.stdout.trim()}`);
}
if (!workspaceGit.stderr.includes("not a git repository")) {
  fail(`Could not verify the workspace Git boundary: ${workspaceGit.stderr.trim()}`);
}

const machinePath = join(workspaceRoot, "MACHINE.md");
const machineSource = join(bootstrapRoot, "machine-templates", "MACHINE.example.md");
if (entryExists(machinePath)) {
  let machineStat;
  try {
    machineStat = statSync(machinePath);
    accessSync(machinePath, constants.R_OK);
  } catch {
    fail(`${machinePath} must be a readable regular file`);
  }
  if (!machineStat.isFile()) fail(`${machinePath} must be a readable regular file`);
}

const legacyNames = ["AGENTS.md", "CLAUDE.md", "_templates"];
const presentLegacy = legacyNames.filter((name) => entryExists(join(workspaceRoot, name)));
if (presentLegacy.length && !migrateLegacy) {
  fail(
    `Legacy workspace layout detected (${presentLegacy.join(", ")}); review it, then run with --migrate-legacy-layout`
  );
}

function normalizedHash(path) {
  const normalized = readFileSync(path, "utf8").replaceAll("\r\n", "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function entryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

function collectEntries(
  root,
  relativePath = "",
  snapshot = { directories: [], files: [] }
) {
  const entries = readdirSync(join(root, relativePath), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const childRelative = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      snapshot.directories.push(childRelative);
      collectEntries(root, childRelative, snapshot);
    } else if (entry.isFile()) snapshot.files.push(childRelative);
    else fail(`Legacy workspace entry is not a regular file: ${join(root, childRelative)}`);
  }
  return snapshot;
}

function loadLegacyFingerprints() {
  const path = join(bootstrapRoot, "machine-templates", "legacy-layout-manifest.json");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`Could not read legacy layout fingerprints: ${error.message}`);
  }
  if (parsed?.schemaVersion !== 1 || !parsed.files || typeof parsed.files !== "object") {
    fail("Legacy layout fingerprint manifest is invalid");
  }
  return parsed.files;
}

function verifyLegacyLayout() {
  if (!presentLegacy.length) return;
  const fingerprints = loadLegacyFingerprints();
  const actualFiles = [];
  const actualDirectories = [];
  for (const name of presentLegacy) {
    const path = join(workspaceRoot, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) fail(`Legacy workspace entry is a symbolic link: ${path}`);
    if (name === "_templates") {
      if (!stat.isDirectory()) fail(`${path} must be a directory for migration`);
      const snapshot = collectEntries(path);
      for (const child of snapshot.files) actualFiles.push(`_templates/${child}`);
      for (const child of snapshot.directories) {
        actualDirectories.push(`_templates/${child}`);
      }
    } else {
      if (!stat.isFile()) fail(`${path} must be a regular file for migration`);
      actualFiles.push(name);
    }
  }
  const unrecognized = [];
  for (const relativePath of actualFiles) {
    const expectedHash = fingerprints[relativePath];
    const actualHash = normalizedHash(join(workspaceRoot, ...relativePath.split("/")));
    if (!expectedHash || expectedHash !== actualHash) unrecognized.push(relativePath);
  }
  const missingExpected = Object.keys(fingerprints).filter((path) => {
    const top = path.split("/")[0];
    return presentLegacy.includes(top) && !actualFiles.includes(path);
  });
  const expectedDirectories = new Set();
  for (const path of Object.keys(fingerprints).filter((path) => path.startsWith("_templates/"))) {
    const parts = path.split("/").slice(0, -1);
    for (let index = 2; index <= parts.length; index += 1) {
      expectedDirectories.add(parts.slice(0, index).join("/"));
    }
  }
  const unrecognizedDirectories = actualDirectories.filter(
    (path) => !expectedDirectories.has(path)
  );
  const missingDirectories = [...expectedDirectories].filter(
    (path) => presentLegacy.includes("_templates") && !actualDirectories.includes(path)
  );
  if (
    unrecognized.length ||
    missingExpected.length ||
    unrecognizedDirectories.length ||
    missingDirectories.length
  ) {
    const details = [
      ...unrecognized,
      ...unrecognizedDirectories,
      ...missingExpected.map((path) => `${path} (missing)`),
      ...missingDirectories.map((path) => `${path}/ (missing)`)
    ].join(", ");
    fail(`Legacy layout contains unrecognized or user-authored differences: ${details}`);
  }
}

function migrateLegacyLayout() {
  if (!presentLegacy.length) {
    console.log("No legacy workspace guidance found; migration was not needed.");
    return;
  }
  verifyLegacyLayout();
  const backupParent = join(workspaceRoot, ".machine-bootstrap-backup");
  let createdParent = false;
  if (entryExists(backupParent)) {
    const stat = lstatSync(backupParent);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      fail(`${backupParent} must be a real directory`);
    }
  } else {
    mkdirSync(backupParent);
    createdParent = true;
  }
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const backupRoot = join(backupParent, `${timestamp}-${process.pid}-${randomUUID()}`);
  mkdirSync(backupRoot);
  const moved = [];
  try {
    for (const name of presentLegacy) {
      const source = join(workspaceRoot, name);
      const destination = join(backupRoot, name);
      renameSync(source, destination);
      moved.push([source, destination]);
    }
  } catch (error) {
    for (const [source, destination] of moved.reverse()) {
      try {
        renameSync(destination, source);
      } catch {
        // Report the original failure plus the recoverable backup root below.
      }
    }
    try { rmdirSync(backupRoot); } catch {}
    if (createdParent) {
      try { rmdirSync(backupParent); } catch {}
    }
    fail(`Legacy migration could not complete: ${error.message}; inspect ${backupRoot}`);
  }
  console.log(`Moved legacy workspace guidance to ${backupRoot}`);
}

console.log(`Bootstrap: ${bootstrapRoot}`);
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Mode: ${checkOnly ? "check only" : migrateLegacy ? "migrate and initialize" : "initialize"}`);
if (skipSkills) console.log("Shared skills: skipped by request");
if (skipWorkflows) console.log("Workflow foundation: skipped by request");

if (!checkOnly) {
  if (!skipSkills) {
    run(process.execPath, [join(scriptDir, "install-skills.mjs"), "--preflight"], {
      label: "shared skill preflight"
    });
  }
  if (!skipWorkflows) {
    run(process.execPath, [join(scriptDir, "install-workflows.mjs"), "--preflight"], {
      label: "workflow foundation preflight"
    });
  }
  if (migrateLegacy) migrateLegacyLayout();
  if (!entryExists(machinePath)) {
    try {
      copyFileSync(machineSource, machinePath, constants.COPYFILE_EXCL);
      console.log(`Created ${machinePath}; customize it for this machine`);
    } catch (error) {
      if (error?.code === "EEXIST") fail(`${machinePath} appeared during setup; rerun`);
      fail(`Could not create ${machinePath}: ${error.message}`);
    }
  } else {
    console.log(`Preserved machine-local ${machinePath}`);
  }
}

if (!skipSkills) {
  run(
    process.execPath,
    [join(scriptDir, "install-skills.mjs"), ...(checkOnly ? ["--check"] : [])],
    { label: "shared skill setup" }
  );
}
if (!skipWorkflows) {
  run(
    process.execPath,
    [join(scriptDir, "install-workflows.mjs"), ...(checkOnly ? ["--check"] : [])],
    { label: "workflow foundation setup" }
  );
}
if (!checkOnly) {
  if (!skipSkills) {
    run(process.execPath, [join(scriptDir, "install-skills.mjs"), "--check"], {
      label: "shared skill verification"
    });
  }
  if (!skipWorkflows) {
    run(process.execPath, [join(scriptDir, "install-workflows.mjs"), "--check"], {
      label: "workflow foundation verification"
    });
  }
}

let machineContents = null;
if (entryExists(machinePath)) {
  try {
    machineContents = readFileSync(machinePath, "utf8");
  } catch (error) {
    fail(`Could not read ${machinePath}: ${error.message}`);
  }
}
const todoCount = machineContents?.match(/\bTODO\b/g)?.length ?? 0;
if (checkOnly && todoCount > 0) {
  fail(`${machinePath} still contains ${todoCount} TODO placeholder(s)`);
}

for (const name of legacyNames) {
  if (entryExists(join(workspaceRoot, name))) {
    fail(`Legacy workspace entry remains after initialization: ${name}`);
  }
}

console.log(checkOnly ? "\nWorkspace bootstrap check passed." : "\nWorkspace bootstrap initialized and verified.");
if (todoCount > 0) {
  console.log(`Next required step: replace ${todoCount} TODO placeholder(s) in ${machinePath}.`);
} else if (machineContents === null) {
  console.log(`Optional machine registry is not present at ${machinePath}.`);
} else {
  console.log(`Machine-local facts are populated in ${machinePath}.`);
}
