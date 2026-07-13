# Entry Page Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the accepted orbital entry scene at the repository root, preserve the current homepage at `home.html`, and modularize the zero-build GitHub Pages site with automated validation.

**Architecture:** Keep native static HTML/CSS/ES modules. Separate shared design tokens, internal-site styles, entry-scene styles, pure DOM helpers, and page-shell behavior. Use a real `home.html` link for no-JavaScript navigation and add Node/Playwright verification without production dependencies.

**Tech Stack:** HTML5, modern CSS, SVG, native ES modules, Node.js built-in test runner, Python Playwright, GitHub Pages.

---

## File Map

**Create**
- `home.html` — existing homepage at its new route.
- `assets/css/tokens.css` — shared design tokens.
- `assets/css/site.css` — internal blog presentation.
- `assets/css/entry.css` — entry scene presentation.
- `assets/js/core/dom.js` — pure escaping helper.
- `assets/js/core/site-shell.js` — shared shell behavior.
- `assets/js/entry.js` — entry scene behavior.
- `scripts/lib/site-validation.mjs` — static validation library.
- `scripts/validate-site.mjs` — validation CLI.
- `tests/site-validation.test.mjs` — validation tests.
- `tests/dom.test.mjs` — DOM helper tests.
- `tests/browser-smoke.py` — browser smoke checks.
- `docs/architecture/entry-page-integration.md` — accepted architecture record.

**Modify**
- `index.html` — replace old homepage with semantic entry scene.
- `about.html`, `writing.html`, `projects.html`, `now.html`, `post.html`, `project.html` — route and stylesheet updates.
- `assets/js/site.js` — compatibility re-export/boot entry or removal after import migration.
- `assets/js/cursor.js` — reduced-motion and lifecycle guard.
- `assets/js/pages/*.js` — import `escapeHtml` from `core/dom.js` and escape non-copy fields.
- `README.md` — architecture, editing, preview, and validation instructions.

**Remove**
- `assets/css/styles.css` after all internal pages use `tokens.css` and `site.css`.

---

### Task 1: Build the Static Validation Harness

**Files:**
- Create: `tests/site-validation.test.mjs`
- Create: `scripts/lib/site-validation.mjs`
- Create: `scripts/validate-site.mjs`

- [ ] **Step 1: Write failing tests for UTF-8 and local references**

Use Node's built-in `node:test` with temporary fixtures. The tests must assert that `validateSite(root)` reports an invalid UTF-8 file, a missing local `href`, and a missing ES module import, while a valid minimal site returns no issues.

The public interface is:

```js
export async function validateSite(rootDirectory) {
  return /** @type {{code: string, file: string, message: string}[]} */ ([]);
}
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/site-validation.test.mjs
```

Expected: FAIL because `scripts/lib/site-validation.mjs` does not exist.

- [ ] **Step 3: Implement the minimal validator**

Implement recursive source discovery for `.html`, `.css`, `.js`, `.mjs`, and `.md`; fatal UTF-8 decoding with `TextDecoder`; HTML `href`/`src` extraction; and ES module import extraction. Ignore remote URLs, fragment-only links, `mailto:`, `tel:`, `data:`, and query/hash suffixes when checking files.

- [ ] **Step 4: Add site-contract tests**

Add fixture assertions for:

```text
missing-title
missing-description
missing-viewport
missing-lang
missing-main
missing-h1
entry-loop
home-route
replacement-character
duplicate-slug
```

- [ ] **Step 5: Implement contract checks and CLI**

