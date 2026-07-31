#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashDirectory } from "./lib/skill-integrity.mjs";
import { loadSkillManifest } from "./lib/skill-manifest.mjs";
import {
  fetchReviewedSource,
  materializeReviewedSkill
} from "./lib/skill-source.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(scriptDir, "..", "skills.json");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--check", "--preflight", "--print-hashes"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));
const checkOnly = args.has("--check");
const preflightOnly = args.has("--preflight");
const printHashes = args.has("--print-hashes");
const userHome = homedir();
const canonicalRoot = join(userHome, ".agents", "skills");
const claudeRoot = join(userHome, ".claude", "skills");
const codexRoot = join(userHome, ".codex", "skills");
const failures = [];

function failSetup(message) {
  console.error(`\nSkill setup failed: ${message}`);
  process.exit(1);
}

let manifest;
try {
  manifest = loadSkillManifest(manifestPath);
} catch (error) {
  failSetup(error instanceof Error ? error.message : String(error));
}

if (unknownArgs.length) {
  failSetup(`Unknown argument(s): ${unknownArgs.join(", ")}`);
}

if ([checkOnly, preflightOnly, printHashes].filter(Boolean).length > 1) {
  failSetup("--check, --preflight, and --print-hashes cannot be combined");
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

function canonicalSkillPath(name) {
  return join(canonicalRoot, name);
}

function comparablePath(path) {
  const absolute = resolve(path);
  if (process.platform !== "win32") return absolute;
  return absolute.replace(/^\\\\\?\\/, "").toLowerCase();
}

function hasSkill(name) {
  return existsSync(join(canonicalSkillPath(name), "SKILL.md"));
}

function validateClaudeDestination(name) {
  const source = canonicalSkillPath(name);
  const destination = join(claudeRoot, name);

  if (!entryExists(destination)) return;

  const stat = lstatSync(destination);
  if (!stat.isSymbolicLink()) {
    failures.push(`${name}: Claude destination exists but is not a symlink`);
    return;
  }

  const actual = resolve(claudeRoot, readlinkSync(destination));
  if (comparablePath(actual) !== comparablePath(source)) {
    failures.push(`${name}: Claude symlink points to ${actual}`);
  }
}

function ensureClaudeLinks(skills) {
  const missingLinks = skills.filter(
    (skill) => !entryExists(join(claudeRoot, skill.name))
  );
  if (checkOnly) {
    for (const skill of missingLinks) {
      failures.push(`${skill.name}: Claude symlink is missing`);
    }
    return;
  }
  if (!missingLinks.length) return;

  const createdLinks = [];
  try {
    mkdirSync(claudeRoot, { recursive: true });
    for (const skill of missingLinks) {
      const source = canonicalSkillPath(skill.name);
      const destination = join(claudeRoot, skill.name);
      if (process.platform === "win32") {
        symlinkSync(source, destination, "junction");
      } else {
        symlinkSync(relative(claudeRoot, source), destination);
      }
      createdLinks.push(destination);
    }
  } catch (error) {
    for (const destination of createdLinks) {
      rmSync(destination, { recursive: true, force: true });
    }
    failures.push(`Claude link setup: ${error.message}`);
    return;
  }

  for (const skill of missingLinks) {
    console.log(`Linked ${skill.name} for Claude Code`);
  }
}

if (printHashes) {
  const reported = [];
  for (const skill of manifest.skills) {
    try {
      reported.push(`${skill.name} ${hashDirectory(canonicalSkillPath(skill.name))}`);
    } catch (error) {
      failSetup(
        `cannot report hashes until every skill is installed; ${skill.name}: ` +
        `${error.message}`
      );
    }
  }
  for (const line of reported) console.log(line);
  process.exit(0);
}

// The reviewed hash intentionally covers every entry, so stray OS metadata
// breaks verification. Name those files so the fix is obvious.
const osMetadataNames = new Set([".DS_Store", "Thumbs.db"]);

function findOsMetadata(root, relativeDirectory = "", found = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      findOsMetadata(join(root, entry.name), relativePath, found);
    } else if (osMetadataNames.has(entry.name)) {
      found.push(relativePath);
    }
  }
  return found;
}

function verifySkill(skill) {
  let actualHash;
  try {
    actualHash = hashDirectory(canonicalSkillPath(skill.name));
  } catch (error) {
    failures.push(`${skill.name}: ${error.message}`);
    return false;
  }

  if (actualHash !== skill.contentSha256) {
    let metadata = [];
    try {
      metadata = findOsMetadata(canonicalSkillPath(skill.name));
    } catch {
      metadata = [];
    }
    failures.push(
      `${skill.name}: content hash ${actualHash} does not match reviewed ` +
      `${skill.contentSha256}` +
      (metadata.length
        ? `; remove stray OS metadata first (${metadata.join(", ")})`
        : "")
    );
    return false;
  }

  if (skill.expectedVersion) {
    const skillContents = readFileSync(
      join(canonicalSkillPath(skill.name), "SKILL.md"),
      "utf8"
    );
    const actualVersion = skillContents.match(/^version:\s*(\S+)\s*$/m)?.[1];
    if (actualVersion !== skill.expectedVersion) {
      failures.push(
        `${skill.name}: version ${actualVersion ?? "missing"} does not match ` +
        `${skill.expectedVersion}`
      );
      return false;
    }
  }

  return true;
}

