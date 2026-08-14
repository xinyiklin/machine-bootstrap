#!/usr/bin/env node

import {
  accessSync,
  constants,
  copyFileSync,
  lstatSync,
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
const canonicalBootstrapRoot = realpathSync.native(bootstrapRoot);
const canonicalWorkspaceRoot = realpathSync.native(workspaceRoot);
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const allowedArgs = new Set([
  "--check",
  "--skip-skills",
  "--skip-workflows"
]);
const unknownArgs = rawArgs.filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const skipSkills = args.has("--skip-skills");
const skipWorkflows = args.has("--skip-workflows");

function fail(message) {
  console.error(`\nWorkspace initialization failed: ${message}`);
  process.exit(1);
}

if (unknownArgs.length) fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
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
if (!Number.isInteger(nodeMajor) || nodeMajor < 24) {
  fail(`Node.js 24 or newer is required; found ${process.versions.node}`);
}

const requiredFiles = [
  "machine-templates/MACHINE.example.md",
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
if (presentLegacy.length) {
  fail(
    `Legacy workspace layout detected (${presentLegacy.join(", ")}); ` +
      "automatic migration is not supported. Review the entries, then move " +
      "them manually out of the workspace root before rerunning"
  );
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


console.log(`Bootstrap: ${bootstrapRoot}`);
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Mode: ${checkOnly ? "check only" : "initialize"}`);
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
