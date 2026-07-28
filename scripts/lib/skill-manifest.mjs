import { readFileSync } from "node:fs";
import {
  isPortableSkillPath,
  isReviewedGitHubRepository
} from "./skill-source.mjs";

export function loadSkillManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${manifestPath} must contain valid JSON`);
    }
    throw new Error(`${manifestPath} must be a readable regular file`);
  }

  if (manifest?.schemaVersion !== 3 || !Array.isArray(manifest.skills)) {
    throw new Error(`Unsupported skills manifest: ${manifestPath}`);
  }

  const skillNames = new Set();
  for (const skill of manifest.skills) {
    if (
      !skill ||
      typeof skill.name !== "string" ||
      !/^[a-z0-9][a-z0-9-]*$/.test(skill.name) ||
      !isReviewedGitHubRepository(skill.repository) ||
      !isPortableSkillPath(skill.sourcePath) ||
      typeof skill.sourceRevision !== "string" ||
      !/^[a-f0-9]{40}$/.test(skill.sourceRevision) ||
      typeof skill.contentSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(skill.contentSha256) ||
      (skill.expectedVersion !== undefined &&
        (typeof skill.expectedVersion !== "string" ||
          !/^\d+\.\d+\.\d+$/.test(skill.expectedVersion)))
    ) {
      throw new Error(`Invalid skill entry in ${manifestPath}`);
    }

    if (skillNames.has(skill.name)) {
      throw new Error(`Duplicate skill name in ${manifestPath}: ${skill.name}`);
    }
    skillNames.add(skill.name);
  }

  return manifest;
}