function installMissingSkills(skills) {
  const stagingRoot = mkdtempSync(join(tmpdir(), "machine-bootstrap-skills-"));
  const fetchedSources = new Map();
  const installedPaths = [];

  try {
    for (const skill of skills) {
      const sourceKey = `${skill.repository}@${skill.sourceRevision}`;
      if (!fetchedSources.has(sourceKey)) {
        console.log(`Fetching reviewed source for ${skill.name}...`);
        fetchedSources.set(
          sourceKey,
          fetchReviewedSource(skill.repository, skill.sourceRevision)
        );
      }

      const fetched = fetchedSources.get(sourceKey);
      const stagedPath = join(stagingRoot, skill.name);
      materializeReviewedSkill(
        fetched.repositoryRoot,
        skill.sourceRevision,
        skill.sourcePath,
        stagedPath
      );
      const stagedHash = hashDirectory(stagedPath);
      if (stagedHash !== skill.contentSha256) {
        throw new Error(
          `${skill.name}: fetched content hash ${stagedHash} does not match ` +
          `reviewed ${skill.contentSha256}`
        );
      }
    }

    mkdirSync(canonicalRoot, { recursive: true });
    for (const skill of skills) {
      const destination = canonicalSkillPath(skill.name);
      if (entryExists(destination)) {
        throw new Error(`skill destination appeared during setup: ${destination}`);
      }
    }

    try {
      for (const skill of skills) {
        const destination = canonicalSkillPath(skill.name);
        try {
          // Atomically claim the destination before treating it as ours. If a
          // concurrent process created it after preflight, do not add it to
          // rollback state and never remove it.
          mkdirSync(destination);
        } catch (error) {
          if (error?.code === "EEXIST") {
            throw new Error(
              `skill destination appeared during setup: ${destination}`
            );
          }
          throw error;
        }
        installedPaths.push(destination);
        cpSync(join(stagingRoot, skill.name), destination, {
          recursive: true,
          errorOnExist: true,
          force: false,
          verbatimSymlinks: true
        });
        const copiedHash = hashDirectory(destination);
        if (copiedHash !== skill.contentSha256) {
          throw new Error(
            `${skill.name}: copied content hash ${copiedHash} does not match ` +
            `reviewed ${skill.contentSha256}`
          );
        }
        console.log(`Installed ${skill.name}`);
      }
    } catch (error) {
      for (const destination of installedPaths) {
        rmSync(destination, { recursive: true, force: true });
      }
      throw error;
    }
  } finally {
    for (const fetched of fetchedSources.values()) fetched.cleanup();
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

for (const [label, root] of [
  ["canonical skill root", canonicalRoot],
  ["Claude skill root", claudeRoot],
  ["Codex skill root", codexRoot]
]) {
  if (!entryExists(root)) continue;
  // Followed, so a root relocated through a symlink stays supported.
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

const missingSkills = [];
for (const skill of manifest.skills) {
  validateClaudeDestination(skill.name);
  if (entryExists(canonicalSkillPath(skill.name)) && !hasSkill(skill.name)) {
    failures.push(
      `${skill.name}: ${canonicalSkillPath(skill.name)} exists without ` +
      `SKILL.md; review and remove it, then rerun`
    );
  } else if (!hasSkill(skill.name)) {
    missingSkills.push(skill);
    if (checkOnly) failures.push(`${skill.name}: canonical skill is missing`);
  } else {
    verifySkill(skill);
  }
  if (entryExists(join(codexRoot, skill.name))) {
    failures.push(`${skill.name}: redundant Codex-specific copy exists`);
  }
}

if (failures.length) {
  console.error("\nSkill verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (preflightOnly) {
  console.log(`\nPreflighted ${manifest.skills.length} shared skills.`);
  process.exit(0);
}

if (missingSkills.length) {
  try {
    installMissingSkills(missingSkills);
  } catch (error) {
    failSetup(error instanceof Error ? error.message : String(error));
  }
}

for (const skill of missingSkills) {
  verifySkill(skill);
}

if (!failures.length) ensureClaudeLinks(manifest.skills);

if (failures.length) {
  console.error("\nSkill verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`\nVerified ${manifest.skills.length} shared skills for Claude Code and Codex.`);
