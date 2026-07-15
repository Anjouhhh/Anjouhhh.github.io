# Anjou Zhao — Personal Blog

A zero-build personal blog for GitHub Pages. The root `index.html` is an accessible celestial entry scene; its door links to `home.html`, the blog homepage. The accepted visual direction is **quiet celestial editorial**: night blue, warm paper, restrained gold, serif display type, and subtle native-browser motion.

## Architecture and routes

The site is plain HTML, CSS, and native ES modules. It has no production/project package dependencies, package manager, framework, bundler, generated `dist` directory, backend, analytics script, or remote font. The validator uses Node built-ins only; Python Playwright is a development-only browser-verification dependency.

Root flow:

```text
index.html entry scene → ./home.html blog → internal pages
```

The entry door is a real relative link, and internal navigation defaults to visible static links, so both remain usable without JavaScript. JavaScript enhances the door transition and, after its navigation listeners are ready, converts the mobile links into the current hamburger/overlay menu. If JavaScript or `site.js` is unavailable, the mobile links remain visible in a wrapping layout. Dynamic post, project, and Now lists plus query-driven post/project details require native ES modules.

| Path | Responsibility |
| --- | --- |
| `index.html` | Root entry scene, semantic door link, SVG artwork, and live transition status. |
| `home.html` | Internal blog homepage and links to the main sections. |
| `about.html` | About-page copy. |
| `writing.html` / `post.html` | Writing index and query-driven post detail (`?slug=...`). |
| `projects.html` / `project.html` | Project index and query-driven project detail (`?slug=...`). |
| `now.html` | Current learning, building, and thinking snapshot. |
| `assets/css/tokens.css` | Shared colors, typography, spacing, widths, focus, and motion tokens. |
| `assets/css/site.css` | Internal-page shell, editorial components, responsive layouts, cursor states, and accessibility rules. |
| `assets/css/entry.css` | Entry-scene composition, animation, responsive behavior, and transition states. |
| `assets/js/core/dom.js` | HTML escaping helper for data rendered into markup. |
| `assets/js/core/templates.js` | Safe renderers for posts, projects, details, error states, and the Now snapshot. |
| `assets/js/core/site-shell.js` | Active navigation, mobile menu, current year, and scroll-to-top behavior. |
| `assets/js/site.js` | Stable internal-page boot module for the site shell and optional custom cursor. |
| `assets/js/entry.js` | Deterministic stars, pointer parallax, one-shot door transition, and navigation enhancement. |
| `assets/js/cursor.js` | Fine-pointer custom cursor with reduced-motion and capability fallbacks. |
| `assets/js/data/posts.js` | Post metadata and paragraph content. |
| `assets/js/data/projects.js` | Project metadata, tags, status, and detail copy. |
| `assets/js/data/now.js` | Dated Now-page snapshot. |
| `assets/js/pages/*.js` | Page controllers that select data and call shared templates. |
| `scripts/lib/site-validation.mjs` | Reusable UTF-8, reference, module, metadata, route, and slug validation. |
| `scripts/validate-site.mjs` | Node built-ins-only validation CLI; no project package install is required. |
| `tests/*.test.mjs` | Node tests for validation, DOM helpers, templates, page behavior, and detail states. |
| `tests/browser-smoke.py` | Playwright smoke suite for routes, interactions, layouts, reduced motion, cursor fallbacks, and browser diagnostics. |
| `docs/architecture/entry-page-integration.md` | Accepted architecture and quiet celestial editorial design decision. |
| `docs/superpowers/plans/2026-07-12-entry-page-architecture.md` | Task-level implementation and verification plan. |

## Local preview

From the repository root, start a static server.

Git Bash (or another environment where `python` is Python 3):

```bash
python -m http.server 8765 --bind 127.0.0.1
```

macOS or Linux alternative:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

PowerShell or Windows Command Prompt:

```powershell
py -3 -m http.server 8765 --bind 127.0.0.1
```

Open:

- Entry: <http://127.0.0.1:8765/>
- Blog: <http://127.0.0.1:8765/home.html>
- Writing: <http://127.0.0.1:8765/writing.html>
- Projects: <http://127.0.0.1:8765/projects.html>
- Now: <http://127.0.0.1:8765/now.html>

Use HTTP preview rather than opening files with `file://`; ES modules and URL behavior are tested through a server.

## Editing content safely

All source files must remain UTF-8.

### Posts

Edit `assets/js/data/posts.js`. Each post needs a unique, URL-safe `slug`; `post.html?slug=<slug>` uses it to select the detail page. Keep the existing object fields and store body paragraphs in `content`. The homepage automatically shows the three newest posts by `date`; the Writing page shows all posts and derives its topic filters from `topic`.

### Projects

Edit `assets/js/data/projects.js`. Preserve the existing object shape, use a unique URL-safe `slug`, keep `tags` and `details` as arrays, and use the established `active`, `paused`, or `complete` status values. `project.html?slug=<slug>` resolves the detail page; featured projects populate the homepage selection.

### Now snapshot

