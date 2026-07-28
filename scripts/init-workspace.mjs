#!/usr/bin/env node

import {
  accessSync,
  constants,
  readFileSync,
  realpathSync,
  statSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(bootstrapRoot, "..");
const canonicalWorkspaceRoot = realpathSync.native(workspaceRoot);
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--check", "--replace", "--skip-skills"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const replace = args.has("--replace");
const skipSkills = args.has("--skip-skills");

function fail(message) {
  console.error(`\nWorkspace initialization failed: ${message}`);
  process.exit(1);
}

if (unknownArgs.length) {
  fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}

if (checkOnly && replace) {
  fail("--check and --replace cannot be used together");
}

if (canonicalWorkspaceRoot === parse(canonicalWorkspaceRoot).root) {
  fail("Workspace root cannot be the filesystem root");
}

const userHomeCandidates = [
  homedir(),
  process.env.HOME,
  process.env.USERPROFILE
]
  .filter(Boolean)
  .map((candidate) => {
    const absoluteCandidate = resolve(candidate);
    try {
      return realpathSync.native(absoluteCandidate);
    } catch {
      return absoluteCandidate;
    }
  });
if (userHomeCandidates.includes(canonicalWorkspaceRoot)) {
  fail("Workspace root cannot be the user home; use a dedicated workspace folder");
}

const [nodeMajor] = process.versions.node
  .split(".")
  .map((part) => Number.parseInt(part, 10));
if (!Number.isInteger(nodeMajor) || nodeMajor < 18) {
  fail(`Node.js 18 or newer is required; found ${process.versions.node}`);
}

const requiredFiles = [
  "guides/AGENTS.md",
  "guides/CLAUDE.md",
  "guides/MACHINE.example.md",
  "project-templates/AGENTS.md",
  "project-templates/CLAUDE.md",
  "project-templates/.gitignore",
  "project-templates/README.md",
  "skills.json",
  "scripts/install-skills.mjs",
  "scripts/lib/skill-integrity.mjs",
  "scripts/lib/skill-manifest.mjs",
  "scripts/lib/skill-source.mjs",
  "scripts/setup-guides.mjs"
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
    if (error?.code === "EACCES") {
      fail(`${relativePath} must be a readable regular file`);
    }
    if (error?.message?.startsWith("Workspace initialization failed:")) {
      throw error;
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

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? bootstrapRoot,
    encoding: options.encoding,
    stdio: options.stdio ?? "inherit",
    shell: false
  });

  if (result.error) fail(result.error.message);
  if (result.status !== 0) {
    fail(`${options.label ?? command} exited with status ${result.status}`);
  }

  return result;
}

const gitProbe = spawnSync(
  "git",
  ["-C", workspaceRoot, "rev-parse", "--show-toplevel"],
  {
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
    shell: false
  }
);
if (gitProbe.error) {
  fail(
    gitProbe.error.code === "ENOENT"
      ? "Git is required on PATH; install Git, then rerun"
      : gitProbe.error.message
  );
}
if (gitProbe.status === 0) {
  fail(
    `Workspace root must stay outside Git; found worktree ${gitProbe.stdout.trim()}`
  );
} else if (!gitProbe.stderr.includes("not a git repository")) {
  fail(`Could not verify the workspace Git boundary: ${gitProbe.stderr.trim()}`);
}

console.log(`Bootstrap: ${bootstrapRoot}`);
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Mode: ${checkOnly ? "check only" : "initialize"}`);
if (skipSkills) console.log("Shared skills: skipped by request");

const setupArgs = [join(scriptDir, "setup-guides.mjs")];
if (checkOnly) setupArgs.push("--check");
if (replace) setupArgs.push("--replace");
run(process.execPath, setupArgs, { label: "workspace guidance setup" });

if (!skipSkills) {
  const skillArgs = [join(scriptDir, "install-skills.mjs")];
  if (checkOnly) skillArgs.push("--check");
  run(process.execPath, skillArgs, { label: "shared skill setup" });
}

if (!checkOnly) {
  run(
    process.execPath,
    [join(scriptDir, "setup-guides.mjs"), "--check"],
    { label: "workspace guidance verification" }
  );
  if (!skipSkills) {
    run(
      process.execPath,
      [join(scriptDir, "install-skills.mjs"), "--check"],
      { label: "shared skill verification" }
    );
  }
}

const machinePath = join(workspaceRoot, "MACHINE.md");
let machineContents;
try {
  machineContents = readFileSync(machinePath, "utf8");
} catch (error) {
  fail(`Could not read ${machinePath}: ${error.message}`);
}
const todoCount = machineContents.match(/\bTODO\b/g)?.length ?? 0;
if (checkOnly && todoCount > 0) {
  fail(`${machinePath} still contains ${todoCount} TODO placeholder(s)`);
}

console.log(
  checkOnly
    ? "\nWorkspace bootstrap check passed."
    : "\nWorkspace guidance initialized and structurally verified."
);
if (todoCount > 0) {
  console.log(
    `Next required step: replace ${todoCount} TODO placeholder(s) in ${machinePath}.`
  );
} else {
  console.log(`Machine-local facts are populated in ${machinePath}.`);
}
