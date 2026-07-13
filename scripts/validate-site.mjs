#!/usr/bin/env node

import { countSourceFiles, validateSite } from "./lib/site-validation.mjs";

const rootDirectory = process.cwd();
const issues = await validateSite(rootDirectory);
const checkedFileCount = countSourceFiles(rootDirectory);
const sourceFileLabel = `source file${checkedFileCount === 1 ? "" : "s"}`;

for (const { code, file, message } of issues) {
  console.error(`${code} ${file}: ${message}`);
}

if (issues.length > 0) {
  console.error(`Site validation failed: ${checkedFileCount} ${sourceFileLabel} checked, ${issues.length} issue${issues.length === 1 ? "" : "s"}.`);
  process.exitCode = 1;
} else {
  console.log(`Site validation passed: ${checkedFileCount} ${sourceFileLabel} checked, 0 issues.`);
}
