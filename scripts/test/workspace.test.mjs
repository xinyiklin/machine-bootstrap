// Workspace registry initialization, legacy detection, and boundary checks.
// Runs through scripts/test-bootstrap.mjs; see harness.mjs for shared helpers.

import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  bootstrapRoot,
  includeInTestFixture,
  createTestWorkspace,
  createTestHome,
  isolatedEnvironment,
  test
} from "./harness.mjs";

await test("clean workspace initialization creates only the machine registry", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const command = [
      join(checkoutRoot, "scripts", "init-workspace.mjs"),
      "--skip-skills",
      "--skip-workflows"
    ];
    const result = spawnSync(process.execPath, command, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      readFileSync(
        join(checkoutRoot, "machine-templates", "MACHINE.example.md"),
        "utf8"
      )
    );
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false, name);
    }

    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    const second = spawnSync(process.execPath, command, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(second.status, 0, second.stderr);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );

    const check = spawnSync(process.execPath, [...command, "--check"], {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(check.status, 0, check.stderr);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("workspace check is read-only and allows an absent registry", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const args = [
      join(checkoutRoot, "scripts", "init-workspace.mjs"),
      "--check",
      "--skip-skills",
      "--skip-workflows"
    ];
    const absent = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.equal(absent.status, 0, absent.stderr);
    assert.match(absent.stdout, /Optional machine registry is not present/);
    assert.equal(readdirSync(workspaceRoot).sort().join(","), "machine-bootstrap");

    copyFileSync(
      join(checkoutRoot, "machine-templates", "MACHINE.example.md"),
      join(workspaceRoot, "MACHINE.md")
    );
    const incomplete = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /TODO placeholder/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("malformed MACHINE.md and Git-owned workspaces fail before writes", () => {
  for (const kind of ["machine-directory", "git-workspace"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      if (kind === "machine-directory") mkdirSync(join(workspaceRoot, "MACHINE.md"));
      else {
        const gitResult = spawnSync("git", ["init", "-q"], {
          cwd: workspaceRoot,
          encoding: "utf8",
          shell: false
        });
        assert.equal(gitResult.status, 0, gitResult.stderr);
      }
      const result = spawnSync(
        process.execPath,
        [
          join(checkoutRoot, "scripts", "init-workspace.mjs"),
          "--skip-skills",
          "--skip-workflows"
        ],
        {
          encoding: "utf8",
          env: isolatedEnvironment(testRoot),
          shell: false
        }
      );
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        kind === "machine-directory"
          ? /MACHINE\.md must be a readable regular file/
          : /Workspace root must stay outside Git/
      );
      for (const name of ["AGENTS.md", "CLAUDE.md", "_templates"]) {
        assert.equal(existsSync(join(workspaceRoot, name)), false);
      }
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("a missing Git prerequisite is reported plainly before writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot, { PATH: join(testRoot, "no-tools") }),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Git is required on PATH/);
    assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("a checkout directly under the user home is rejected before writes", () => {
  const testHome = mkdtempSync(join(tmpdir(), "machine-bootstrap-home-root-test-"));
  const checkoutRoot = join(testHome, "machine-bootstrap");
  try {
    mkdirSync(checkoutRoot);
    cpSync(bootstrapRoot, checkoutRoot, {
      recursive: true,
      filter: includeInTestFixture
    });
    const result = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testHome),
        shell: false
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root cannot be the user home/);
    assert.equal(existsSync(join(testHome, "MACHINE.md")), false);
  } finally {
    rmSync(testHome, { recursive: true, force: true });
  }
});

await test("legacy workspace entries stop for manual review without writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const legacyTemplates = join(workspaceRoot, "_templates");
    mkdirSync(legacyTemplates);
    writeFileSync(join(workspaceRoot, "AGENTS.md"), "existing workspace policy\n");
    writeFileSync(join(workspaceRoot, "CLAUDE.md"), "existing Claude policy\n");
    writeFileSync(join(legacyTemplates, "README.md"), "existing templates\n");
    writeFileSync(join(workspaceRoot, "MACHINE.md"), "verified local facts\n");
    const sibling = join(workspaceRoot, "project-b");
    mkdirSync(sibling);
    writeFileSync(join(sibling, "owned.txt"), "sibling bytes\n");
    const siblingBefore = readFileSync(join(sibling, "owned.txt"));

    const normal = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(normal.status, 0);
    assert.match(normal.stderr, /Legacy workspace layout detected/);
    assert.match(normal.stderr, /automatic migration is not supported/i);
    assert.match(normal.stderr, /move .* manually/i);
    assert.equal(existsSync(legacyTemplates), true);
    assert.equal(
      readFileSync(join(workspaceRoot, "AGENTS.md"), "utf8"),
      "existing workspace policy\n"
    );
    assert.equal(existsSync(join(workspaceRoot, ".machine-bootstrap-backup")), false);
    assert.equal(
      readFileSync(join(workspaceRoot, "MACHINE.md"), "utf8"),
      "verified local facts\n"
    );
    assert.deepEqual(readFileSync(join(sibling, "owned.txt")), siblingBefore);

    const removedOption = spawnSync(
      process.execPath,
      [
        join(checkoutRoot, "scripts", "init-workspace.mjs"),
        "--migrate-legacy-layout",
        "--skip-skills",
        "--skip-workflows"
      ],
      {
        encoding: "utf8",
        env: isolatedEnvironment(testRoot),
        shell: false
      }
    );
    assert.notEqual(removedOption.status, 0);
    assert.match(removedOption.stderr, /Unknown argument.*--migrate-legacy-layout/);
    assert.equal(existsSync(legacyTemplates), true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("every root instruction file Claude or Codex would load stops setup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const command = [
    join(checkoutRoot, "scripts", "init-workspace.mjs"),
    "--skip-skills",
    "--skip-workflows"
  ];
  const run = (extraArgs = []) =>
    spawnSync(process.execPath, [...command, ...extraArgs], {
      encoding: "utf8",
      env: isolatedEnvironment(testRoot),
      shell: false
    });
  try {
    // Non-instruction provider files at the root, such as a launch config,
    // are not shared policy.
    mkdirSync(join(workspaceRoot, ".claude"));
    writeFileSync(join(workspaceRoot, ".claude", "launch.json"), "{}\n");
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
    rmSync(join(workspaceRoot, "MACHINE.md"));

    for (const [entry, kind] of [
      ["AGENTS.override.md", "file"],
      ["CLAUDE.local.md", "file"],
      [".claude/AGENTS.md", "file"],
      [".claude/CLAUDE.md", "file"],
      [".claude/rules", "directory"]
    ]) {
      const path = join(workspaceRoot, ...entry.split("/"));
      if (kind === "directory") mkdirSync(path);
      else writeFileSync(path, "workspace policy\n");
      for (const extraArgs of [[], ["--check"]]) {
        const result = run(extraArgs);
        assert.notEqual(result.status, 0, `${entry} ${extraArgs}`);
        assert.ok(result.stderr.includes(entry), `${entry} named`);
        assert.match(result.stderr, /move .* manually/i);
        assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false, entry);
      }
      rmSync(path, { recursive: true, force: true });
    }
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("guidance paths that cannot be inspected stop setup cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const otherHome = createTestHome("unsearchable-home");
  const guarded = [join(workspaceRoot, ".claude"), join(testRoot, ".claude")];
  try {
    for (const directory of guarded) {
      mkdirSync(directory);
      chmodSync(directory, 0o000);
      const result = spawnSync(
        process.execPath,
        [join(checkoutRoot, "scripts", "init-workspace.mjs"), "--skip-skills", "--skip-workflows"],
        { encoding: "utf8", env: isolatedEnvironment(otherHome), shell: false }
      );
      chmodSync(directory, 0o755);
      assert.notEqual(result.status, 0, directory);
      assert.match(result.stderr, /Could not inspect agent guidance path .*\(EACCES\)/);
      assert.doesNotMatch(result.stderr, /node:internal|\n\s+at /);
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
      rmSync(directory, { recursive: true, force: true });
    }
  } finally {
    for (const directory of guarded) {
      if (existsSync(directory)) chmodSync(directory, 0o755);
    }
    rmSync(otherHome, { recursive: true, force: true });
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsPosixPermissions: true });

await test("guidance above the workspace stops setup; a home .claude stays user config", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  const command = [
    join(checkoutRoot, "scripts", "init-workspace.mjs"),
    "--skip-skills",
    "--skip-workflows"
  ];
  const run = (home, extraArgs = [], overrides = {}) =>
    spawnSync(process.execPath, [...command, ...extraArgs], {
      encoding: "utf8",
      env: isolatedEnvironment(home, overrides),
      shell: false
    });
  const otherHome = createTestHome("ancestor-home");
  try {
    // testRoot is both the workspace's parent and the isolated home.
    mkdirSync(join(testRoot, ".claude"));
    writeFileSync(join(testRoot, ".claude", "CLAUDE.md"), "user memory\n");
    const asHome = run(testRoot);
    assert.equal(asHome.status, 0, asHome.stderr);
    rmSync(join(workspaceRoot, "MACHINE.md"));

    // A selected CLAUDE_CONFIG_DIR's CLAUDE.md is user memory too.
    const asConfig = run(otherHome, ["--check"], {
      CLAUDE_CONFIG_DIR: join(testRoot, ".claude")
    });
    assert.equal(asConfig.status, 0, asConfig.stderr);

    // Only CLAUDE.md is user memory: native AGENTS.md reading loads a
    // .claude/AGENTS.md from above the working directory, even at home.
    writeFileSync(join(testRoot, ".claude", "AGENTS.md"), "home agents\n");
    const homeAgents = run(testRoot, ["--check"]);
    assert.notEqual(homeAgents.status, 0);
    assert.match(homeAgents.stderr, /above the workspace/);
    assert.ok(homeAgents.stderr.includes(join(".claude", "AGENTS.md")));
    assert.ok(!homeAgents.stderr.includes(join(".claude", "CLAUDE.md")));
    rmSync(join(testRoot, ".claude", "AGENTS.md"));

    // The same folder is an ordinary ancestor when it is not the home.
    for (const extraArgs of [[], ["--check"]]) {
      const asAncestor = run(otherHome, extraArgs);
      assert.notEqual(asAncestor.status, 0);
      assert.match(asAncestor.stderr, /above the workspace/);
      assert.ok(asAncestor.stderr.includes(join(".claude", "CLAUDE.md")));
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false);
    }
    rmSync(join(testRoot, ".claude"), { recursive: true, force: true });

    for (const name of ["AGENTS.md", "CLAUDE.md", "CLAUDE.local.md"]) {
      writeFileSync(join(testRoot, name), "ancestor policy\n");
      const result = run(testRoot);
      assert.notEqual(result.status, 0, name);
      assert.match(result.stderr, /above the workspace/);
      assert.ok(result.stderr.includes(name), `${name} named`);
      assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), false, name);
      rmSync(join(testRoot, name));
    }
  } finally {
    rmSync(otherHome, { recursive: true, force: true });
    rmSync(testRoot, { recursive: true, force: true });
  }
});
