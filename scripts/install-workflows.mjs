#!/usr/bin/env node

// Installs the portable workflow foundation and its generated provider
// adapters. Everything is validated and staged before any destination changes,
// installation is missing-only by default, and reviewed replacement keeps
// timestamped backups.
//
// This script owns exactly the paths it plans below. The complete ~/.agents,
// Claude configuration root, and Codex home are user state, not bootstrap
// state: unrelated files in them are never inspected, moved, or removed.

import {
  constants,
  cpSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  renameSync,
  rmdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  backupEntry,
  destinationProblem,
  entryExists,
  sameContents
} from "./lib/fs-safety.mjs";
import { generateProviderAdapters } from "./lib/workflow-adapters.mjs";
import {
  loadWorkflowPackages,
  workflowSourcePaths
} from "./lib/workflow-manifest.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workflowsRoot = join(bootstrapRoot, "workflows");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--check", "--preflight", "--replace"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const preflightOnly = args.has("--preflight");
const replace = args.has("--replace");
const userHome = homedir();
const canonicalRoot = join(userHome, ".agents", "workflows");
const claudeConfigRoot = process.env.CLAUDE_CONFIG_DIR
  ? resolve(process.env.CLAUDE_CONFIG_DIR)
  : join(userHome, ".claude");
const codexHome = process.env.CODEX_HOME
  ? resolve(process.env.CODEX_HOME)
  : join(userHome, ".codex");
const providerRoots = { claude: claudeConfigRoot, codex: codexHome };

let stagingRoot = null;

function cleanupStaging() {
  if (!stagingRoot) return;
  rmSync(stagingRoot, { recursive: true, force: true });
  stagingRoot = null;
}

// Every exit goes through here, so the staging directory is always removed.
// `process.exit` skips `finally`, which is why cleanup is explicit.
function finish(code) {
  cleanupStaging();
  process.exit(code);
}

function failSetup(message) {
  console.error(`\nWorkflow setup failed: ${message}`);
  finish(1);
}

function reportAndExit(heading, messages, footer) {
  console.error(`\n${heading}`);
  for (const message of messages) console.error(`- ${message}`);
  if (footer) console.error(`- ${footer}`);
  finish(1);
}

