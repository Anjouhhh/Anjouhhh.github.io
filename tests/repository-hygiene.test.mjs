import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const pythonArtifactPattern = /(?:^|\/)__pycache__(?:\/|$)|\.py[cod]$/i;

async function findPythonArtifacts(directory, relativeDirectory = "") {
  const artifacts = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (pythonArtifactPattern.test(relativePath)) artifacts.push(relativePath);
    if (entry.isDirectory()) {
      artifacts.push(...await findPythonArtifacts(path.join(directory, entry.name), relativePath));
    }
  }
  return artifacts;
}

test("repository excludes Python test bytecode artifacts", async () => {
  const [gitignore, filesystemArtifacts, trackedFiles] = await Promise.all([
    readFile(path.join(repositoryRoot, ".gitignore"), "utf8").catch(() => ""),
    findPythonArtifacts(repositoryRoot),
    execFileAsync("git", ["ls-files"], { cwd: repositoryRoot }).then(({ stdout }) => stdout.split(/\r?\n/).filter(Boolean))
  ]);
  const ignoreLines = gitignore.split(/\r?\n/).filter(Boolean);
  const trackedArtifacts = trackedFiles.filter((file) => pythonArtifactPattern.test(file));

  assert.deepEqual(ignoreLines, ["__pycache__/", "*.py[cod]"]);
  assert.deepEqual(filesystemArtifacts, []);
  assert.deepEqual(trackedArtifacts, []);
});
