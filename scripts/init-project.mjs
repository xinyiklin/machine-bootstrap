#!/usr/bin/env node

import {
  accessSync,
  constants,
  copyFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep
} from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(bootstrapRoot, "..");
const canonicalBootstrapRoot = realpathSync.native(bootstrapRoot);
const canonicalWorkspaceRoot = realpathSync.native(workspaceRoot);
const rawArgs = process.argv.slice(2);
const createTarget = rawArgs.includes("--create");
const positional = rawArgs.filter((arg) => !arg.startsWith("--"));
const unknownOptions = rawArgs.filter(
  (arg) => arg.startsWith("--") && arg !== "--create"
);

function fail(message) {
  console.error(`\nProject initialization failed: ${message}`);
  process.exit(1);
}

if (unknownOptions.length) {
  fail(`Unknown argument(s): ${unknownOptions.join(", ")}`);
}
if (positional.length !== 1) {
  fail(
    "Provide exactly one target: " +
      "node scripts/init-project.mjs <target> [--create]"
  );
}

const [nodeMajor] = process.versions.node
  .split(".")
  .map((part) => Number.parseInt(part, 10));
if (!Number.isInteger(nodeMajor) || nodeMajor < 18) {
  fail(`Node.js 18 or newer is required; found ${process.versions.node}`);
}

const homeCandidates = [homedir(), process.env.HOME, process.env.USERPROFILE]
  .filter(Boolean)
  .map((candidate) => {
    try {
      return realpathSync.native(resolve(candidate));
    } catch {
      return resolve(candidate);
    }
  });
if (canonicalWorkspaceRoot === parse(canonicalWorkspaceRoot).root) {
  fail("Workspace root cannot be the filesystem root");
}
if (homeCandidates.includes(canonicalWorkspaceRoot)) {
  fail("Workspace root cannot be the user home; use a dedicated workspace folder");
}
if (dirname(canonicalBootstrapRoot) !== canonicalWorkspaceRoot) {
  fail("machine-bootstrap must resolve as a direct child of the workspace root");
}

const bootstrapGit = gitProbe(bootstrapRoot);
if (bootstrapGit.error) {
  fail(
    bootstrapGit.error.code === "ENOENT"
      ? "Git is required on PATH"
      : bootstrapGit.error.message
  );
}
if (bootstrapGit.status !== 0) {
  fail(`machine-bootstrap must be a Git repository: ${bootstrapGit.stderr.trim()}`);
}
const canonicalBootstrapGitRoot = realpathSync.native(
  bootstrapGit.stdout.trim()
);
if (canonicalBootstrapGitRoot !== canonicalBootstrapRoot) {
  fail(
    `machine-bootstrap checkout must be its Git root; found ${canonicalBootstrapGitRoot}`
  );
}

