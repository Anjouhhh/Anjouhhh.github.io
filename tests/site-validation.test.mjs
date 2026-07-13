import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { countSourceFiles, validateSite } from "../scripts/lib/site-validation.mjs";

const execFileAsync = promisify(execFile);
const fixtures = [];
const validateSiteCli = fileURLToPath(new URL("../scripts/validate-site.mjs", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

test.after(async () => {
  await Promise.all(fixtures.map((directory) => rm(directory, { force: true, recursive: true })));
});

async function createFixture(files) {
  const directory = await mkdtemp(path.join(tmpdir(), "site-validation-"));
  fixtures.push(directory);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(directory, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return directory;
}

function page({ head = "", htmlAttributes = 'lang="en"', body = "" } = {}) {
  return `<!doctype html>
<html ${htmlAttributes}>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
  ${head}
</head>
<body>
  <main><h1>Fixture heading</h1>${body}</main>
</body>
</html>`;
}

function issueCodes(issues) {
  return issues.map(({ code }) => code);
}

function assertOnlyIssueCodes(issues, expectedCodes) {
  assert.deepEqual(issueCodes(issues).sort(), [...expectedCodes].sort());
}

async function validateFiles(files) {
  const directory = await createFixture(files);
  return await validateSite(directory);
}

async function createSymlinkOrSkip(testContext, target, linkPath) {
  try {
    await symlink(target, linkPath, "file");
  } catch (error) {
    if (error?.code === "EPERM" || error?.code === "EACCES") {
      testContext.skip(`Symlink creation is not permitted on this platform: ${error.code}`);
      return false;
    }
    throw error;
  }
  return true;
}

test("repository root entry links to the real home route", async () => {
  const rootHtml = await readFile(path.join(repositoryRoot, "index.html"), "utf8");

  assert.match(rootHtml, /<a\b[^>]*\bhref\s*=\s*["']\.\/home\.html["'][^>]*>/i);
});

test("repository root entry has no hardcoded production navigation target", async () => {
  const rootHtml = await readFile(path.join(repositoryRoot, "index.html"), "utf8");

  assert.doesNotMatch(rootHtml, /https:\/\/anjouhhh\.github\.io\//i);
});

test("entry transition resets when a page is restored from bfcache", async () => {
  const entrySource = await readFile(path.join(repositoryRoot, "assets/js/entry.js"), "utf8");

  assert.match(entrySource, /let\s+navigationTimeout\s*=\s*null\s*;/);
  assert.match(entrySource, /if\s*\(\s*entering\s*\)\s*return\s*;[\s\S]*?entering\s*=\s*true\s*;/);
  assert.match(entrySource, /function\s+resetEntryTransition\s*\(\)\s*{[\s\S]*?entering\s*=\s*false\s*;/);
  assert.match(entrySource, /clearTimeout\s*\(\s*navigationTimeout\s*\)/);
  assert.match(entrySource, /navigationTimeout\s*=\s*null\s*;/);
  assert.match(entrySource, /cancelAnimationFrame\s*\(\s*pointerFrame\s*\)/);
  assert.match(entrySource, /pointerFrame\s*=\s*null\s*;/);
  assert.match(entrySource, /body\.classList\.remove\s*\(\s*["']is-entering["']\s*\)/);
  assert.match(entrySource, /door\.classList\.remove\s*\(\s*["']is-entering["']\s*\)/);
  assert.match(entrySource, /door\.removeAttribute\s*\(\s*["']aria-disabled["']\s*\)/);
  assert.match(entrySource, /status\.textContent\s*=\s*["']["']\s*;/);
  assert.match(entrySource, /function\s+handlePageShow\s*\(\s*event\s*\)\s*{[\s\S]*?event\.persisted[\s\S]*?resetEntryTransition\s*\(\s*\)\s*;/);
  assert.match(entrySource, /window\.addEventListener\s*\(\s*["']pageshow["']\s*,\s*handlePageShow\s*\)/);
});

test("repository home route exists and identifies the home page", async () => {
  const homePath = path.join(repositoryRoot, "home.html");

  assert.equal(existsSync(homePath), true, "home.html must exist");
  assert.match(await readFile(homePath, "utf8"), /<body\b[^>]*\bdata-page\s*=\s*["']home["'][^>]*>/i);
});

const internalPages = ["home.html", "about.html", "writing.html", "projects.html", "now.html", "post.html", "project.html"];
const repositoryPages = ["index.html", ...internalPages];

function stylesheetPosition(html, href) {
  return html.search(new RegExp(`<link\\b(?=[^>]*\\brel=["']stylesheet["'])(?=[^>]*\\bhref=["'](?:\\./)?${href.replaceAll("/", "\\/")}["'])[^>]*>`, "i"));
}

test("repository root loads shared tokens before entry styles", async () => {
  const html = await readFile(path.join(repositoryRoot, "index.html"), "utf8");
  const tokensPosition = stylesheetPosition(html, "assets/css/tokens.css");
  const entryPosition = stylesheetPosition(html, "assets/css/entry.css");

  assert.notEqual(tokensPosition, -1, "index.html must load assets/css/tokens.css");
  assert.notEqual(entryPosition, -1, "index.html must load assets/css/entry.css");
  assert.ok(tokensPosition < entryPosition, "index.html must load tokens.css before entry.css");
});

test("repository internal pages load shared tokens before site styles", async () => {
  for (const file of internalPages) {
    const html = await readFile(path.join(repositoryRoot, file), "utf8");
    const tokensPosition = stylesheetPosition(html, "assets/css/tokens.css");
    const sitePosition = stylesheetPosition(html, "assets/css/site.css");

    assert.notEqual(tokensPosition, -1, `${file} must load assets/css/tokens.css`);
    assert.notEqual(sitePosition, -1, `${file} must load assets/css/site.css`);
    assert.ok(tokensPosition < sitePosition, `${file} must load tokens.css before site.css`);
  }
});

test("custom cursor visuals require a fine pointer and no reduced-motion preference", async () => {
  const css = await readFile(path.join(repositoryRoot, "assets/css/site.css"), "utf8");
  const customCursorSection = css.slice(css.indexOf("/* ── Custom Cursor"));

  assert.match(
    customCursorSection,
    /^\/\*[^]*?\*\/\s*@media\s*\(\s*pointer\s*:\s*fine\s*\)\s*and\s*\(\s*prefers-reduced-motion\s*:\s*no-preference\s*\)\s*\{[^]*cursor\s*:\s*none\s*!important[^]*\.custom-cursor-core\s*\{[^]*\.custom-cursor-trail\s*\{/i
  );
  assert.doesNotMatch(customCursorSection, /@media\s*\(\s*pointer\s*:\s*fine\s*\)\s*\{/i);
});

test("repository HTML no longer references the legacy stylesheet", async () => {
  for (const file of repositoryPages) {
    const html = await readFile(path.join(repositoryRoot, file), "utf8");
    assert.doesNotMatch(html, /(?:\.\/)?assets\/css\/styles\.css/i, file);
  }
});

test("repository removes the legacy stylesheet after migration", () => {
  assert.equal(existsSync(path.join(repositoryRoot, "assets/css/styles.css")), false);
});

test("repository site-shell navigation points Home links to the real home route", async () => {
  for (const file of internalPages) {
    const html = await readFile(path.join(repositoryRoot, file), "utf8");
    const nav = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? "";
    assert.match(nav, /<a\b[^>]*href=["'](?:\.\/)?home\.html(?:[?#][^"']*)?["'][^>]*>\s*Home\s*<\/a>/i, file);
    assert.doesNotMatch(nav, /<a\b[^>]*href=["'](?:\.\/)?index\.html(?:[?#][^"']*)?["'][^>]*>\s*Home\s*<\/a>/i, file);
  }
});

test("repository internal-page brand links point to the real home route", async () => {
  for (const file of internalPages) {
    const html = await readFile(path.join(repositoryRoot, file), "utf8");
    assert.match(html, /<a\b(?=[^>]*\bclass=["'][^"']*\bbrand\b[^"']*["'])(?=[^>]*\bhref=["'](?:\.\/)?home\.html["'])[^>]*>/i, file);
    assert.doesNotMatch(html, /<a\b(?=[^>]*\bclass=["'][^"']*\bbrand\b[^"']*["'])(?=[^>]*\bhref=["'](?:\.\/)?index\.html["'])[^>]*>/i, file);
  }
});

test("repository passes the complete site validator", async () => {
  assert.deepEqual(await validateSite(repositoryRoot), []);
});

test("validateSite returns a Promise", async () => {
  const directory = await createFixture({ "index.html": page() });
  const validation = validateSite(directory);

  assert.equal(typeof validation?.then, "function");
  assert.deepEqual(await validation, []);
});

test("accepts a valid minimal static site recursively", async () => {
  const issues = await validateFiles({
    "index.html": page({
      head: '<link rel="stylesheet" href="./assets/site.css">',
      body: '<a href="./home.html?from=entry#top">Enter</a><script type="module" src="./assets/main.js"></script>'
    }),
    "home.html": page({ body: '<a href="home.html">Home</a><img src="assets/photo.svg" alt="">' }),
    "assets/site.css": "body { color: #123; }",
    "assets/main.js": 'import { value } from "./nested/value.mjs";\nconsole.log(value);',
    "assets/nested/value.mjs": "export const value = 1;",
    "assets/photo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    "notes/readme.md": "# Valid UTF-8: café\n"
  });

  assert.deepEqual(issues, []);
});

test("reports invalid UTF-8", async () => {
  const issues = await validateFiles({ "notes.md": Buffer.from([0xc3, 0x28]) });

  assert.ok(issueCodes(issues).includes("invalid-utf8"));
});

test("reports a missing local href target", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="missing.html?source=test#section">Missing</a>' })
  });

  assert.ok(issueCodes(issues).includes("missing-reference"));
});

test("reports a missing static ES module import", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/main.mjs": 'import "./missing-module.js";'
  });

  assertOnlyIssueCodes(issues, ["missing-module-import"]);
});

test("rejects an HTML reference whose case differs from the filesystem entry", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="About.html">About</a>' }),
    "about.html": page()
  });

  assertOnlyIssueCodes(issues, ["missing-reference"]);
});

test("rejects a module import whose case differs from the filesystem entry", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/main.mjs": 'import "./Feature.js";',
    "assets/feature.js": "export const feature = true;"
  });

  assertOnlyIssueCodes(issues, ["missing-module-import"]);
});

test("rejects an HTML reference outside the site root even when the target exists", async () => {
  const directory = await createFixture({
    "outside.html": page(),
    "site/index.html": page({ body: '<a href="../outside.html">Outside</a>' })
  });

  const issues = await validateSite(path.join(directory, "site"));

  assertOnlyIssueCodes(issues, ["missing-reference"]);
});

test("rejects percent-decoded HTML traversal outside the site root", async () => {
  const directory = await createFixture({
    "outside.html": page(),
    "site/index.html": page({ body: '<a href="%2e%2e/outside.html">Outside</a>' })
  });

  const issues = await validateSite(path.join(directory, "site"));

  assertOnlyIssueCodes(issues, ["missing-reference"]);
});

test("rejects an in-root HTML symlink that resolves outside the site root", async (testContext) => {
  const directory = await createFixture({
    "outside.html": page(),
    "site/index.html": page({ body: '<a href="outside-link.html">Outside</a>' })
  });
  const linked = await createSymlinkOrSkip(
    testContext,
    path.join(directory, "outside.html"),
    path.join(directory, "site", "outside-link.html")
  );
  if (!linked) return;

  const issues = await validateSite(path.join(directory, "site"));

  assertOnlyIssueCodes(issues, ["missing-reference"]);
});

test("rejects a module import outside the site root even when the target exists", async () => {
  const directory = await createFixture({
    "outside.js": "export const outside = true;",
    "site/index.html": page(),
    "site/assets/main.mjs": 'import "../../outside.js";'
  });

  const issues = await validateSite(path.join(directory, "site"));

  assertOnlyIssueCodes(issues, ["missing-module-import"]);
});

test("rejects an in-root module symlink that resolves outside the site root", async (testContext) => {
  const directory = await createFixture({
    "outside.js": "export const outside = true;",
    "site/index.html": page(),
    "site/assets/main.mjs": 'import "./outside-link.js";'
  });
  const linked = await createSymlinkOrSkip(
    testContext,
    path.join(directory, "outside.js"),
    path.join(directory, "site", "assets", "outside-link.js")
  );
  if (!linked) return;

  const issues = await validateSite(path.join(directory, "site"));

  assertOnlyIssueCodes(issues, ["missing-module-import"]);
});

test("reports missing modules in multiline import and export declarations", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/main.mjs": [
      "import {",
      "  importedValue",
      '} from "./missing-import.js";',
      "export {",
      "  exportedValue",
      '} from "./missing-export.js";'
    ].join("\n")
  });

  assert.equal(issueCodes(issues).filter((code) => code === "missing-module-import").length, 2);
});

test("reports a missing title", async () => {
  const issues = await validateFiles({ "index.html": page().replace("<title>Fixture page</title>", "") });

  assert.ok(issueCodes(issues).includes("missing-title"));
});

test("reports a missing meta description", async () => {
  const issues = await validateFiles({
    "index.html": page().replace('  <meta name="description" content="Fixture page description.">\n', "")
  });

  assert.ok(issueCodes(issues).includes("missing-description"));
});

test("reports a missing viewport", async () => {
  const issues = await validateFiles({
    "index.html": page().replace('  <meta name="viewport" content="width=device-width, initial-scale=1">\n', "")
  });

  assert.ok(issueCodes(issues).includes("missing-viewport"));
});

test("reports a missing html lang", async () => {
  const issues = await validateFiles({ "index.html": page({ htmlAttributes: "" }) });

  assert.ok(issueCodes(issues).includes("missing-lang"));
});

test("reports a missing main landmark", async () => {
  const issues = await validateFiles({
    "index.html": page().replace("<main><h1>Fixture heading</h1>", "<h1>Fixture heading</h1>").replace("</main>", "")
  });

  assert.ok(issueCodes(issues).includes("missing-main"));
});

test("reports a missing h1", async () => {
  const issues = await validateFiles({
    "index.html": page().replace("<h1>Fixture heading</h1>", "")
  });

  assert.ok(issueCodes(issues).includes("missing-h1"));
});

test("does not satisfy page contracts with markup inside HTML comments", async () => {
  const issues = await validateFiles({
    "index.html": `<!--
      <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width">
        <meta name="description" content="Commented out">
        <title>Commented out</title>
      </head>
      <body><main><h1>Commented out</h1></main></body>
    -->`
  });

  assertOnlyIssueCodes(issues, [
    "missing-title",
    "missing-description",
    "missing-viewport",
    "missing-lang",
    "missing-main",
    "missing-h1"
  ]);
});

test("ignores fake markup in HTML comments after ordinary text", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
</head>
<body>
  Ordinary text <!-- <main><h1>Not real</h1><img src="missing-comment.png"></main> -->
</body>
</html>`
  });

  assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
});

test("does not satisfy page contracts with fake markup in raw-text elements", async () => {
  const rawMarkup = '<main><h1>Not real</h1><img src="missing.png">';
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
  <style>.example::after { content: '${rawMarkup}'; }</style>
  <template>${rawMarkup}</template>
  <noscript>${rawMarkup}</noscript>
</head>
<body>
  <script>const example = '${rawMarkup}';</script>
</body>
</html>`
  });

  assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
});

test("ignores fake markup after unclosed raw-text opening tags", async (testContext) => {
  for (const tagName of ["script", "style", "noscript"]) {
    await testContext.test(tagName, async () => {
      const issues = await validateFiles({
        "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
</head>
<body>
  <${tagName}>Fake markup: <main><h1>Not real</h1><img src="missing-inert.png">
</body>
</html>`
      });

      assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
    });
  }
});

test("recognizes a raw-text closing tag after unclosed comment-like text", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
  <script><!-- unclosed comment-like text</script>
</head>
<body><main><h1>Fixture heading</h1></main></body>
</html>`
  });

  assert.deepEqual(issues, []);
});

test("recognizes a raw-text closing tag after a JavaScript less-than operator", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
  <script>const comparison = 1 < 2;</script>
</head>
<body><main><h1>Fixture heading</h1></main></body>
</html>`
  });

  assert.deepEqual(issues, []);
});

test("ignores all content inside nested templates", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
</head>
<body>
  <template>
    <template><img src="missing-inner.png"></template>
    <main><h1>Not real</h1><img src="missing-outer.png"></main>
  </template>
</body>
</html>`
  });

  assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
});

test("does not count template tags inside template comments", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
</head>
<body>
  <template>ordinary text <!-- <template> --></template>
  <main><h1>Fixture heading</h1></main>
</body>
</html>`
  });

  assert.deepEqual(issues, []);
});

test("does not close a template for closing-tag text inside a nested raw-text element", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
</head>
<body>
  <template>
    <script>const example = '</template>';</script>
    <main><h1>Not real</h1><img src="missing-outer.png"></main>
  </template>
</body>
</html>`
  });

  assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
});

test("scans a raw-text opening tag attribute but ignores its contents", async () => {
  const issues = await validateFiles({
    "index.html": page({
      body: `<script src="missing-entry.js">
        const fakeImage = '<img src="missing-inert.png">';
      </script>`
    })
  });

  assertOnlyIssueCodes(issues, ["missing-reference"]);
  assert.match(issues[0].message, /missing-entry\.js/);
});

test("ignores fake contracts and references in legacy raw-text and RCDATA elements", async (testContext) => {
  for (const tagName of ["textarea", "iframe", "noembed", "noframes", "xmp"]) {
    await testContext.test(tagName, async () => {
      const issues = await validateFiles({
        "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page</title>
</head>
<body>
  <${tagName}><main><h1>Not real</h1><img src="missing-inert.png"></${tagName}>
</body>
</html>`
      });

      assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
    });
  }
});

test("validates real title text without scanning title contents as markup", async () => {
  const issues = await validateFiles({
    "index.html": `<!doctype html>
<html lang="en">
<head>
  <meta name="viewport" content="width=device-width">
  <meta name="description" content="Fixture page description.">
  <title>Fixture page <img src="missing-title.png"><main><h1>Not real</h1></title>
</head>
<body><main><h1>Fixture heading</h1></main></body>
</html>`
  });

  assert.deepEqual(issues, []);
});

test("does not satisfy the title contract with a fake title inside textarea", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: "<textarea><title>Not real</title></textarea>" }).replace("<title>Fixture page</title>", "")
  });

  assertOnlyIssueCodes(issues, ["missing-title"]);
});

test("treats script slash syntax as an open non-void element", async () => {
  const issues = await validateFiles({
    "index.html": page().replace(
      "<main><h1>Fixture heading</h1>",
      '<script/>Fake markup: <main><h1>Not real</h1><img src="missing-inert.png">'
    )
  });

  assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
});

test("treats template slash syntax as an open non-void element", async () => {
  const issues = await validateFiles({
    "index.html": page().replace(
      "<main><h1>Fixture heading</h1>",
      '<template/><main><h1>Not real</h1><img src="missing-inert.png"></template>'
    )
  });

  assertOnlyIssueCodes(issues, ["missing-main", "missing-h1"]);
});

test("reports more than one real main landmark", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: "<main><p>Second landmark</p></main>" })
  });

  assertOnlyIssueCodes(issues, ["multiple-main"]);
});

test("reports a root entry link that loops to index", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="./index.html">Enter</a>' })
  });

  assert.ok(issueCodes(issues).includes("entry-loop"));
});

test("reports a production-root entry link that loops to index", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="https://anjouhhh.github.io/">Enter</a>' })
  });

  assert.ok(issueCodes(issues).includes("entry-loop"));
});

test("reports a protocol-relative production-root entry link", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="//anjouhhh.github.io/">Enter</a>' })
  });

  assertOnlyIssueCodes(issues, ["entry-loop"]);
});

test("reports a query-only root entry link", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="?entry=1">Enter</a>' })
  });

  assertOnlyIssueCodes(issues, ["entry-loop"]);
});

test("does not report an external protocol-relative entry link", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="//example.com/">External</a>' })
  });

  assert.deepEqual(issues, []);
});

test("accepts an absolute-path home entry link", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="/home.html">Enter</a>' }),
    "home.html": page({ body: '<a href="home.html">Home</a>' })
  });

  assert.deepEqual(issues, []);
});

test("requires internal Home links to use home.html", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="home.html">Enter</a>' }),
    "home.html": page({ body: '<a href="home.html">Home</a><a href="about.html">About</a>' }),
    "about.html": page({ body: '<a href="index.html">Home</a>' })
  });

  assert.ok(issueCodes(issues).includes("home-route"));
});

test("accepts a same-origin absolute URL for an internal Home link", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="home.html">Enter</a>' }),
    "home.html": page({ body: '<a href="home.html">Home</a>' }),
    "about.html": page({ body: '<a href="https://anjouhhh.github.io/home.html">Home</a>' })
  });

  assert.deepEqual(issues, []);
});

test("skips external anchors labelled Home when enforcing internal Home routes", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: '<a href="home.html">Enter</a>' }),
    "home.html": page({ body: '<a href="home.html">Home</a>' }),
    "about.html": page({ body: '<a href="https://example.com/">Home</a>' })
  });

  assert.deepEqual(issues, []);
});

test("reports a visible Unicode replacement character", async () => {
  const issues = await validateFiles({
    "index.html": page({ body: `<p>Broken ${String.fromCodePoint(0xfffd)} text</p>` })
  });

  assert.ok(issueCodes(issues).includes("replacement-character"));
});

test("reports duplicate slugs in data modules", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/data/posts.js": `export const posts = [
      { slug: "repeated", title: "First" },
      { title: "Second", slug: 'repeated' }
    ];`
  });

  assertOnlyIssueCodes(issues, ["duplicate-slug"]);
});

test("ignores static module imports inside line and block comments", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/main.mjs": `
      // import "./missing-line-comment.js";
      /*
      export { example } from "./missing-block-comment.js";
      */
      export const active = true;
    `
  });

  assert.deepEqual(issues, []);
});

test("ignores import-looking text inside multiline template strings", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/main.mjs": `const example = \`
      export { example } from "./missing-template-example.js";
    \`;
    export const active = true;`
  });

  assert.deepEqual(issues, []);
});

test("ignores duplicate slugs inside line and block comments", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/data/posts.js": `export const posts = [
      { slug: "unique", title: "Real" },
      // { slug: "unique", title: "Line comment" },
      /* { slug: "unique", title: "Block comment" } */
    ];`
  });

  assert.deepEqual(issues, []);
});

test("ignores slug examples inside JavaScript strings and template literals", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/data/posts.js": `
      const doubleQuotedExample = '{ slug: "real-slug" }';
      const singleQuotedExample = "{ 'slug': 'real-slug' }";
      const templateExample = \`[
        { slug: "real-slug" },
        { "slug": "real-slug" }
      ]\`;
      export const posts = [{ slug: "real-slug", title: "Real" }];
    `
  });

  assert.deepEqual(issues, []);
});

test("reports duplicate slugs with quoted property names", async () => {
  const issues = await validateFiles({
    "index.html": page(),
    "assets/data/posts.js": `export const posts = [
      { "slug": "repeated", title: "First" },
      { 'slug': "repeated", title: "Second" }
    ];`
  });

  assertOnlyIssueCodes(issues, ["duplicate-slug"]);
});

test("excludes standard non-source directories from recursive scans", async () => {
  const files = { "index.html": page() };
  for (const directory of [".git", "node_modules", "coverage", "dist", "build", ".worktrees"]) {
    files[`${directory}/invalid.html`] = "<main>invalid fixture</main>";
    files[`${directory}/data/duplicates.js`] = `[
      { slug: "ignored" },
      { slug: "ignored" }
    ]`;
  }
  const directory = await createFixture(files);

  assert.equal(countSourceFiles(directory), 1);
  assert.deepEqual(await validateSite(directory), []);
});

test("CLI summary reports how many source files were checked", async () => {
  const directory = await createFixture({
    "index.html": page(),
    "assets/site.css": "body { color: #123; }",
    "notes/readme.md": "# Notes\n",
    "assets/ignored.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
  });

  const { stdout, stderr } = await execFileAsync(process.execPath, [validateSiteCli], { cwd: directory });

  assert.equal(stderr, "");
  assert.match(stdout, /3 source files checked/);
});

test("CLI exits with failure and prints the issue and summary", async () => {
  const directory = await createFixture({
    "index.html": page().replace("<title>Fixture page</title>", "")
  });

  await assert.rejects(
    execFileAsync(process.execPath, [validateSiteCli], { cwd: directory }),
    (error) => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, "");
      assert.match(error.stderr, /missing-title index\.html: Page must have a non-empty title\./);
      assert.match(error.stderr, /Site validation failed: 1 source file checked, 1 issue\./);
      return true;
    }
  );
});
