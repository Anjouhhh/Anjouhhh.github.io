# Entry Page Integration Architecture

**Status:** Accepted
**Date:** 2026-07-12
**Repository:** `Anjouhhh/Anjouhhh.github.io`

## Understanding Summary

- The star-orbit entry scene becomes the root `index.html`.
- The existing blog homepage moves to `home.html`.
- The entry door navigates to the relative URL `./home.html`; it must never loop back to the root entry page.
- GitHub Pages remains a zero-build static deployment with no production/project package dependencies, shipped framework/runtime, CDN font, analytics script, cookie, or backend.
- Internal blog pages retain their content and information architecture while adopting a restrained subset of the entry page's visual language.
- Entry-specific CSS and JavaScript are separated from the blog shell so internal pages do not download scene code.
- Encoding, accessibility, responsive layout, reduced-motion behavior, local links, and browser smoke behavior are verified before delivery.

## Assumptions and Non-Functional Requirements

- This is a solo-maintained personal blog with low-to-moderate static traffic.
- Current evergreen Chrome, Edge, Firefox, and Safari are supported.
- Every page remains usable under GitHub Pages and a local HTTP server with native ES modules enabled. The root entry link and internal navigation also work without JavaScript; data-backed lists and query-driven details require ES modules.
- Mobile navigation is static and wrapping by default. JavaScript exposes the hamburger/overlay presentation only after all navigation listeners are installed, so missing or failed enhancement leaves links visible.
- The entry scene uses only native HTML, CSS, SVG, and JavaScript.
- Motion changes only `transform` and `opacity` where practical; reduced-motion users receive a short fade.
- Existing posts, projects, and factual copy remain unchanged unless required for safe rendering or navigation.
- A full Astro/Vite migration, CMS, backend, analytics integration, and full-site redesign are out of scope.

## Chosen Architecture

### Pages

- `index.html` — semantic entry scene and progressive-enhancement link.
- `home.html` — current blog homepage.
- `about.html`, `writing.html`, `projects.html`, `now.html` — existing index pages with unified navigation and tokens.
- `post.html`, `project.html` — query-driven detail pages using the existing data modules.

### Styles

- `assets/css/tokens.css` — shared color, typography, spacing, width, focus, and motion tokens.
- `assets/css/site.css` — internal blog layout and components.
- `assets/css/entry.css` — entry scene, responsive composition, and transition states.

### JavaScript

- `assets/js/core/dom.js` — pure DOM-safe helpers such as HTML escaping.
- `assets/js/core/site-shell.js` — active navigation, mobile navigation, year, and scroll-to-top behavior.
- `assets/js/entry.js` — deterministic stars, pointer parallax, transition state, and navigation enhancement.
- `assets/js/cursor.js` — optional fine-pointer cursor, disabled for reduced-motion users.
- `assets/js/pages/` and `assets/js/data/` — existing page controllers and content data.

### Validation

- `scripts/lib/site-validation.mjs` — reusable static-site inspection functions.
- `scripts/validate-site.mjs` — CLI validation using only Node built-ins, with no project package install.
- `tests/site-validation.test.mjs` — Node built-in tests for validation behavior.
- `tests/browser-smoke.py` — Python Playwright smoke coverage across entry, home, navigation, detail, and error states. Playwright is a development verification dependency and is not shipped to GitHub Pages.

## Navigation and Degradation

1. A visitor requests the root and receives `index.html`.
2. The door is a real link to `./home.html`, so navigation works without JavaScript.
3. JavaScript intercepts activation once, locks the entering state, announces progress, and plays the transition.
4. Reduced-motion users receive a short fade before navigation.
5. Internal Home links always point to `home.html`.
6. Internal mobile navigation starts as visible wrapping links. Once `initSiteShell` successfully installs the navigation listeners, a root marker enables the hamburger/overlay presentation.
7. If JavaScript is disabled, `site.js` fails, or optional navigation controls are absent, the marker is not added and the static links remain usable.

Bad or missing post/project slugs display a recoverable not-found message and a link back to the relevant index. Dynamic post, project, and Now lists and query-driven details require ES modules; their inserted content is escaped consistently.

## Visual Direction

**Aesthetic:** quiet celestial editorial.
**Memorable anchor:** the orbital rose planet and illuminated door.

The internal blog does not reproduce the animated scene. It shares the night-blue/warm-paper color story, serif display typography, restrained gold accent, fine borders, and deliberate spacing. Cards lose generic SaaS styling in favor of flatter editorial surfaces. The current content hierarchy remains intact.

**DFII:** 13/15. The direction is distinctive, context-appropriate, feasible with native browser technology, and performance-safe. The primary consistency risk is controlled through shared tokens rather than duplicated decorative effects.

## Performance and Accessibility Boundaries

- No production/project package dependencies, deployment framework/runtime, remote font, or large raster hero asset are shipped.
- Entry and site styles are loaded independently.
- Stars use deterministic generation and viewport-aware counts.
- Pointer movement is coalesced through `requestAnimationFrame`.
- Keyboard activation, visible focus, semantic landmarks, live status, and reduced-motion behavior are required.
- The custom cursor never replaces the native cursor on touch/coarse-pointer devices and does not activate when reduced motion is requested.

## Alternatives Considered

1. **Runtime-loaded header/footer fragments** — rejected because it introduces fetch dependency, visual flash, and weaker local-file behavior to remove only modest HTML duplication.
2. **Single-file conservative merge** — rejected because the 30 KB entry document would continue mixing structure, style, and behavior.
3. **Vite or Astro migration** — rejected because the maintenance and deployment cost is not justified for the current scale.

## Decision Log

1. Root `index.html` is the entry page; the old homepage becomes `home.html`.
2. The production GitHub Pages deployment stays zero-build with no project package dependencies; the validator uses Node built-ins and development verification may use Python Playwright.
3. Internal pages receive light brand unification, not a full redesign.
4. Small static header/footer duplication is accepted in exchange for reliability and no template runtime.
5. The entry uses a real link as its baseline behavior; JavaScript only enhances the transition.
6. Internal mobile navigation uses visible wrapping links as its baseline; JavaScript enables the hamburger only after listener setup succeeds.
7. Node built-ins-only static validation and development-only Python Playwright smoke checks replace a full build toolchain; Playwright is not part of the deployed site.

## Acceptance Criteria

- Root entry and all internal pages load without console errors or broken local references.
- The door reaches `home.html` by click and keyboard and cannot trigger twice.
- There is no horizontal overflow at 360, 390, 430, 768, 1024, 1366, 1440, and 1920 px widths.
- Reduced-motion behavior remains complete and usable.
- All source files decode as UTF-8 and visible text contains no replacement characters.
- Existing post, project, and Now data remains available.
- Validation and smoke commands are documented in `README.md`.
