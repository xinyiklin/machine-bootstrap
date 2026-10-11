#!/usr/bin/env node

// Disposable regression suite for every bootstrap layer. The layers run in
// order from scripts/test/ and share one harness; each file registers its
// tests at import time, and the harness prints the summary and sets the exit
// code. Run from the repository root: node scripts/test-bootstrap.mjs
import { reportResults } from "./test/harness.mjs";

for (const layer of ["skills", "guidance", "workspace", "project", "workflows"]) {
  await import(`./test/${layer}.test.mjs`);
}

reportResults();