`scripts/validate-site.mjs` must call `validateSite(process.cwd())`, print one line per issue, print a checked-file summary, and exit `1` on issues or `0` when clean.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --test tests/site-validation.test.mjs
node scripts/validate-site.mjs
```

Expected: tests PASS; repository validation FAILS only for known pre-integration contract violations such as root routing/metadata, proving the validator observes the current state.

---

### Task 2: Integrate the Entry Route With Progressive Enhancement

**Files:**
- Create: `home.html`
- Modify: `index.html`
- Create: `assets/css/entry.css`
- Create: `assets/js/entry.js`
- Test: `tests/site-validation.test.mjs`

- [ ] **Step 1: Add repository-level route assertions**

Add tests that read the real repository and require:

```js
assert.match(indexHtml, /href=["']\.\/home\.html["']/);
assert.doesNotMatch(indexHtml, /https:\/\/anjouhhh\.github\.io\/?["']/);
assert.match(homeHtml, /data-page=["']home["']/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/site-validation.test.mjs
```

Expected: FAIL because `home.html` does not exist and root `index.html` is still the homepage.

- [ ] **Step 3: Preserve the homepage**

Copy the current root homepage to `home.html`, preserving its content before replacing `index.html`.

- [ ] **Step 4: Convert and split the accepted entry source**

Use `C:/Users/ZhaoA/.local/bin/self_blog/index.html` as the accepted source. Decode its current Windows-1252 bytes and write all output as UTF-8. Move the `<style>` content into `assets/css/entry.css` and the behavior from the inline `<script>` into `assets/js/entry.js`.

`index.html` must load:

```html
<link rel="stylesheet" href="assets/css/entry.css">
<script type="module" src="assets/js/entry.js"></script>
```

Replace the button-only door with a baseline link:

```html
<a class="portal-door" id="portal-door" href="./home.html"
   aria-label="Open the door and enter Anjou's personal blog">
  <!-- existing original door SVG -->
</a>
```

Keep the live status region and all original SVG accessibility labels.

- [ ] **Step 5: Implement enhanced navigation without hardcoded origin**

`assets/js/entry.js` must intercept the link once, add `is-entering`, update the live region, and navigate with:

```js
window.location.assign(door.href);
```

Do not call `preventDefault()` when required elements are missing. Coalesce pointer updates through one `requestAnimationFrame` callback and remove pending animation work during page hide.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
node --test tests/site-validation.test.mjs
node scripts/validate-site.mjs
node --check assets/js/entry.js
```

Expected: route assertions PASS and no entry-loop or encoding issue remains.

---

### Task 3: Extract Shared DOM and Site-Shell Modules

**Files:**
- Create: `tests/dom.test.mjs`
- Create: `assets/js/core/dom.js`
- Create: `assets/js/core/site-shell.js`
- Modify: `assets/js/site.js`
- Modify: `assets/js/pages/home.js`
- Modify: `assets/js/pages/now.js`
- Modify: `assets/js/pages/post.js`
- Modify: `assets/js/pages/project.js`
- Modify: `assets/js/pages/projects.js`
- Modify: `assets/js/pages/writing.js`

- [ ] **Step 1: Write failing escaping tests**

Test null-safe conversion and all five HTML-sensitive characters:

```js
assert.equal(escapeHtml(`<a title="x">Tom & 'Ana'</a>`),
  "&lt;a title=&quot;x&quot;&gt;Tom &amp; &#039;Ana&#039;&lt;/a&gt;");
assert.equal(escapeHtml(42), "42");
assert.equal(escapeHtml(null), "");
```

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/dom.test.mjs
```

Expected: FAIL because `assets/js/core/dom.js` does not exist.

- [ ] **Step 3: Implement `escapeHtml`**

Create one pure helper that converts nullish input to an empty string, stringifies other input, and escapes `& < > " '` in that order.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
node --test tests/dom.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Move shell behavior and update imports**

Move active navigation, year, mobile menu, and scroll-to-top behavior to `core/site-shell.js`. Keep `site.js` as a tiny boot module importing `initSiteShell()` and `initCustomCursor()` so all HTML script references remain stable. Update every page controller to import `escapeHtml` from `../core/dom.js`.

Escape title, summary, date, type, topic, reading time, status, updated date, tags, and Now labels before insertion.

- [ ] **Step 6: Validate after refactor**

Run:

```bash
node --test tests/dom.test.mjs tests/site-validation.test.mjs
for file in assets/js/**/*.js assets/js/*.js; do node --check "$file"; done
node scripts/validate-site.mjs
```

Expected: all tests and syntax checks PASS.

---

### Task 4: Establish Shared Tokens and Internal-Site Styling

**Files:**
- Create: `assets/css/tokens.css`
- Create: `assets/css/site.css`
- Modify: all seven internal HTML pages
- Remove: `assets/css/styles.css`

- [ ] **Step 1: Extend validation tests for stylesheet contracts**

Require every internal page to load `assets/css/tokens.css` before `assets/css/site.css`, and require the entry page to load `tokens.css` before `entry.css`.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test tests/site-validation.test.mjs
```

Expected: FAIL because the new stylesheet files are not yet wired.

- [ ] **Step 3: Create shared tokens**

Define the accepted night-blue, warm-paper, muted blue-gray, restrained gold, serif display, sans body, mono metadata, width, radius, focus, and transition variables. Include light and dark color-scheme values without importing remote assets.

- [ ] **Step 4: Refactor internal styles**

Move structural and component styles from `styles.css` to `site.css`. Reduce generic card radius and shadow, strengthen editorial typography, retain existing responsive grids/status semantics, and add `:focus-visible` plus reduced-motion rules.

- [ ] **Step 5: Update internal pages and routes**

Load both stylesheets and change every Home/brand route from `index.html` to `home.html`. Keep the entry page outside the internal navigation to prevent accidental loops.

- [ ] **Step 6: Validate GREEN**

Run:

```bash
node --test tests/site-validation.test.mjs
node scripts/validate-site.mjs
```

Expected: PASS with no references to `assets/css/styles.css`.

---

### Task 5: Harden Cursor and Page Edge States

**Files:**
- Modify: `assets/js/cursor.js`
- Modify: `assets/js/pages/post.js`
- Modify: `assets/js/pages/project.js`
- Test: `tests/browser-smoke.py`

- [ ] **Step 1: Add browser assertions for edge states**

The smoke test must request invalid post/project slugs and assert a visible heading plus a recovery link. It must emulate reduced motion and assert custom cursor elements are not created.

- [ ] **Step 2: Verify RED**

Run the local server and:

```bash
python tests/browser-smoke.py --base-url http://127.0.0.1:8765
```

Expected: FAIL because the current custom cursor ignores reduced motion and error states lack explicit recovery links in their rendered containers.

- [ ] **Step 3: Implement minimal hardening**

Return early from `initCustomCursor()` when either `(pointer: fine)` is false or `(prefers-reduced-motion: reduce)` is true. Ensure initialization is idempotent. Add recovery links to the not-found render states.

- [ ] **Step 4: Verify GREEN**

Run the smoke command again.

Expected: PASS for reduced-motion and bad-slug checks.

---

### Task 6: Complete Responsive Browser Smoke Coverage

**Files:**
- Modify: `tests/browser-smoke.py`
- Modify as required by failures: `assets/css/entry.css`, `assets/css/site.css`, `assets/js/entry.js`, HTML pages

- [ ] **Step 1: Add viewport and interaction cases**

Cover widths `360, 390, 430, 768, 1024, 1366, 1440, 1920`. For each, assert `scrollWidth <= innerWidth`. Also verify:

- the root title has no replacement character;
- entry click adds `is-entering` and targets `/home.html`;
- Enter activates the door;
- mobile nav opens/closes and updates `aria-expanded`;
- home renders three posts, two featured projects, and the Now snapshot;
- Writing and Projects render their data;
- every HTML page returns HTTP 200;
- no page emits console errors or failed local resource responses.

- [ ] **Step 2: Run and observe failures**

Run:

```bash
python tests/browser-smoke.py --base-url http://127.0.0.1:8765
```

Expected: any remaining responsive, routing, or console failures are reported with page and viewport.

- [ ] **Step 3: Apply only evidence-driven fixes**

Adjust the smallest relevant CSS/JS/HTML region for each reproduced failure. Do not redesign content or add new dependencies.

- [ ] **Step 4: Re-run until GREEN**

Run the smoke command after every fix.

Expected: all viewport and interaction cases PASS with no console errors.

---

### Task 7: Document Operation and Run Final Verification

**Files:**
- Modify: `README.md`
- Verify: all project files

- [ ] **Step 1: Update README**

Document:

```text
site purpose
index.html -> home.html navigation
source directory map
how to edit posts/projects/Now
python -m http.server local preview
node scripts/validate-site.mjs
node --test tests/*.test.mjs
python tests/browser-smoke.py --base-url ...
GitHub Pages deployment behavior
```

- [ ] **Step 2: Run the complete verification suite**

```bash
node --test tests/*.test.mjs
node scripts/validate-site.mjs
for file in assets/js/**/*.js assets/js/*.js scripts/**/*.mjs tests/*.mjs; do node --check "$file"; done
python -m http.server 8765 --bind 127.0.0.1
# In a second process:
python tests/browser-smoke.py --base-url http://127.0.0.1:8765
```

Expected: all commands exit `0`; browser smoke reports every viewport and route passing.

- [ ] **Step 3: Review repository diff and accidental artifacts**

```bash
git status --short
git diff --check
git diff --stat
git diff -- README.md docs assets scripts tests '*.html'
```

Expected: only planned source, test, and documentation files; no screenshots, caches, credentials, generated archives, or temporary files.

- [ ] **Step 4: Prepare local commit only after verification**

Use the repository's required commit workflow. Do not push until the user reviews the summary and explicitly authorizes it.