Edit `assets/js/data/now.js`. Update `updatedAt` using `YYYY-MM-DD`, then edit the `learning`, `building`, and `thinking` arrays. The same snapshot feeds both `home.html` and `now.html`.

### Optional Jant content source

The site can use a self-hosted Jant instance as a publishing backend while keeping this repository's existing visual frontend. Configure the public, unauthenticated Jant API base URL in `assets/js/config/content-source.js`:

```js
export const JANT_PUBLIC_API_BASE_URL = "https://your-jant.example.com";
export const JANT_PUBLIC_API_BASE_URL_ZH = "";
export const JANT_ADMIN_URL = "https://your-jant.example.com/signin";
```

The public pages read Jant's `/api/public/posts` endpoint; no Jant API token belongs in this repository or in browser code. If a URL is empty, the site uses the checked-in `assets/js/data/posts.js` or `assets/js/data/zh/posts.js`. If the remote API is unavailable or returns an invalid response, the same local fallback is used. The English and Chinese pages can point to separate Jant instances; leaving the Chinese URL empty keeps the local Chinese archive.

When reading Jant from GitHub Pages in a browser, configure Jant's `CORS_ORIGINS` environment variable to allow the exact public origin. Do not use `*` for a production deployment unless you deliberately want every origin to read the API.

### Page copy

Edit static copy in the relevant `.html` file. Do not rename IDs, `data-page` values, navigation targets, script paths, or render containers unless the matching page controller and tests are updated. Dynamic content should remain in the data modules and pass through `assets/js/core/templates.js`; do not bypass its escaping with ad hoc `innerHTML`.

After any content or copy change, run the validator and tests below. Duplicate slugs, broken relative links, invalid UTF-8, and missing local modules are treated as errors.

## Validation

Run the Node built-ins-only validator and cross-shell test command from the repository root (PowerShell, Windows Command Prompt, Git Bash, macOS, or Linux). Neither command needs project packages:

```text
node scripts/validate-site.mjs
node --test
```

Spec-required command for Git Bash, macOS, or Linux (uses shell glob expansion):

```bash
node --test tests/*.test.mjs
```

Check browser behavior while the local server is running.

Git Bash (or another environment where `python` is Python 3):

```bash
python tests/browser-smoke.py --base-url http://127.0.0.1:8765
```

macOS or Linux alternative:

```bash
python3 tests/browser-smoke.py --base-url http://127.0.0.1:8765
```

PowerShell or Windows Command Prompt:

```powershell
py -3 tests/browser-smoke.py --base-url http://127.0.0.1:8765
```

The smoke script requires Python Playwright as a development verification dependency. It tries bundled Playwright Chromium first, then installed Chrome/Edge channels, then known system Chrome/Edge/Chromium executables. If no browser launches, install the Python package and a browser, or make a supported system browser available.

Git Bash (or another environment where `python` is Python 3):

```bash
python -m pip install playwright
python -m playwright install chromium
```

macOS or Linux alternative:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

PowerShell or Windows Command Prompt:

```powershell
py -3 -m pip install playwright
py -3 -m playwright install chromium
```

## GitHub Pages deployment

GitHub Pages publishes these files directly from the configured repository source. The root `.nojekyll` marker disables Jekyll/Liquid processing so Markdown architecture notes and JavaScript examples are copied as static files rather than interpreted as templates. No build command is required: `index.html` remains the public root, `home.html` remains a separate route, and all assets use repository-relative URLs. Deploy source files as-is; do not introduce generated asset hashes, absolute local paths, server-only routes, or a build-only dependency without changing the accepted architecture and deployment configuration.

## Accessibility and performance conventions

- Keep semantic landmarks, one visible `h1`, descriptive labels, keyboard-operable controls, and visible `:focus-visible` states.
- Preserve the entry door as a real `./home.html` link and keep recovery links on missing post/project states.
- Respect `prefers-reduced-motion`; the custom cursor must remain disabled for reduced motion and non-fine pointers.
- Keep the native cursor as the fallback. The entry link and internal navigation must not depend on hover, animation, or JavaScript. The enhanced mobile hamburger requires JavaScript, but static wrapping links remain visible when enhancement is unavailable. Dynamic post, project, and Now lists and query-driven detail rendering require ES modules.
- Prefer `transform` and `opacity` for motion, coalesce pointer work with `requestAnimationFrame`, and avoid remote assets or large decorative media.
- Keep entry CSS/JS separate from internal-page CSS/JS so blog pages do not load scene behavior.

## Troubleshooting

- **Browser smoke cannot launch:** read the ordered launch attempts in the error. Install Playwright Chromium or ensure Chrome, Edge, or Chromium is available in a standard location or on `PATH`.
- **Garbled text or a replacement character:** save the affected file as UTF-8 and rerun `node scripts/validate-site.mjs`.
- **A local page or asset is missing:** check filename case and use relative links such as `home.html`, `./home.html`, or `assets/...`; GitHub Pages is case-sensitive and does not resolve local filesystem paths.
- **Modules fail under local preview:** confirm the URL starts with `http://127.0.0.1:8765/`, not `file://`, and start the server from the repository root.
