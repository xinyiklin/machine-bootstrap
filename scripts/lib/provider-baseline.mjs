// One owner for "are this repository's provider facts still current". The
// reviewed baseline in providers.json records when the official provider docs
// were last checked and which provider versions last passed the live smoke
// check; setup compares it with the installed CLIs and only ever advises.

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
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

// Windows runs a .cmd or .bat file only through cmd.exe, and npm installs
// provider CLIs as such shims, so a plain spawn of "codex" finds nothing there.
// The command is resolved on PATH alone, never the current directory, and a
// shim runs through cmd.exe with quoted arguments that cannot expand. A
// trailing backslash would escape the closing quote for the program the shim
// starts, so it is refused too; NoDefaultCurrentDirectoryInExePath keeps the
// shim's own lookups (npm shims call a bare `node`) off the current directory.
const windowsDirect = new Set([".com", ".exe"]);
const windowsShim = new Set([".bat", ".cmd"]);
const shimUnsafe = /["%!^\r\n]|\\$/;

function environmentValue(env, name) {
  const key = Object.keys(env).find((candidate) => candidate.toUpperCase() === name.toUpperCase());
  return key === undefined ? undefined : env[key];
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

// Returns { file, args, verbatim } to spawn, or null when the command is not
// on PATH. Throws when a shim cannot be passed these arguments safely.
export function resolveProviderSpawn(command, args, { platform = process.platform, env = process.env } = {}) {
  if (platform !== "win32") return { file: command, args, verbatim: false };
  const extensions = (environmentValue(env, "PATHEXT") || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .map((extension) => extension.trim().toLowerCase())
    .filter((extension) => windowsDirect.has(extension) || windowsShim.has(extension));
  for (const entry of (environmentValue(env, "PATH") ?? "").split(";")) {
    const directory = entry.trim().replace(/^"(.*)"$/, "$1");
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = join(directory, command + extension);
      if (!isFile(candidate)) continue;
      if (windowsDirect.has(extension)) return { file: candidate, args, verbatim: false };
      const parts = [candidate, ...args];
      const unsafe = parts.find((part) => shimUnsafe.test(part));
      if (unsafe !== undefined) {
        throw new Error(`cannot pass ${JSON.stringify(unsafe)} to ${candidate} through cmd.exe`);
      }
      const shell =
        environmentValue(env, "ComSpec") ||
        join(environmentValue(env, "SystemRoot") || "C:\\Windows", "System32", "cmd.exe");
      const line = parts.map((part) => `"${part}"`).join(" ");
      return { file: shell, args: ["/d", "/v:off", "/s", "/c", `"${line}"`], verbatim: true };
    }
  }
  return null;
}

// spawnSync for a provider CLI. A command that is missing or cannot be run
// safely comes back as a result with `error` set, as spawnSync reports ENOENT.
export function spawnProvider(command, args, options = {}) {
  let resolved;
  try {
    resolved = resolveProviderSpawn(command, args, { env: options.env ?? process.env });
  } catch (error) {
    return { error, status: null, stdout: "", stderr: "" };
  }
  if (!resolved) {
    return { error: new Error(`${command} was not found on PATH`), status: null, stdout: "", stderr: "" };
  }
  const env = options.env ?? process.env;
  return spawnSync(resolved.file, resolved.args, {
    ...options,
    env: resolved.verbatim ? { ...env, NoDefaultCurrentDirectoryInExePath: "1" } : env,
    shell: false,
    windowsVerbatimArguments: resolved.verbatim
  });
}

// Returns the installed version, or null when the CLI is absent or unreadable.
export function probeProviderVersion(command, env = process.env) {
  const probe = spawnProvider(command, ["--version"], { encoding: "utf8", timeout: 10000, env });
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
