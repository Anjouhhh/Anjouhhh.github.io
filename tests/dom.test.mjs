import assert from "node:assert/strict";
import test from "node:test";

import { escapeHtml } from "../assets/js/core/dom.js";

test("escapeHtml escapes all HTML-sensitive characters", () => {
  assert.equal(
    escapeHtml(`<a title="x">Tom & 'Ana'</a>`),
    "&lt;a title=&quot;x&quot;&gt;Tom &amp; &#039;Ana&#039;&lt;/a&gt;"
  );
});

test("escapeHtml stringifies non-string values", () => {
  assert.equal(escapeHtml(42), "42");
});

test("escapeHtml converts nullish values to an empty string", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml does not re-escape entities created during the same call", () => {
  assert.equal(escapeHtml("<"), "&lt;");
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});

test("site boot initializes the shell when the optional cursor is disabled and elements are missing", async () => {
  const year = { textContent: "" };
  const fakeDocument = {
    baseURI: "https://anjouhhh.github.io/home.html",
    body: { dataset: { page: "home" } },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: (id) => id === "year" ? year : null,
    addEventListener() {}
  };
  const fakeWindow = {
    location: new URL(fakeDocument.baseURI),
    matchMedia: () => ({ matches: false }),
    addEventListener() {}
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;

  try {
    const bootUrl = new URL("../assets/js/site.js", import.meta.url);
    bootUrl.searchParams.set("test", `${Date.now()}-${Math.random()}`);
    await import(bootUrl.href);

    assert.equal(year.textContent, String(new Date().getFullYear()));
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

class FakeClassList {
  constructor() {
    this.values = new Set();
    this.addCounts = new Map();
  }

  add(...names) {
    names.forEach((name) => {
      this.values.add(name);
      this.addCounts.set(name, (this.addCounts.get(name) ?? 0) + 1);
    });
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  toggle(name, force) {
    const enabled = force ?? !this.values.has(name);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name) {
    return this.values.has(name);
  }

  addCallCount(name) {
    return this.addCounts.get(name) ?? 0;
  }
}

class FakeMediaQuery {
  constructor(media, matches) {
    this.media = media;
    this.matches = matches;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(matches) {
    this.matches = matches;
    for (const listener of this.listeners.get("change") ?? []) {
      listener({ matches, media: this.media });
    }
  }
}

class FakeElement {
  constructor(href = null) {
    this.href = href;
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = "";
    this.children = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, event = { target: this }) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  getAttribute(name) {
    return name === "href" ? this.href : this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  querySelectorAll(selector) {
    return selector === "a" ? this.children : [];
  }

  contains(target) {
    return target === this || this.children.includes(target);
  }
}

test("initSiteShell initializes shell behavior and the navigation marker once per document", async () => {
  const homeLink = new FakeElement("./home.html?from=nav#top");
  const aboutLink = new FakeElement("about.html");
  aboutLink.classList.add("active");
  aboutLink.setAttribute("aria-current", "page");
  const nav = new FakeElement();
  nav.children = [homeLink, aboutLink];
  const year = new FakeElement();
  const toggle = new FakeElement();
  const scrollButton = new FakeElement();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const scrollCalls = [];
  const mobileNavigationQuery = new FakeMediaQuery("(max-width: 580px)", true);
  const reducedMotionQuery = new FakeMediaQuery("(prefers-reduced-motion: reduce)", false);

  const fakeDocument = {
    baseURI: "https://anjouhhh.github.io/home.html",
    documentElement: new FakeElement(),
    body: { dataset: { page: "home" } },
    querySelectorAll: (selector) => selector === "nav a" ? nav.children : [],
    querySelector: (selector) => selector === "nav" ? nav : null,
    getElementById: (id) => ({ year, "nav-toggle": toggle, "scroll-top": scrollButton })[id] ?? null,
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) ?? [];
      listeners.push(listener);
      documentListeners.set(type, listeners);
    }
  };
  const fakeWindow = {
    location: new URL(fakeDocument.baseURI),
    scrollY: 0,
    matchMedia(query) {
      if (query === mobileNavigationQuery.media) return mobileNavigationQuery;
      if (query === reducedMotionQuery.media) return reducedMotionQuery;
      return new FakeMediaQuery(query, false);
    },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    scrollTo(options) {
      scrollCalls.push(options);
    }
  };

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;

  try {
    const { initSiteShell } = await import("../assets/js/core/site-shell.js");
    initSiteShell();
    initSiteShell();

    assert.equal(homeLink.classList.contains("active"), true);
    assert.equal(homeLink.attributes.get("aria-current"), "page");
    assert.equal(aboutLink.classList.contains("active"), false);
    assert.equal(aboutLink.attributes.has("aria-current"), false);
    assert.equal(year.textContent, String(new Date().getFullYear()));
    assert.equal(toggle.listeners.get("click")?.length, 1);
    assert.equal(homeLink.listeners.get("click")?.length, 1);
    assert.equal(aboutLink.listeners.get("click")?.length, 1);
    assert.equal(documentListeners.get("click")?.length, 1);
    assert.equal(windowListeners.get("scroll")?.length, 1);
    assert.equal(scrollButton.listeners.get("click")?.length, 1);
    assert.equal(mobileNavigationQuery.listeners.get("change")?.length, 1);
    assert.equal(fakeDocument.documentElement.classList.contains("site-navigation-enhanced"), true);
    assert.equal(fakeDocument.documentElement.classList.addCallCount("site-navigation-enhanced"), 1);

    toggle.dispatch("click");
    assert.equal(nav.classList.contains("open"), true);
    assert.equal(toggle.attributes.get("aria-expanded"), "true");

    homeLink.dispatch("click");
    assert.equal(nav.classList.contains("open"), false);
    assert.equal(toggle.attributes.get("aria-expanded"), "false");

    toggle.dispatch("click");
    documentListeners.get("click")[0]({ target: new FakeElement() });
    assert.equal(nav.classList.contains("open"), false);

    toggle.dispatch("click");
    mobileNavigationQuery.dispatch(false);
    assert.equal(nav.classList.contains("open"), false);
    assert.equal(toggle.attributes.get("aria-expanded"), "false");
    mobileNavigationQuery.dispatch(true);
    assert.equal(nav.classList.contains("open"), false);
    assert.equal(toggle.attributes.get("aria-expanded"), "false");

    fakeWindow.scrollY = 401;
    windowListeners.get("scroll")[0]();
    assert.equal(scrollButton.classList.contains("visible"), true);

    scrollButton.dispatch("click");
    assert.deepEqual(scrollCalls, [{ top: 0, behavior: "smooth" }]);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("initSiteShell uses an instant scroll under reduced motion", async () => {
  const scrollButton = new FakeElement();
  const scrollCalls = [];
  const fakeDocument = {
    baseURI: "https://anjouhhh.github.io/about.html",
    documentElement: new FakeElement(),
    body: { dataset: { page: "about" } },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: (id) => id === "scroll-top" ? scrollButton : null,
    addEventListener() {}
  };
  const fakeWindow = {
    location: new URL(fakeDocument.baseURI),
    scrollY: 0,
    matchMedia: (query) => new FakeMediaQuery(query, query === "(prefers-reduced-motion: reduce)"),
    addEventListener() {},
    scrollTo(options) {
      scrollCalls.push(options);
    }
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;

  try {
    const { initSiteShell } = await import("../assets/js/core/site-shell.js");
    initSiteShell();
    scrollButton.dispatch("click");
    assert.deepEqual(scrollCalls, [{ top: 0, behavior: "auto" }]);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("initSiteShell leaves the root unmarked when optional navigation controls are absent", async () => {
  const year = new FakeElement();
  const fakeDocument = {
    baseURI: "https://anjouhhh.github.io/about.html",
    documentElement: new FakeElement(),
    body: { dataset: { page: "about" } },
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: (id) => id === "year" ? year : null,
    addEventListener() {}
  };
  const fakeWindow = {
    location: new URL(fakeDocument.baseURI),
    addEventListener() {}
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;

  try {
    const { initSiteShell } = await import("../assets/js/core/site-shell.js");
    assert.doesNotThrow(() => initSiteShell());
    assert.equal(year.textContent, String(new Date().getFullYear()));
    assert.equal(fakeDocument.documentElement.classList.contains("site-navigation-enhanced"), false);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});

test("initSiteShell normalizes Home href forms and rejects stale index or external routes", async (testContext) => {
  const cases = [
    ["home.html", true],
    ["./home.html", true],
    ["home.html?from=nav#top", true],
    ["https://anjouhhh.github.io/home.html?from=nav#top", true],
    [new URL("./home.html", "https://anjouhhh.github.io/about.html").href, true],
    ["index.html", false],
    ["./index.html?legacy=1", false],
    ["https://example.com/home.html", false]
  ];

  const { initSiteShell } = await import("../assets/js/core/site-shell.js");

  for (const [href, expectedActive] of cases) {
    await testContext.test(href, () => {
      const link = new FakeElement(href);
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
      const fakeDocument = {
        baseURI: "https://anjouhhh.github.io/about.html",
        body: { dataset: { page: "home" } },
        querySelectorAll: (selector) => selector === "nav a" ? [link] : [],
        querySelector: () => null,
        getElementById: () => null,
        addEventListener() {}
      };
      const fakeWindow = {
        location: new URL(fakeDocument.baseURI),
        addEventListener() {}
      };
      const originalDocument = globalThis.document;
      const originalWindow = globalThis.window;
      globalThis.document = fakeDocument;
      globalThis.window = fakeWindow;

      try {
        initSiteShell();
        assert.equal(link.classList.contains("active"), expectedActive);
        assert.equal(link.getAttribute("aria-current"), expectedActive ? "page" : null);
      } finally {
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
      }
    });
  }
});