if (unknownArgs.length) {
  failSetup(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}

if (checkOnly && (preflightOnly || replace)) {
  failSetup("--check cannot be combined with --preflight or --replace");
}

let packages;
try {
  ({ packages } = loadWorkflowPackages(workflowsRoot));
} catch (error) {
  failSetup(error instanceof Error ? error.message : String(error));
}

// A root that exists as a non-directory would make every destination under it
// unusable. Name it before planning rather than raising ENOTDIR later. Roots are
// followed, so one relocated behind a symlink stays supported.
for (const [label, root] of [
  ["canonical workflow root", canonicalRoot],
  ["Claude configuration root", claudeConfigRoot],
  ["Claude agent root", join(claudeConfigRoot, "agents")],
  ["Codex home", codexHome],
  ["Codex agent root", join(codexHome, "agents")]
]) {
  if (!entryExists(root)) continue;
  let rootStat;
  try {
    rootStat = statSync(root);
  } catch {
    failSetup(`${label} cannot be read: ${root}`);
  }
  if (!rootStat.isDirectory()) {
    failSetup(`${label} must be a directory: ${root}`);
  }
}

// Generated adapters are staged in a disposable directory first, so a
// generation error cannot leave a destination half-written and every planned
// entry becomes a plain file-to-file copy.
stagingRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-workflows-"));

function stageGenerated(relativeName, contents) {
  const stagedPath = join(stagingRoot, relativeName);
  mkdirSync(dirname(stagedPath), { recursive: true });
  writeFileSync(stagedPath, contents, { flag: "wx" });
  return stagedPath;
}

const plan = [];
try {
  for (const pkg of packages) {
    const installedRoot = join(canonicalRoot, pkg.workflowId);
    for (const relativePath of workflowSourcePaths(pkg.manifest)) {
      const segments = relativePath.split("/");
      plan.push({
        label: `${pkg.workflowId}/${relativePath}`,
        source: join(pkg.root, ...segments),
        destination: join(installedRoot, ...segments)
      });
    }

    for (const adapter of generateProviderAdapters(pkg)) {
      plan.push({
        label: `${adapter.provider} ${adapter.kind} for ${adapter.roleId}`,
        source: stageGenerated(
          join(pkg.workflowId, ...adapter.segments),
          adapter.contents
        ),
        destination: join(providerRoots[adapter.provider], ...adapter.segments)
      });
    }
  }
} catch (error) {
  failSetup(error instanceof Error ? error.message : String(error));
}

const plannedDestinations = new Set();
const duplicateDestinations = new Set();
for (const entry of plan) {
  if (plannedDestinations.has(entry.destination)) {
    duplicateDestinations.add(entry.destination);
  }
  plannedDestinations.add(entry.destination);
}
if (duplicateDestinations.size) {
  failSetup(
    "two workflow entries claim the same destination: " +
    `${[...duplicateDestinations].join(", ")}`
  );
}

// Transaction ownership is recorded at file granularity. Rollback removes a
// file only while both its identity and bytes still match this run, restores a
// backup only into an absent destination, and removes directories only while
// empty. Concurrent content is therefore never recursively deleted.
const createdDirectories = [];
const transactions = [];

function ensureDirectory(directory) {
  const missing = [];
  let current = directory;
  while (!entryExists(current)) {
    missing.unshift(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const path of missing) {
    try {
      mkdirSync(path);
    } catch (error) {
      // A directory that appeared concurrently is not ours to roll back.
      if (error?.code === "EEXIST") continue;
      throw error;
    }
    createdDirectories.push(path);
  }
}

function fileIdentity(path) {
  const stat = lstatSync(path);
  return { dev: stat.dev, ino: stat.ino };
}

function isOwnedFile(transaction, path) {
  if (!transaction.identity || !entryExists(path)) return false;
  let identity;
  try {
    identity = fileIdentity(path);
  } catch {
    return false;
  }
  return (
    identity.dev === transaction.identity.dev &&
    identity.ino === transaction.identity.ino &&
    sameContents(transaction.source, path)
  );
}

function restoreNoClobber(source, destination, warnings, label) {
  if (entryExists(destination)) {
    warnings.push(`${label} preserved at ${source}; ${destination} is occupied`);
    return false;
  }

  let stat;
  try {
    stat = lstatSync(source);
    if (stat.isFile()) {
      copyFileSync(source, destination, constants.COPYFILE_EXCL);
      unlinkSync(source);
    } else if (stat.isSymbolicLink()) {
      symlinkSync(readlinkSync(source), destination);
      unlinkSync(source);
    } else if (stat.isDirectory()) {
      mkdirSync(destination);
      cpSync(source, destination, {
        recursive: true,
        errorOnExist: true,
        force: false,
        verbatimSymlinks: true
      });
      rmSync(source, { recursive: true });
    } else {
      warnings.push(`${label} preserved at ${source}; unsupported entry type`);
      return false;
    }
    return true;
  } catch (error) {
    warnings.push(`${label} preserved at ${source}: ${error.message}`);
    return false;
  }
}

function rollback() {
  const warnings = [];
  for (const transaction of [...transactions].reverse()) {
    if (entryExists(transaction.destination)) {
      const quarantine =
        `${transaction.destination}.rollback-${process.pid}-${randomUUID()}`;
      try {
        // Move first, then verify what was moved. This closes the gap between
        // ownership verification and unlinking the live destination.
        renameSync(transaction.destination, quarantine);
        if (isOwnedFile(transaction, quarantine)) {
          unlinkSync(quarantine);
        } else {
          warnings.push(`${transaction.destination} changed concurrently`);
          restoreNoClobber(
            quarantine,
            transaction.destination,
            warnings,
            "concurrent entry"
          );
        }
      } catch (error) {
        if (error?.code !== "ENOENT") {
          warnings.push(
            `could not quarantine ${transaction.destination}: ${error.message}`
          );
        }
      }
    }

    if (transaction.backupPath) {
      restoreNoClobber(
        transaction.backupPath,
        transaction.destination,
        warnings,
        "original"
      );
    }
  }
  transactions.length = 0;

  for (const path of [...createdDirectories].reverse()) {
    try {
      rmdirSync(path);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY" && error?.code !== "EEXIST") {
        warnings.push(`could not remove empty installer directory ${path}: ${error.message}`);
      }
    }
  }
  createdDirectories.length = 0;

  if (warnings.length) {
    console.error("\nRollback requires attention:");
    for (const warning of warnings) console.error(`- ${warning}`);
  }
}

function describe(entry) {
  return (
    `${entry.destination} ` +
    `${destinationProblem(entry.destination, "file") ?? "differs from its bootstrap source"}`
  );
}

const failures = [];
const pending = [];
const conflicts = [];

for (const entry of plan) {
  if (sameContents(entry.source, entry.destination)) {
    console.log(`Current: ${entry.destination}`);
    continue;
  }

  if (!entryExists(entry.destination)) {
    if (checkOnly) failures.push(`${entry.destination} is missing`);
    else if (!preflightOnly) pending.push({ ...entry, present: false });
    continue;
  }

  if (checkOnly) failures.push(describe(entry));
  else if (preflightOnly && !replace) failures.push(describe(entry));
  else if (replace && !preflightOnly) pending.push({ ...entry, present: true });
  else conflicts.push(describe(entry));
}

if (checkOnly || preflightOnly) {
  if (failures.length) {
    reportAndExit(
      preflightOnly ? "Workflow preflight failed:" : "Workflow verification failed:",
      failures
    );
  }
  console.log(
    `\n${preflightOnly ? "Preflighted" : "Verified"} ${packages.length} ` +
    "workflow(s) and their provider adapters."
  );
  finish(0);
}

// Preflight completes before the first write, so a differing destination never
// leaves a partially installed workflow behind.
if (conflicts.length) {
  reportAndExit(
    "Workflow setup requires review before making changes:",
    conflicts,
    "Review the differences, then use --replace if approved"
  );
}

try {
  for (const entry of pending) {
    ensureDirectory(dirname(entry.destination));
    const transaction = {
      destination: entry.destination,
      source: entry.source,
      backupPath: null,
      identity: null
    };
    transactions.push(transaction);
    // Renaming first means a symlinked destination is preserved as a backup and
    // its target is never written through.
    if (entry.present) transaction.backupPath = backupEntry(entry.destination);
    copyFileSync(entry.source, entry.destination, constants.COPYFILE_EXCL);
    transaction.identity = fileIdentity(entry.destination);
    console.log(`Placed ${entry.destination}`);
  }
} catch (error) {
  rollback();
  if (error?.code === "EEXIST") {
    failSetup(
      `a workflow destination appeared during setup; rerun: ${error.path}`
    );
  }
  failSetup(error instanceof Error ? error.message : String(error));
}

for (const entry of plan) {
  if (!sameContents(entry.source, entry.destination)) {
    failures.push(`${entry.destination} did not install correctly`);
  }
}

if (failures.length) {
  rollback();
  reportAndExit("Workflow setup requires attention:", failures);
}

const installedRoots = packages
  .map((pkg) => join(canonicalRoot, pkg.workflowId))
  .join(", ");
console.log(
  `\nInstalled ${packages.length} workflow(s) at ${installedRoots} with ` +
  "generated Claude and Codex adapters."
);
finish(0);