const workspaceGit = gitProbe(workspaceRoot);
if (workspaceGit.status === 0) {
  fail(
    `Workspace root must stay outside Git; found worktree ${workspaceGit.stdout.trim()}`
  );
}
if (!workspaceGit.stderr.includes("not a git repository")) {
  fail(`Could not verify the workspace Git boundary: ${workspaceGit.stderr.trim()}`);
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

function isInside(parent, child) {
  const path = relative(parent, child);
  return (
    Boolean(path) &&
    !path.startsWith(`..${sep}`) &&
    path !== ".." &&
    !isAbsolute(path)
  );
}

function canonicalCandidate(path) {
  if (entryExists(path)) return realpathSync.native(path);
  const parent = dirname(path);
  if (!entryExists(parent)) {
    fail("Only the final target directory may be missing; create its parent first");
  }
  const canonicalParent = realpathSync.native(parent);
  return join(canonicalParent, basename(path));
}

const requestedTarget = resolve(process.cwd(), positional[0]);
const targetExisted = entryExists(requestedTarget);
const canonicalTarget = canonicalCandidate(requestedTarget);
if (canonicalTarget === parse(canonicalTarget).root) {
  fail("Target cannot be the filesystem root");
}
if (homeCandidates.includes(canonicalTarget)) fail("Target cannot be the user home");
if (canonicalTarget === canonicalWorkspaceRoot) {
  fail("Target cannot be the workspace root");
}
if (!isInside(canonicalWorkspaceRoot, canonicalTarget)) {
  fail(`Target must resolve inside the workspace: ${canonicalWorkspaceRoot}`);
}
if (
  canonicalTarget === canonicalBootstrapRoot ||
  isInside(canonicalBootstrapRoot, canonicalTarget)
) {
  fail("Target cannot be machine-bootstrap or a path inside it");
}

if (targetExisted) {
  const targetLstat = lstatSync(requestedTarget);
  if (!targetLstat.isDirectory() && !targetLstat.isSymbolicLink()) {
    fail("Existing target must be a directory");
  }
  if (!statSync(requestedTarget).isDirectory()) {
    fail("Existing target must resolve to a directory");
  }
} else if (!createTarget) {
  fail("Target does not exist; rerun with --create to create the directory");
}

function gitProbe(path) {
  return spawnSync("git", ["-C", path, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    env: { ...process.env, LANG: "C", LC_ALL: "C" },
    shell: false
  });
}

let gitRoot = null;
const probe = gitProbe(targetExisted ? requestedTarget : dirname(requestedTarget));
if (probe.error) {
  fail(
    probe.error.code === "ENOENT" ? "Git is required on PATH" : probe.error.message
  );
}
if (probe.status === 0) {
  gitRoot = realpathSync.native(probe.stdout.trim());
  if (!targetExisted) {
    fail(`New target cannot be created inside existing Git repository ${gitRoot}`);
  }
  if (gitRoot !== canonicalTarget) {
    fail(`Existing repository target must be its Git root; found ${gitRoot}`);
  }
} else if (!probe.stderr.includes("not a git repository")) {
  fail(`Could not verify the target Git boundary: ${probe.stderr.trim()}`);
}

const templateRoot = join(bootstrapRoot, "project-templates");
const seedFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "docs/engineering/git-workflow.md",
  ".github/pull_request_template.md"
];
for (const relativePath of [...seedFiles, ".gitignore"]) {
  const source = join(templateRoot, ...relativePath.split("/"));
  try {
    if (!statSync(source).isFile()) {
      fail(`Template must be a regular file: ${relativePath}`);
    }
    accessSync(source, constants.R_OK);
  } catch (error) {
    if (error?.message?.startsWith("Project initialization failed:")) throw error;
    fail(`Template must be readable: ${relativePath}`);
  }
}

