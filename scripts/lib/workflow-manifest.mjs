// Loads and validates the portable workflow packages. An explicit registry
// names the packages, so nothing is discovered by scanning arbitrary
// directories, and every declared source is validated before any destination is
// touched.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isReadableRegularFile } from "./fs-safety.mjs";
import { isPortableRelativePath } from "./portable-path.mjs";

export const WORKFLOW_REGISTRY_SCHEMA_VERSION = 1;
export const WORKFLOW_MANIFEST_SCHEMA_VERSION = 1;

const identifierPattern = /^[a-z0-9][a-z0-9-]*$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
// Claude Code subagent names are lowercase letters and hyphens, and may not
// contain ":", which is reserved for plugin-scoped identifiers.
const claudeNamePattern = /^[a-z][a-z0-9-]*$/;
// Codex custom agent names are used verbatim when spawning the agent.
const codexNamePattern = /^[a-z][a-z0-9_]*$/;
// Codex profile files are $CODEX_HOME/<profile>.config.toml.
const codexProfilePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function readJson(path, label) {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw new Error(`${label} must be a readable regular file: ${path}`);
  }
  try {
    return JSON.parse(contents);
  } catch {
    throw new Error(`${label} must contain valid JSON: ${path}`);
  }
}

function hasControlCharacter(value) {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

// Provider identifiers and human-facing summaries are embedded in generated
// YAML and TOML, so control characters and line breaks are rejected here rather
// than escaped at generation time.
function isSingleLineText(value, maxLength = 500) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !hasControlCharacter(value)
  );
}

export function loadWorkflowRegistry(registryPath) {
  const registry = readJson(registryPath, "Workflow registry");

  if (
    registry?.schemaVersion !== WORKFLOW_REGISTRY_SCHEMA_VERSION ||
    !Array.isArray(registry.workflows) ||
    registry.workflows.length === 0
  ) {
    throw new Error(`Unsupported workflow registry: ${registryPath}`);
  }

  const seen = new Set();
  for (const workflowId of registry.workflows) {
    if (typeof workflowId !== "string" || !identifierPattern.test(workflowId)) {
      throw new Error(
        `Invalid workflow id in ${registryPath}: ${JSON.stringify(workflowId)}`
      );
    }
    if (seen.has(workflowId)) {
      throw new Error(`Duplicate workflow id in ${registryPath}: ${workflowId}`);
    }
    seen.add(workflowId);
  }

  return registry;
}

function validateRole(role, manifestPath, seenIds) {
  const label = `Invalid role entry in ${manifestPath}`;

  if (!role || typeof role !== "object") throw new Error(label);
  if (typeof role.id !== "string" || !identifierPattern.test(role.id)) {
    throw new Error(`${label}: role id must be lowercase and hyphenated`);
  }
  if (seenIds.has(role.id)) {
    throw new Error(`Duplicate role id in ${manifestPath}: ${role.id}`);
  }
  seenIds.add(role.id);

  if (!isSingleLineText(role.title, 80)) {
    throw new Error(`${label}: ${role.id} needs a single-line title`);
  }
  if (!isSingleLineText(role.summary)) {
    throw new Error(`${label}: ${role.id} needs a single-line summary`);
  }
  if (!isPortableRelativePath(role.source)) {
    throw new Error(`${label}: ${role.id} has an unsafe source path`);
  }

  const claude = role.claude;
  if (
    !claude ||
    typeof claude !== "object" ||
    typeof claude.name !== "string" ||
    !claudeNamePattern.test(claude.name) ||
    typeof claude.primarySession !== "boolean"
  ) {
    throw new Error(`${label}: ${role.id} has an invalid Claude adapter`);
  }

  const codex = role.codex;
  if (
    !codex ||
    typeof codex !== "object" ||
    typeof codex.name !== "string" ||
    !codexNamePattern.test(codex.name) ||
    (codex.profile !== undefined &&
      (typeof codex.profile !== "string" ||
        !codexProfilePattern.test(codex.profile)))
  ) {
    throw new Error(`${label}: ${role.id} has an invalid Codex adapter`);
  }
}

