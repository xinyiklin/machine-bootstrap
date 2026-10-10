// Project seeding, .gitignore policy, ownership-safe rollback, and the workspace audit.
// Runs through scripts/test-bootstrap.mjs; see harness.mjs for shared helpers.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  bootstrapRoot,
  capabilities,
  createTestWorkspace,
  isolatedEnvironment,
  test
} from "./harness.mjs";

function runProjectInitializer(
  checkoutRoot,
  target,
  testHome,
  extraArgs = [],
  environmentOverrides = {}
) {
  return spawnSync(
    process.execPath,
    [join(checkoutRoot, "scripts", "init-project.mjs"), target, ...extraArgs],
    {
      cwd: checkoutRoot,
      encoding: "utf8",
      env: isolatedEnvironment(testHome, environmentOverrides),
      shell: false
    }
  );
}

await test("Git boundary probes ignore inherited path overrides", () => {
  for (const initializer of ["workspace", "project"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const overrides = {
        GIT_DIR: join(testRoot, "spoof.git"),
        GIT_WORK_TREE: join(testRoot, "spoof-worktree"),
        GIT_COMMON_DIR: join(testRoot, "spoof-common.git"),
        GIT_INDEX_FILE: join(testRoot, "spoof.index"),
        GIT_CEILING_DIRECTORIES: workspaceRoot
      };
      let result;
      if (initializer === "workspace") {
        result = spawnSync(
          process.execPath,
          [
            join(checkoutRoot, "scripts", "init-workspace.mjs"),
            "--skip-skills",
            "--skip-workflows"
          ],
          {
            encoding: "utf8",
            env: isolatedEnvironment(testRoot, overrides),
            shell: false
          }
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(join(workspaceRoot, "MACHINE.md")), true);
      } else {
        const project = join(workspaceRoot, "project-a");
        result = runProjectInitializer(
          checkoutRoot,
          project,
          testRoot,
          ["--create"],
          overrides
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(existsSync(join(project, "AGENTS.md")), true);
      }
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

function gitCheckIgnore(project, relativePath) {
  return spawnSync(
    "git",
    ["-C", project, "check-ignore", "--quiet", "--no-index", "--", relativePath],
    { encoding: "utf8", shell: false }
  );
}

function directoryByteHash(root) {
  const hash = createHash("sha256");
  function visit(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      hash.update(relativePath);
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath, relativePath);
      else hash.update(readFileSync(absolutePath));
    }
  }
  visit(root);
  return hash.digest("hex");
}

await test("workspace audit reports sibling guidance budgets without writing", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const oversized = join(workspaceRoot, "project-a");
    mkdirSync(join(oversized, ".git"), { recursive: true });
    writeFileSync(join(oversized, "AGENTS.md"), `# A\n${"x".repeat(9 * 1024)}\nTODO\n`);
    writeFileSync(join(oversized, "CLAUDE.md"), "# A\n\nRead AGENTS.md first.\n");
    writeFileSync(
      join(oversized, "CONTINUITY.md"),
      Array.from({ length: 200 }, (_, index) => `- entry ${index}`).join("\n") + "\n"
    );
    const agentsOnly = join(workspaceRoot, "project-b");
    mkdirSync(agentsOnly);
    writeFileSync(join(agentsOnly, "AGENTS.md"), "# B\n");
    const healthy = join(workspaceRoot, "project-c");
    mkdirSync(healthy);
    writeFileSync(join(healthy, "AGENTS.md"), "# C\n");
    writeFileSync(join(healthy, "CLAUDE.md"), "# C\n\n@AGENTS.md\n");
    writeFileSync(join(healthy, "CONTINUITY.md"), "- current\n");
    mkdirSync(join(workspaceRoot, "scratch"));
    writeFileSync(join(workspaceRoot, "scratch", "AGENTS.md"), "scratch\n");
    mkdirSync(join(workspaceRoot, ".hidden"));
    writeFileSync(join(workspaceRoot, "MACHINE.md"), "TODO private registry\n");
    if (capabilities.symlinks) {
      symlinkSync(healthy, join(workspaceRoot, "linked-project"),
        process.platform === "win32" ? "junction" : "dir");
    }
    const linkedGuide = join(workspaceRoot, "project-d");
    mkdirSync(linkedGuide);
    writeFileSync(join(linkedGuide, "AGENTS.md"), "# D\n");
    if (capabilities.symlinks) {
      symlinkSync(join(healthy, "CLAUDE.md"), join(linkedGuide, "CLAUDE.md"));
    }
    if (capabilities.posixPermissions) {
      writeFileSync(join(linkedGuide, "CONTINUITY.md"), "- private\n");
      chmodSync(join(linkedGuide, "CONTINUITY.md"), 0o000);
    }
    const before = [oversized, agentsOnly, healthy].map(directoryByteHash);
    const machineBefore = readFileSync(join(workspaceRoot, "MACHINE.md"));

    const result = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "audit-workspace.mjs")],
      { encoding: "utf8", env: isolatedEnvironment(testRoot), shell: false }
    );
    assert.equal(result.status, 0, result.stderr);
    const out = result.stdout;
    assert.match(out, /project-a: AGENTS\.md is 9\.\d KiB, over the 8\.0 KiB target/);
    assert.match(out, /project-a: CLAUDE\.md imports AGENTS\.md 0 time\(s\)/);
    assert.match(out, /project-a: 1 TODO marker\(s\)/);
    assert.match(out, /project-a: CONTINUITY\.md is 200 lines .* over the default 160-line cap/);
    assert.match(out, /project-b: no CLAUDE\.md: Claude Code 2\.1\.277\+ reads AGENTS\.md natively/);
    assert.doesNotMatch(out, /project-c:/);
    assert.match(out, /^project-c\s+no\s+0\.0 KiB\s+0\.0 KiB\s+1\s+1 lines$/m);
    assert.doesNotMatch(out, /scratch|\.hidden|linked-project|machine-bootstrap\s/);
    if (capabilities.symlinks) {
      assert.match(out, /project-d: CLAUDE\.md is a symbolic link; not followed/);
      assert.doesNotMatch(out, /project-d: no CLAUDE\.md/);
    }
    if (capabilities.posixPermissions) {
      assert.match(out, /project-d: CONTINUITY\.md could not be read \(EACCES\)/);
      chmodSync(join(linkedGuide, "CONTINUITY.md"), 0o644);
    }
    assert.doesNotMatch(out, /private registry/);
    assert.deepEqual([oversized, agentsOnly, healthy].map(directoryByteHash), before);
    assert.deepEqual(readFileSync(join(workspaceRoot, "MACHINE.md")), machineBefore);

    const bad = spawnSync(
      process.execPath,
      [join(checkoutRoot, "scripts", "audit-workspace.mjs"), "--fix"],
      { encoding: "utf8", env: isolatedEnvironment(testRoot), shell: false }
    );
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /Unknown argument\(s\): --fix/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization changes only its explicit target", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const projectA = join(workspaceRoot, "project-a");
    const projectB = join(workspaceRoot, "project-b");
    mkdirSync(projectB);
    writeFileSync(join(projectB, "owned.txt"), "project b\n");
    const siblingBefore = directoryByteHash(projectB);

    const result = runProjectInitializer(
      checkoutRoot,
      projectA,
      testRoot,
      ["--create"]
    );
    assert.equal(result.status, 0, result.stderr);
    for (const path of [
      "AGENTS.md",
      "CLAUDE.md",
      ".gitignore",
      "docs/engineering/git-workflow.md",
      ".github/pull_request_template.md"
    ]) {
      assert.equal(existsSync(join(projectA, ...path.split("/"))), true, path);
    }
    assert.equal(existsSync(join(projectA, "README.md")), false);
    assert.equal(existsSync(join(projectA, "TEMPLATE-USAGE.md")), false);
    assert.equal(directoryByteHash(projectB), siblingBefore);
    for (const name of ["AGENTS.md", "CLAUDE.md", "_templates", "MACHINE.md"]) {
      assert.equal(existsSync(join(workspaceRoot, name)), false, name);
    }
    const claude = readFileSync(join(projectA, "CLAUDE.md"), "utf8");
    assert.equal((claude.match(/^@AGENTS\.md$/gm) ?? []).length, 1);
    assert.match(result.stdout, /Remaining template placeholders:/);
    assert.match(result.stdout, /Start a new Codex or Claude session/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization reports a dangling target link cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const target = join(workspaceRoot, "project-a");
    symlinkSync(join(workspaceRoot, "missing-project"), target, "dir");

    const result = runProjectInitializer(checkoutRoot, target, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Project initialization failed: Target must resolve to an existing directory/
    );
    assert.doesNotMatch(result.stderr, /\n\s+at canonicalCandidate/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization reports a dangling target parent cleanly", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const parent = join(workspaceRoot, "dangling-parent");
    const target = join(parent, "project-a");
    symlinkSync(join(workspaceRoot, "missing-parent"), parent, "dir");

    const result = runProjectInitializer(
      checkoutRoot,
      target,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Project initialization failed: Target parent must resolve to an existing directory/
    );
    assert.doesNotMatch(result.stderr, /file:\/\/|node:internal|at canonicalCandidate/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization rejects a symlinked template source", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalSource = join(testRoot, "external-agent-policy.md");
    const templateSource = join(
      checkoutRoot,
      "project-templates",
      "AGENTS.md"
    );
    writeFileSync(externalSource, "external private policy bytes\n");
    rmSync(templateSource);
    symlinkSync(externalSource, templateSource);

    const result = runProjectInitializer(
      checkoutRoot,
      project,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Template must be a regular file: AGENTS\.md/);
    assert.equal(existsSync(project), false);
    assert.equal(
      readFileSync(externalSource, "utf8"),
      "external private policy bytes\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test(
  "project initialization rejects a starter symlink that appears mid-run",
  () => {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      const externalTarget = join(testRoot, "external-private.txt");
      mkdirSync(project);
      writeFileSync(externalTarget, "external private bytes\n");

      const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
      const initializer = readFileSync(initializerPath, "utf8");
      const needle = "    const destination = join(canonicalTarget, ...parts);";
      assert.ok(initializer.includes(needle), "starter injection point must exist");
      assert.equal(
        initializer.indexOf(needle),
        initializer.lastIndexOf(needle),
        "starter injection point must be unique"
      );
      writeFileSync(
        initializerPath,
        initializer.replace(
          needle,
          needle +
            `\n` +
            `    if (relativePath === "AGENTS.md") {\n` +
            `      symlinkSync(${JSON.stringify(externalTarget)}, destination);\n` +
            `    }`
        )
      );

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /(?:appeared during initialization|Managed project path must be a real file)/
      );
      assert.equal(
        readFileSync(externalTarget, "utf8"),
        "external private bytes\n"
      );
      assert.equal(lstatSync(join(project, "AGENTS.md")).isSymbolicLink(), true);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  },
  { needsSymlinks: true }
);

await test("project initialization does not follow a replaced managed parent", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalParent = join(testRoot, "external-parent");
    mkdirSync(project);
    mkdirSync(externalParent);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle =
      "    copyTrackedFile(templateContents.get(relativePath), destination);";
    assert.ok(initializer.includes(needle), "parent injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `    if (relativePath === "docs/engineering/git-workflow.md") {\n` +
          `      const managedParent = join(canonicalTarget, "docs", "engineering");\n` +
          `      renameSync(managedParent, managedParent + ".original");\n` +
          `      symlinkSync(${JSON.stringify(externalParent)}, managedParent, "dir");\n` +
          `    }\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Managed parent (?:changed during initialization|must be a real directory)/
    );
    assert.equal(existsSync(join(externalParent, "git-workflow.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project initialization pins the original target directory", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const originalProject = `${project}.original`;
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    const destination = join(canonicalTarget, ...parts);";
    assert.ok(initializer.includes(needle), "target injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "target injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        needle +
          `\n` +
          `    if (relativePath === "CLAUDE.md") {\n` +
          `      renameSync(canonicalTarget, ${JSON.stringify(originalProject)});\n` +
          `      mkdirSync(canonicalTarget);\n` +
          `    }`
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent changed during initialization/);
    assert.equal(existsSync(join(project, "CLAUDE.md")), false);
    assert.equal(existsSync(join(originalProject, "AGENTS.md")), true);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization never replaces a late directory arrival", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    mkdirSync(leaf);";
    assert.ok(initializer.includes(needle), "directory claim injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "directory claim injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "    mkdirSync(leaf);\n" +
          needle
      )
    );

    const result = runProjectInitializer(
      checkoutRoot,
      project,
      testRoot,
      ["--create"]
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /EEXIST|file already exists/i);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
    assert.deepEqual(readdirSync(project), []);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization fails before rewriting a vanished starter", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, "AGENTS.md"), "project-owned policy\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "    const expected = managedFileAnchors.get(destination);";
    assert.ok(initializer.includes(needle), "starter disappearance injection must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "starter disappearance injection must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `    if (relativePath === "AGENTS.md") rmSync(destination);\n` + needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md disappeared during initialization/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
    assert.equal(existsSync(join(project, "CLAUDE.md")), false);
    assert.equal(existsSync(join(project, ".gitignore")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization preflights parents before starter writes", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const writeMarker = join(testRoot, "starter-write-attempted.txt");
    mkdirSync(project);
    writeFileSync(join(project, "docs"), "user-owned file\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "function copyTrackedFile(expectedContents, destination) {";
    assert.ok(initializer.includes(needle), "copy marker injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        needle +
          `\n  writeFileSync(${JSON.stringify(writeMarker)}, destination + "\\n", { flag: "a" });`
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Managed parent must be a real directory/);
    assert.equal(existsSync(writeMarker), false);
    assert.deepEqual(readdirSync(project), ["docs"]);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("existing project guidance is preserved and gitignore entries merge", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    writeFileSync(join(project, "AGENTS.md"), "custom project policy\n");
    writeFileSync(join(project, "CLAUDE.md"), "@AGENTS.md\ncustom adapter\n");
    writeFileSync(join(project, ".gitignore"), "dist/\n");
    writeFileSync(join(project, ".env.example"), "SAFE=value\n");

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "custom project policy\n"
    );
    assert.equal(
      readFileSync(join(project, "CLAUDE.md"), "utf8"),
      "@AGENTS.md\ncustom adapter\n"
    );
    const ignore = readFileSync(join(project, ".gitignore"), "utf8");
    assert.match(ignore, /^dist\/$/m);
    for (const entry of [
      "CLAUDE.local.md",
      ".claude/settings.local.json",
      ".agent-work/",
      ".env",
      ".env.*",
      "!.env.example",
      ".DS_Store",
      "Thumbs.db"
    ]) {
      const escaped = entry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(ignore, new RegExp(`^${escaped}$`, "m"));
    }
    assert.ok(ignore.indexOf(".env\n.env.*\n!.env.example") >= 0);
    assert.equal(gitCheckIgnore(project, ".env.example").status, 1);
    assert.equal(gitCheckIgnore(project, ".env.local").status, 0);
    assert.equal(gitCheckIgnore(project, ".env.production").status, 0);
    assert.match(result.stdout, /Preserved: AGENTS\.md, CLAUDE\.md/);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("ambiguous existing environment ignore policy is preserved for review", () => {
  for (const original of [
    ".env\n!.env.example\n",
    ".env.*\n!.env.example\n"
  ]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      mkdirSync(project);
      const gitResult = spawnSync("git", ["init", "-q"], {
        cwd: project,
        encoding: "utf8",
        shell: false
      });
      assert.equal(gitResult.status, 0, gitResult.stderr);
      writeFileSync(join(project, ".gitignore"), original);

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /environment rules.*manual review/i);
      assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
      assert.equal(existsSync(join(project, "AGENTS.md")), false);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("ineffective env example exception is preserved for review", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    const original = ".env\n.env.*\n!.env.example\n*.example\n";
    writeFileSync(join(project, ".gitignore"), original);

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /environment rules.*manual review/i);
    assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("environment variant exceptions are preserved for review", () => {
  for (const exception of ["!*.production", "!*.development"]) {
    const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
    try {
      const project = join(workspaceRoot, "project-a");
      mkdirSync(project);
      const original = `.env\n.env.*\n!.env.example\n${exception}\n`;
      writeFileSync(join(project, ".gitignore"), original);

      const result = runProjectInitializer(checkoutRoot, project, testRoot);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /environment rules.*manual review/i);
      assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), original);
      assert.equal(existsSync(join(project, "AGENTS.md")), false);
    } finally {
      rmSync(testRoot, { recursive: true, force: true });
    }
  }
});

await test("project rollback preserves a concurrent gitignore and its original backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "          descriptor = openSync(";
    assert.ok(initializer.includes(needle), "rollback injection point must exist");
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "rollback injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "          writeFileSync(basename(gitignorePath), \"concurrent ignore\\n\", { flag: \"wx\" });\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(join(project, ".gitignore"), "utf8"),
      "concurrent ignore\n"
    );
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-") && name.endsWith(".backup")
    );
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(join(project, backups[0]), "utf8"), "dist/\n");
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /original preserved at/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project cleanup preserves a replaced gitignore backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  if (gitignoreBackup) {";
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "backup cleanup injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  const displacedBackup = gitignoreBackup + ".original";\n` +
          `  renameSync(gitignoreBackup, displacedBackup);\n` +
          `  writeFileSync(gitignoreBackup, "concurrent backup\\n");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /backup remains.*changed concurrently/i);
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-")
    );
    assert.equal(backups.length, 2);
    const concurrentBackup = backups.find((name) => !name.endsWith(".original"));
    const originalBackup = backups.find((name) => name.endsWith(".original"));
    assert.equal(readFileSync(join(project, concurrentBackup), "utf8"), "concurrent backup\n");
    assert.equal(readFileSync(join(project, originalBackup), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never restores a replaced gitignore backup", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, ".gitignore"), "dist/\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "          descriptor = openSync(";
    assert.equal(
      initializer.indexOf(needle),
      initializer.lastIndexOf(needle),
      "backup replacement injection point must be unique"
    );
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `          renameSync(gitignoreBackup, gitignoreBackup + ".original");\n` +
          `          writeFileSync(gitignoreBackup, "replacement backup\\n");\n` +
          `          throw new Error("injected backup replacement");\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /backup changed concurrently.*manual recovery/i);
    assert.equal(existsSync(join(project, ".gitignore")), false);
    const backups = readdirSync(project).filter((name) =>
      name.startsWith(".gitignore.machine-bootstrap-")
    );
    assert.equal(backups.length, 2);
    const replacement = backups.find((name) => !name.endsWith(".original"));
    const original = backups.find((name) => name.endsWith(".original"));
    assert.equal(readFileSync(join(project, replacement), "utf8"), "replacement backup\n");
    assert.equal(readFileSync(join(project, original), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates a preserved gitignore", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    const canonicalIgnore = readFileSync(
      join(checkoutRoot, "project-templates", ".gitignore")
    );
    writeFileSync(join(project, ".gitignore"), canonicalIgnore);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  if (!entryExists(gitignorePath)) {";
    assert.ok(initializer.includes(needle), "gitignore injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  renameSync(gitignorePath, gitignorePath + ".original");\n` +
          `  writeFileSync(gitignorePath, "dist/\\n");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /.gitignore changed during initialization/);
    assert.equal(readFileSync(join(project, ".gitignore"), "utf8"), "dist/\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates every seeded file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "seed verification injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  renameSync(join(canonicalTarget, \"AGENTS.md\"), join(canonicalTarget, \"AGENTS.md.original\"));\n" +
          "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent replacement policy\\n\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md changed during initialization/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent replacement policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project initialization revalidates every preserved starter file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    writeFileSync(join(project, "AGENTS.md"), "original project policy\n");

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "preserved verification injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  renameSync(join(canonicalTarget, \"AGENTS.md\"), join(canonicalTarget, \"AGENTS.md.original\"));\n" +
          "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent preserved policy\\n\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AGENTS\.md changed during initialization/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent preserved policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a file changed after ownership review", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    let initializer = readFileSync(initializerPath, "utf8");
    const ownershipNeedle =
      "          if (isOwnedFile(transaction, quarantineLeaf)) {";
    const failureNeedle =
      "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(ownershipNeedle), "ownership injection point must exist");
    assert.ok(initializer.includes(failureNeedle), "failure injection point must exist");
    initializer = initializer.replace(
      ownershipNeedle,
      ownershipNeedle +
        `\n            if (transaction.destination.endsWith("AGENTS.md")) {` +
        ` writeFileSync(quarantineLeaf, "concurrent after review\\n"); }`
    );
    initializer = initializer.replace(
      failureNeedle,
      `  throw new Error("injected rollback failure");\n\n` + failureNeedle
    );
    writeFileSync(initializerPath, initializer);

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    const quarantines = readdirSync(project).filter((name) =>
      name.startsWith("AGENTS.md.rollback-")
    );
    assert.equal(quarantines.length, 1);
    assert.equal(
      readFileSync(join(project, quarantines[0]), "utf8"),
      "concurrent after review\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a concurrently changed starter file", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "late rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  writeFileSync(join(canonicalTarget, \"AGENTS.md\"), \"concurrent user policy\\n\");\n" +
          "  throw new Error(\"injected late failure\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected late failure/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.equal(
      readFileSync(join(project, "AGENTS.md"), "utf8"),
      "concurrent user policy\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback preserves a concurrent starter directory in place", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  const concurrentStarter = join(canonicalTarget, \"AGENTS.md\");\n" +
          "  rmSync(concurrentStarter);\n" +
          "  mkdirSync(concurrentStarter);\n" +
          "  writeFileSync(join(concurrentStarter, \"keep.txt\"), \"keep me\\n\");\n" +
          "  throw new Error(\"injected starter directory replacement\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected starter directory replacement/);
    const starter = join(project, "AGENTS.md");
    assert.equal(lstatSync(starter).isDirectory(), true);
    assert.equal(readFileSync(join(starter, "keep.txt"), "utf8"), "keep me\n");
    assert.equal(
      readdirSync(project).some((name) => name.startsWith("AGENTS.md.rollback-")),
      false
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never dereferences a concurrent starter symlink", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    const externalTarget = join(testRoot, "external-private.txt");
    mkdirSync(project);
    writeFileSync(externalTarget, "external private bytes\n");
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "symlink rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        `  const concurrentStarter = join(canonicalTarget, "AGENTS.md");\n` +
          `  const linkResult = spawnSync(process.execPath, [\n` +
          `    "-e",\n` +
          `    "const { symlinkSync, unlinkSync } = require('node:fs'); " +\n` +
          `      "unlinkSync(process.argv[1]); symlinkSync(process.argv[2], process.argv[1]);",\n` +
          `    concurrentStarter,\n` +
          `    ${JSON.stringify(externalTarget)}\n` +
          `  ], { encoding: "utf8", shell: false });\n` +
          `  if (linkResult.status !== 0) throw new Error(linkResult.stderr);\n` +
          `  throw new Error("injected symlink replacement");\n\n` +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected symlink replacement/);
    const restoredStarter = join(project, "AGENTS.md");
    assert.equal(lstatSync(restoredStarter).isSymbolicLink(), true);
    assert.equal(readlinkSync(restoredStarter), externalTarget);
    assert.equal(readFileSync(externalTarget, "utf8"), "external private bytes\n");
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
}, { needsSymlinks: true });

await test("project rollback preserves a concurrently replaced empty directory", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory rollback injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  const concurrentDirectory = join(canonicalTarget, \"docs\", \"engineering\");\n" +
          "  renameSync(concurrentDirectory, `${concurrentDirectory}.concurrent-original`);\n" +
          "  mkdirSync(concurrentDirectory);\n" +
          "  throw new Error(\"injected directory replacement\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected directory replacement/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /docs.*engineering.*not removed.*manually/i);
    assert.equal(existsSync(join(project, "docs", "engineering")), true);
    assert.equal(
      existsSync(join(project, "docs", "engineering.concurrent-original")),
      true
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback reports a run-created directory with concurrent content", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    assert.equal(
      spawnSync("git", ["init", "-q"], { cwd: project, encoding: "utf8" }).status,
      0
    );

    const initializerPath = join(checkoutRoot, "scripts", "init-project.mjs");
    const initializer = readFileSync(initializerPath, "utf8");
    const needle = "  const placeholderFiles = [...seedFiles, \".gitignore\"];";
    assert.ok(initializer.includes(needle), "directory content injection point must exist");
    writeFileSync(
      initializerPath,
      initializer.replace(
        needle,
        "  writeFileSync(join(canonicalTarget, \".github\", \"concurrent.txt\"), \"keep me\\n\");\n" +
          "  throw new Error(\"injected concurrent directory content\");\n\n" +
          needle
      )
    );

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /injected concurrent directory content/);
    assert.match(result.stderr, /Rollback requires attention:/);
    assert.match(result.stderr, /\.github.*not removed.*manually/i);
    assert.equal(
      readFileSync(join(project, ".github", "concurrent.txt"), "utf8"),
      "keep me\n"
    );
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project rollback never deletes directories by pathname", () => {
  const initializer = readFileSync(
    join(bootstrapRoot, "scripts", "init-project.mjs"),
    "utf8"
  );
  assert.doesNotMatch(initializer, /\brmdirSync\b/);
  assert.doesNotMatch(initializer, /unlinkSync\(quarantineLeaf\)/);
  assert.match(initializer, /review directory cleanup manually/);
  assert.match(initializer, /review target cleanup manually/);
  assert.match(initializer, /run-owned entry preserved at/);
});

await test("project initialization rejects a Git-owned workspace", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const project = join(workspaceRoot, "project-a");
    mkdirSync(project);
    for (const root of [project, workspaceRoot]) {
      const gitResult = spawnSync("git", ["init", "-q"], {
        cwd: root,
        encoding: "utf8",
        shell: false
      });
      assert.equal(gitResult.status, 0, gitResult.stderr);
    }

    const result = runProjectInitializer(checkoutRoot, project, testRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Workspace root must stay outside Git/);
    assert.equal(existsSync(join(project, "AGENTS.md")), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});

await test("project target boundaries reject unsafe or ambiguous roots", () => {
  const { testRoot, workspaceRoot, checkoutRoot } = createTestWorkspace();
  try {
    const outside = join(testRoot, "outside");
    mkdirSync(outside);
    const outsideResult = runProjectInitializer(checkoutRoot, outside, testRoot);
    assert.notEqual(outsideResult.status, 0);
    assert.match(outsideResult.stderr, /inside the workspace/);

    const bootstrapResult = runProjectInitializer(checkoutRoot, checkoutRoot, testRoot);
    assert.notEqual(bootstrapResult.status, 0);
    assert.match(bootstrapResult.stderr, /cannot be machine-bootstrap/);

    const project = join(workspaceRoot, "project-a");
    const nested = join(project, "nested");
    mkdirSync(nested, { recursive: true });
    const gitResult = spawnSync("git", ["init", "-q"], {
      cwd: project,
      encoding: "utf8",
      shell: false
    });
    assert.equal(gitResult.status, 0, gitResult.stderr);
    const nestedResult = runProjectInitializer(checkoutRoot, nested, testRoot);
    assert.notEqual(nestedResult.status, 0);
    assert.match(nestedResult.stderr, /must be its Git root/);
    assert.equal(existsSync(join(nested, "AGENTS.md")), false);

    const missingNested = join(project, "new-nested");
    const missingNestedResult = runProjectInitializer(
      checkoutRoot,
      missingNested,
      testRoot,
      ["--create"]
    );
    assert.notEqual(missingNestedResult.status, 0);
    assert.match(
      missingNestedResult.stderr,
      /cannot be created inside existing Git repository/
    );
    assert.equal(existsSync(missingNested), false);
  } finally {
    rmSync(testRoot, { recursive: true, force: true });
  }
});
