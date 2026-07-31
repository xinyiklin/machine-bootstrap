#!/usr/bin/env node

import { constants, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  destinationProblem,
  entryExists,
  isReadableRegularFile,
  placeEntry,
  sameContents,
  sameDirectory
} from "./lib/fs-safety.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const bootstrapRoot = resolve(scriptDir, "..");
const workspaceRoot = resolve(bootstrapRoot, "..");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--check", "--preflight", "--replace"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const preflightOnly = args.has("--preflight");
const replace = args.has("--replace");
const failures = [];

function failSetup(message) {
  console.error(`\nWorkspace setup failed: ${message}`);
  process.exit(1);
}

if (unknownArgs.length) {
  failSetup(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}

if (checkOnly && (preflightOnly || replace)) {
  failSetup("--check cannot be combined with --preflight or --replace");
}

function place(source, destination, kind) {
  placeEntry(source, destination, kind, { checkOnly, replace, failures });
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

if (preflightOnly) {
  console.log(`\nPreflighted workspace guidance at ${workspaceRoot}.`);
  process.exit(0);
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
