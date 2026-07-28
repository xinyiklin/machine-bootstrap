#!/usr/bin/env node

import {
  accessSync,
  constants,
  copyFileSync,
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(bootstrapRoot, "..");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--check", "--replace"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const replace = args.has("--replace");
const failures = [];
const ignoredSnapshotNames = new Set([".DS_Store", "Thumbs.db"]);

function failSetup(message) {
  console.error(`\nWorkspace setup failed: ${message}`);
  process.exit(1);
}

if (unknownArgs.length) {
  failSetup(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}

if (checkOnly && replace) {
  failSetup("--check and --replace cannot be used together");
}

function entryExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    // ENOTDIR means a non-directory ancestor, so the entry cannot exist.
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}

// Describes why a destination cannot be compared with its portable source, so
// a type mismatch or permission problem is not reported as content drift.
// Symlinks are followed: what an agent loads at that path is the content that
// matters, and placement always backs the entry up before writing a real file,
// so a link is never written through.
function destinationProblem(destination, expectedKind) {
  if (!entryExists(destination)) return null;

  let stat;
  try {
    stat = statSync(destination);
  } catch {
    return "is a broken symbolic link";
  }

  if (expectedKind === "file" && !stat.isFile()) {
    return stat.isDirectory()
      ? "is a directory where a file belongs"
      : "is not a regular file";
  }
  if (expectedKind === "directory" && !stat.isDirectory()) {
    return stat.isFile()
      ? "is a file where a directory belongs"
      : "is not a directory";
  }

  try {
    accessSync(destination, constants.R_OK);
  } catch {
    return "is not readable";
  }
  return null;
}

function sameContents(source, destination) {
  if (destinationProblem(destination, "file")) return false;
  return (
    entryExists(destination) &&
    readFileSync(source).equals(readFileSync(destination))
  );
}

function isReadableRegularFile(path) {
  return entryExists(path) && !destinationProblem(path, "file");
}

function directorySnapshot(root, relativePath = "", snapshot = new Map()) {
  const directory = join(root, relativePath);
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => !ignoredSnapshotNames.has(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const entryPath = join(relativePath, entry.name);
    if (entry.isDirectory()) {
      snapshot.set(`${entryPath}/`, null);
      directorySnapshot(root, entryPath, snapshot);
    } else if (entry.isFile()) {
      snapshot.set(entryPath, readFileSync(join(root, entryPath)));
    } else {
      snapshot.set(entryPath, false);
    }
  }

  return snapshot;
}

function sameDirectory(source, destination) {
  if (destinationProblem(destination, "directory") || !entryExists(destination)) {
    return false;
  }

  let sourceSnapshot;
  let destinationSnapshot;
  try {
    sourceSnapshot = directorySnapshot(source);
    destinationSnapshot = directorySnapshot(destination);
  } catch {
    return false;
  }
  if (sourceSnapshot.size !== destinationSnapshot.size) return false;

  for (const [path, sourceContents] of sourceSnapshot) {
    if (!destinationSnapshot.has(path)) return false;
    const destinationContents = destinationSnapshot.get(path);
    if (sourceContents === null && destinationContents === null) continue;
    if (
      !Buffer.isBuffer(sourceContents) ||
      !Buffer.isBuffer(destinationContents) ||
      !sourceContents.equals(destinationContents)
    ) {
      return false;
    }
  }

  return true;
}

function backup(destination) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  let backupPath = `${destination}.backup-${timestamp}`;
  let suffix = 2;
  while (entryExists(backupPath)) {
    backupPath = `${destination}.backup-${timestamp}-${suffix}`;
    suffix += 1;
  }
  renameSync(destination, backupPath);
  console.log(`Backed up ${destination} to ${backupPath}`);
}