const safetyEntries = readFileSync(join(templateRoot, ".gitignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const mergeableSafetyEntries = safetyEntries.filter(
  (entry) => !entry.startsWith("!")
);
const createdFiles = [];
const createdDirectories = [];
const preservedFiles = [];
let createdTarget = false;
let gitignoreBackup = null;
let gitignoreOriginal = null;
let gitignoreAdded = [];

function rollback() {
  if (gitignoreBackup) {
    try { unlinkSync(join(canonicalTarget, ".gitignore")); } catch {}
    try { renameSync(gitignoreBackup, join(canonicalTarget, ".gitignore")); } catch {}
  }
  for (const path of createdFiles.reverse()) {
    try { unlinkSync(path); } catch {}
  }
  for (const path of createdDirectories.reverse()) {
    try { rmdirSync(path); } catch {}
  }
  if (createdTarget) {
    try { rmdirSync(canonicalTarget); } catch {}
  }
}

function ensureDirectory(path) {
  if (entryExists(path)) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Managed parent must be a real directory: ${path}`);
    }
    return;
  }
  mkdirSync(path);
  createdDirectories.push(path);
}

try {
  if (!targetExisted) {
    mkdirSync(canonicalTarget);
    createdTarget = true;
  }

  for (const relativePath of [...seedFiles, ".gitignore"]) {
    const destination = join(canonicalTarget, ...relativePath.split("/"));
    if (!entryExists(destination)) continue;
    const stat = lstatSync(destination);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error(`Managed project path must be a real file: ${destination}`);
    }
    accessSync(destination, constants.R_OK);
  }

  for (const relativePath of seedFiles) {
    const parts = relativePath.split("/");
    let parent = canonicalTarget;
    for (const part of parts.slice(0, -1)) {
      parent = join(parent, part);
      ensureDirectory(parent);
    }
    const destination = join(canonicalTarget, ...parts);
    if (entryExists(destination)) {
      preservedFiles.push(relativePath);
      continue;
    }
    copyFileSync(join(templateRoot, ...parts), destination, constants.COPYFILE_EXCL);
    createdFiles.push(destination);
  }

  const gitignorePath = join(canonicalTarget, ".gitignore");
  if (!entryExists(gitignorePath)) {
    copyFileSync(join(templateRoot, ".gitignore"), gitignorePath, constants.COPYFILE_EXCL);
    createdFiles.push(gitignorePath);
    gitignoreAdded = [...safetyEntries];
  } else {
    preservedFiles.push(".gitignore");
    gitignoreOriginal = readFileSync(gitignorePath);
    const presentEntries = new Set(
      gitignoreOriginal
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    );
    gitignoreAdded = mergeableSafetyEntries.filter(
      (entry) => !presentEntries.has(entry)
    );
    if (gitignoreAdded.length) {
      const current = readFileSync(gitignorePath);
      if (!current.equals(gitignoreOriginal)) {
        throw new Error(`${gitignorePath} changed during initialization`);
      }
      gitignoreBackup = join(
        canonicalTarget,
        `.gitignore.machine-bootstrap-${process.pid}-${randomUUID()}.backup`
      );
      renameSync(gitignorePath, gitignoreBackup);
      const originalText = gitignoreOriginal.toString("utf8");
      const newline = originalText.includes("\r\n") ? "\r\n" : "\n";
      const separator =
        originalText.length && !originalText.endsWith("\n") ? newline : "";
      const addition =
        `${separator}${newline}# Added by machine-bootstrap project initializer${newline}` +
        `${gitignoreAdded.join(newline)}${newline}`;
      writeFileSync(gitignorePath, originalText + addition, {
        encoding: "utf8",
        flag: "wx"
      });
    }
  }

  const placeholderFiles = [...seedFiles, ".gitignore"];
  let placeholderCount = 0;
  for (const relativePath of placeholderFiles) {
    const path = join(canonicalTarget, ...relativePath.split("/"));
    if (!entryExists(path)) continue;
    const contents = readFileSync(path, "utf8");
    placeholderCount += contents.match(/\bTODO\b|<Project>/g)?.length ?? 0;
  }

  if (gitignoreBackup) {
    unlinkSync(gitignoreBackup);
    gitignoreBackup = null;
  }

  console.log(`\nProject initialized: ${canonicalTarget}`);
  console.log(
    `Repository root: ${gitRoot ?? `${canonicalTarget} (Git not initialized)`}`
  );
  const created = createdFiles.map((path) => relative(canonicalTarget, path));
  console.log(`Created: ${created.length ? created.join(", ") : "none"}`);
  console.log(
    `Preserved: ${preservedFiles.length ? preservedFiles.join(", ") : "none"}`
  );
  console.log(
    `.gitignore entries added: ${gitignoreAdded.length ? gitignoreAdded.join(", ") : "none"}`
  );
  console.log(`Remaining template placeholders: ${placeholderCount}`);
  console.log(
    "Start a new Codex or Claude session in this project before normal project work."
  );
} catch (error) {
  rollback();
  fail(error instanceof Error ? error.message : String(error));
}