export function loadWorkflowManifest(manifestPath, expectedWorkflowId) {
  const manifest = readJson(manifestPath, "Workflow manifest");

  if (manifest?.schemaVersion !== WORKFLOW_MANIFEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported workflow manifest: ${manifestPath}`);
  }
  if (manifest.workflowId !== expectedWorkflowId) {
    throw new Error(
      `Workflow manifest id ${JSON.stringify(manifest.workflowId)} does not ` +
      `match its directory ${expectedWorkflowId}`
    );
  }
  if (
    typeof manifest.workflowVersion !== "string" ||
    !versionPattern.test(manifest.workflowVersion)
  ) {
    throw new Error(`Invalid workflow version in ${manifestPath}`);
  }
  if (!isSingleLineText(manifest.title, 80)) {
    throw new Error(`Invalid workflow title in ${manifestPath}`);
  }
  if (!isSingleLineText(manifest.summary)) {
    throw new Error(`Invalid workflow summary in ${manifestPath}`);
  }
  if (!isPortableRelativePath(manifest.workflowDocument)) {
    throw new Error(`Invalid workflow document path in ${manifestPath}`);
  }
  if (!isSingleLineText(manifest.taskArtifactPath, 120)) {
    throw new Error(`Invalid task artifact path in ${manifestPath}`);
  }

  if (!Array.isArray(manifest.roles) || manifest.roles.length === 0) {
    throw new Error(`Workflow manifest declares no roles: ${manifestPath}`);
  }
  const roleIds = new Set();
  for (const role of manifest.roles) validateRole(role, manifestPath, roleIds);

  if (!Array.isArray(manifest.templates) || manifest.templates.length === 0) {
    throw new Error(`Workflow manifest declares no templates: ${manifestPath}`);
  }
  const templateIds = new Set();
  for (const template of manifest.templates) {
    if (
      !template ||
      typeof template.id !== "string" ||
      !identifierPattern.test(template.id) ||
      !isPortableRelativePath(template.source)
    ) {
      throw new Error(`Invalid template entry in ${manifestPath}`);
    }
    if (templateIds.has(template.id)) {
      throw new Error(
        `Duplicate template id in ${manifestPath}: ${template.id}`
      );
    }
    templateIds.add(template.id);
  }

  return manifest;
}

// Every path the installer will read, relative to the workflow package root.
export function workflowSourcePaths(manifest) {
  return [
    "manifest.json",
    manifest.workflowDocument,
    ...manifest.roles.map((role) => role.source),
    ...manifest.templates.map((template) => template.source)
  ];
}

export function loadWorkflowPackages(workflowsRoot) {
  const registry = loadWorkflowRegistry(join(workflowsRoot, "registry.json"));
  const packages = [];
  const claudeNames = new Map();
  const codexNames = new Map();
  const codexProfiles = new Map();

  for (const workflowId of registry.workflows) {
    const root = join(workflowsRoot, workflowId);
    const manifestPath = join(root, "manifest.json");
    const manifest = loadWorkflowManifest(manifestPath, workflowId);

    for (const relativePath of workflowSourcePaths(manifest)) {
      if (!isReadableRegularFile(join(root, relativePath))) {
        throw new Error(
          "Workflow source must be a readable regular file: " +
          `${join(root, relativePath)}`
        );
      }
    }

    // Provider directories are shared with the user's own definitions, so a
    // collision between bootstrap-owned workflows must fail here rather than
    // silently shadowing one role with another.
    for (const role of manifest.roles) {
      for (const [registryMap, key, kind] of [
        [claudeNames, role.claude.name, "Claude agent name"],
        [codexNames, role.codex.name, "Codex agent name"],
        ...(role.codex.profile
          ? [[codexProfiles, role.codex.profile, "Codex profile name"]]
          : [])
      ]) {
        const owner = registryMap.get(key);
        if (owner) {
          throw new Error(
            `Duplicate ${kind} ${key} in ${workflowId}/${role.id} and ${owner}`
          );
        }
        registryMap.set(key, `${workflowId}/${role.id}`);
      }
    }

    packages.push({ workflowId, root, manifest });
  }

  return { registry, packages };
}