function place(source, destination, kind) {
  const current =
    kind === "file"
      ? sameContents(source, destination)
      : sameDirectory(source, destination);
  if (current) {
    console.log(`Current: ${destination}`);
    return;
  }

  const present = entryExists(destination);
  const problem = destinationProblem(destination, kind);

  if (checkOnly) {
    if (!present) failures.push(`${destination} is missing`);
    else if (problem) failures.push(`${destination} ${problem}`);
    else failures.push(`${destination} differs from its portable source`);
    return;
  }

  if (present && !replace) {
    failures.push(
      `${destination} ${problem ?? "differs"} (review, then use --replace)`
    );
    return;
  }

  if (present) backup(destination);
  if (kind === "file") {
    mkdirSync(dirname(destination), { recursive: true });
    try {
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
    } catch (error) {
      if (error?.code === "EEXIST") {
        failures.push(`${destination} appeared during setup; rerun`);
        return;
      }
      throw error;
    }
  } else {
    try {
      mkdirSync(destination);
    } catch (error) {
      if (error?.code === "EEXIST") {
        failures.push(`${destination} appeared during setup; rerun`);
        return;
      }
      throw error;
    }
    try {
      cpSync(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
        verbatimSymlinks: true
      });
    } catch (error) {
      // This directory was claimed above, so removing a partial copy cannot
      // erase a pre-existing workspace entry.
      rmSync(destination, { recursive: true, force: true });
      throw error;
    }
  }
  console.log(`Placed ${destination}`);
}

function placeFile(source, destination) {
  place(source, destination, "file");
}

function placeDirectory(source, destination) {
  place(source, destination, "directory");
}

const agentGuideSource = join(bootstrapRoot, "guides", "AGENTS.md");
const agentGuideDestination = join(workspaceRoot, "AGENTS.md");
const claudeGuideSource = join(bootstrapRoot, "guides", "CLAUDE.md");
const claudeGuideDestination = join(workspaceRoot, "CLAUDE.md");
const templatesSource = join(bootstrapRoot, "project-templates");
const templatesPath = join(workspaceRoot, "_templates");
const machinePath = join(workspaceRoot, "MACHINE.md");

for (const [source, kind] of [
  [agentGuideSource, "file"],
  [claudeGuideSource, "file"],
  [join(bootstrapRoot, "guides", "MACHINE.example.md"), "file"],
  [templatesSource, "directory"]
]) {
  if (!entryExists(source)) {
    failSetup(`portable source is missing: ${source}`);
  }
  const problem = destinationProblem(source, kind);
  if (problem) failSetup(`${source} ${problem}`);
}

if (entryExists(machinePath) && !isReadableRegularFile(machinePath)) {
  console.error(
    `\nWorkspace setup requires attention:\n` +
    `- ${machinePath} must be a readable regular file`
  );
  process.exit(1);
}

if (!checkOnly && !replace) {
  const conflicts = [];
  for (const [source, destination, kind] of [
    [agentGuideSource, agentGuideDestination, "file"],
    [claudeGuideSource, claudeGuideDestination, "file"],
    [templatesSource, templatesPath, "directory"]
  ]) {
    if (!entryExists(destination)) continue;
    const current =
      kind === "file"
        ? sameContents(source, destination)
        : sameDirectory(source, destination);
    if (current) continue;
    conflicts.push(
      `${destination} ${destinationProblem(destination, kind) ?? "differs"}`
    );
  }

  if (conflicts.length) {
    console.error("\nWorkspace setup requires review before making changes:");
    for (const conflict of conflicts) console.error(`- ${conflict}`);
    console.error("- Review the differences, then use --replace if approved");
    process.exit(1);
  }
}

placeFile(
  agentGuideSource,
  agentGuideDestination
);
placeFile(
  claudeGuideSource,
  claudeGuideDestination
);

if (!entryExists(machinePath)) {
  if (checkOnly) {
    failures.push(`${machinePath} is missing`);
  } else {
    try {
      copyFileSync(
        join(bootstrapRoot, "guides", "MACHINE.example.md"),
        machinePath,
        constants.COPYFILE_EXCL
      );
      console.log(`Created ${machinePath}; customize it for this machine`);
    } catch (error) {
      if (error?.code === "EEXIST") {
        failures.push(`${machinePath} appeared during setup; rerun`);
      } else {
        throw error;
      }
    }
  }
} else {
  console.log(`Preserved machine-local ${machinePath}`);
}

placeDirectory(templatesSource, templatesPath);

if (failures.length) {
  console.error("\nWorkspace setup requires attention:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nVerified workspace guidance at ${workspaceRoot}.`);
