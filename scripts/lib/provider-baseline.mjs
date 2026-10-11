// One owner for "are this repository's provider facts still current". The
// reviewed baseline in providers.json records when the official provider docs
// were last checked and which provider versions last passed the live smoke
// check; setup compares it with the installed CLIs and only ever advises.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const providers = [
  { id: "claude", command: "claude", label: "Claude Code" },
  { id: "codex", command: "codex", label: "Codex" }
];
export const documentationMaxAgeDays = 30;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const versionPattern = /^\d+(\.\d+)*$/;

export function loadProviderBaseline(path) {
  const baseline = JSON.parse(readFileSync(path, "utf8"));
  if (baseline?.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (!datePattern.test(baseline.documentationChecked ?? "")) {
    throw new Error("documentationChecked must be YYYY-MM-DD");
  }
  const smoke = baseline.smokeTested;
  if (!datePattern.test(smoke?.date ?? "")) throw new Error("smokeTested.date must be YYYY-MM-DD");
  for (const { id } of providers) {
    if (!versionPattern.test(smoke[id] ?? "")) throw new Error(`smokeTested.${id} must be a version`);
  }
  return baseline;
}

export function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

// Returns the installed version, or null when the CLI is absent or unreadable.
export function probeProviderVersion(command) {
  const probe = spawnSync(command, ["--version"], { encoding: "utf8", shell: false, timeout: 10000 });
  if (probe.error || probe.status !== 0) return null;
  return probe.stdout.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
}

export function providerAdvisories(baseline, installed, today = new Date()) {
  const advisories = [];
  const age = Math.floor((today - new Date(`${baseline.documentationChecked}T00:00:00Z`)) / 86400000);
  if (age > documentationMaxAgeDays) {
    advisories.push(
      `Provider documentation was last checked ${age} days ago; recheck the sources in ` +
        "docs/provider-contracts.md and update providers.json."
    );
  }
  for (const { id, label } of providers) {
    const version = installed[id];
    const tested = baseline.smokeTested[id];
    if (version && compareVersions(version, tested) > 0) {
      advisories.push(
        `${label} ${version} is newer than the smoke-tested ${tested}; run the guidance-audit ` +
          "skill and, with the user's approval, node scripts/smoke-providers.mjs (it makes model calls)."
      );
    }
  }
  return advisories;
}
