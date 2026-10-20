import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createMetaElement() {
  const attributes = new Map();
  return {
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    }
  };
}

async function renderMissingDetail(kind) {
  const detail = { innerHTML: "" };
  const outerBackLink = { hidden: false, classList: new FakeClassList() };
  const created = [];
  const fakeDocument = {
    title: kind === "post" ? "Post | Anjou Zhao" : "Project | Anjou Zhao",
    head: {
      appendChild(node) {
        created.push(node);
      }
    },
    createElement() {
      return createMetaElement();
    },
    getElementById(id) {
      const expected = kind === "post" ? "post-detail" : "project-detail";
      const backId = kind === "post" ? "post-back-link" : "project-back-link";
      if (id === expected) return detail;
      if (id === backId) return outerBackLink;
      return null;
    },
    querySelector() {
      return null;
    }
  };
  const fakeWindow = {
    location: { search: "?slug=missing" },
    addEventListener() {}
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;

  try {
    const moduleUrl = new URL(`../assets/js/pages/${kind}.js`, import.meta.url);
    moduleUrl.searchParams.set("test", `${Date.now()}-${Math.random()}`);
    await import(moduleUrl.href);
    return { detail, fakeDocument, outerBackLink, created };
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
}

for (const [kind, label, recoveryHref] of [
  ["post", "Post", "writing.html"],
  ["project", "Project", "projects.html"]
]) {
  test(`${kind} not-found state sets the title and exposes one adjacent recovery path`, async () => {
    const { detail, fakeDocument, outerBackLink, created } = await renderMissingDetail(kind);

    assert.equal(fakeDocument.title, `${label} not found | Anjou Zhao`);
    assert.equal(outerBackLink.hidden, true);
    assert.match(detail.innerHTML, new RegExp(`<h1>${label} not found<\\/h1>`));
    assert.match(detail.innerHTML, new RegExp(`href=["']${recoveryHref}["']`));
    if (kind === "post") {
      assert.equal(created.length, 1);
      assert.equal(created[0].getAttribute("name"), "robots");
      assert.equal(created[0].getAttribute("content"), "noindex");
    } else {
      assert.equal(created.length, 0);
    }
  });

  test(`${kind} detail page provides a stable outer recovery-link id`, async () => {
    const html = await readFile(new URL(`../${kind}.html`, import.meta.url), "utf8");
    assert.match(html, new RegExp(`id=["']${kind}-back-link["']`));
  });
}

function createLanguageSwitch(href) {
  return {
    hrefValue: href,
    getAttribute(name) {
      return name === "href" ? this.hrefValue : null;
    },
    setAttribute(name, value) {
      if (name === "href") this.hrefValue = value;
    }
  };
}

function remoteNote(slug, title = slug) {
  return {
    slug,
    title,
    format: "note",
    bodyText: "Body",
    publishedAt: 1706000000
  };
}

function jsonResponse(posts, nextCursor = null) {
  return {
    ok: true,
    json: async () => ({ posts, nextCursor })
  };
}

async function renderPostPage({ lang, search, switchHref, fetchImpl, linkBox = {}, detailBox }) {
  const detail = { innerHTML: "" };
  if (detailBox) detailBox.detail = detail;
  const outerBackLink = { hidden: false, classList: new FakeClassList() };
  const languageSwitch = createLanguageSwitch(switchHref);
  linkBox.link = languageSwitch;
  const created = [];
  const fakeDocument = {
    title: "Post | Anjou Zhao",
    documentElement: { lang },
    head: {
      appendChild(node) {
        created.push(node);
      }
    },
    createElement() {
      return createMetaElement();
    },
    getElementById(id) {
      if (id === "post-detail") return detail;
      if (id === "post-back-link") return outerBackLink;
      return null;
    },
    querySelector(selector) {
      if (selector === "[data-language-switch]") return languageSwitch;
      return null;
    }
  };
  const fakeWindow = {
    location: { search },
    addEventListener() {}
  };
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  globalThis.document = fakeDocument;
  globalThis.window = fakeWindow;
  globalThis.fetch = fetchImpl;

  try {
    const moduleUrl = new URL("../assets/js/pages/post.js", import.meta.url);
    moduleUrl.searchParams.set("test", `${Date.now()}-${Math.random()}`);
    await import(moduleUrl.href);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { detail, fakeDocument, languageSwitch, created };
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
}

test("post toggle keeps the other-locale post only when that slug exists", async () => {
  const requests = [];
  const { languageSwitch, created, fakeDocument } = await renderPostPage({
    lang: "en",
    search: "?slug=proof-writing-is-a-design-problem",
    switchHref: "zh/post.html?slug=proof-writing-is-a-design-problem",
    fetchImpl: async (url) => {
      requests.push(String(url));
      if (String(url).includes("collection=chinese")) {
        return jsonResponse([
          remoteNote("zh-proof-writing-is-a-design-problem", "证明写作也是一个设计问题")
        ], "more");
      }
      return jsonResponse([
        remoteNote("proof-writing-is-a-design-problem", "Proof Writing Is Also a Design Problem")
      ]);
    }
  });

  assert.equal(languageSwitch.hrefValue, "zh/post.html?slug=proof-writing-is-a-design-problem");
  assert.equal(fakeDocument.title, "Proof Writing Is Also a Design Problem | Anjou Zhao");
  assert.equal(created.length, 0);
  assert.equal(requests.length, 2);
  assert.equal(requests.some((url) => url.includes("cursor=")), false);
});

test("post toggle falls back to the other writing page when the slug is missing", async () => {
  const cases = [
    {
      lang: "en",
      search: "?slug=3vvec",
      switchHref: "zh/post.html?slug=3vvec",
      expected: "zh/writing.html",
      en: [remoteNote("3vvec", "Quote")],
      zh: [remoteNote("zglx9")]
    },
    {
      lang: "zh-CN",
      search: "?slug=aoi8f",
      switchHref: "../post.html?slug=aoi8f",
      expected: "../writing.html",
      en: [remoteNote("3vvec", "Quote")],
      zh: [remoteNote("aoi8f", "AI 四十年")]
    }
  ];

  for (const item of cases) {
    const { languageSwitch, created } = await renderPostPage({
      lang: item.lang,
      search: item.search,
      switchHref: item.switchHref,
      fetchImpl: async (url) => {
        const posts = String(url).includes("collection=chinese") ? item.zh : item.en;
        return jsonResponse(posts);
      }
    });

    assert.equal(languageSwitch.hrefValue, item.expected);
    assert.equal(created.length, 0);
  }
});

test("post page renders when its own list loads and updates the toggle after the other locale resolves", async () => {
  let releaseOther;
  const otherGate = new Promise((resolve) => {
    releaseOther = resolve;
  });
  let markOtherStarted;
  const otherStarted = new Promise((resolve) => {
    markOtherStarted = resolve;
  });
  const linkBox = {};
  const detailBox = {};

  const pending = renderPostPage({
    lang: "en",
    search: "?slug=shared-essay",
    switchHref: "zh/post.html?slug=shared-essay",
    linkBox,
    detailBox,
    fetchImpl: async (url) => {
      if (String(url).includes("collection=chinese")) {
        markOtherStarted();
        await otherGate;
        return jsonResponse([remoteNote("zh-shared-essay", "共享")]);
      }
      return jsonResponse([remoteNote("shared-essay", "Shared Essay")]);
    }
  });

  await otherStarted;
  for (let attempt = 0; attempt < 20 && !detailBox.detail.innerHTML.includes("Shared Essay"); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.match(detailBox.detail.innerHTML, /Shared Essay/);
  assert.equal(linkBox.link.hrefValue, "zh/writing.html");

  releaseOther();
  const { languageSwitch, fakeDocument } = await pending;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(fakeDocument.title, "Shared Essay | Anjou Zhao");
  assert.equal(languageSwitch.hrefValue, "zh/post.html?slug=shared-essay");
});

test("post toggle updates as soon as the other locale resolves, without waiting to render", async () => {
  let releaseCurrent;
  const currentGate = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const linkBox = {};
  const detailBox = {};

  const pending = renderPostPage({
    lang: "en",
    search: "?slug=shared-essay",
    switchHref: "zh/post.html?slug=shared-essay",
    linkBox,
    detailBox,
    fetchImpl: async (url) => {
      if (String(url).includes("collection=chinese")) {
        return jsonResponse([remoteNote("zh-shared-essay", "共享")]);
      }
      await currentGate;
      return jsonResponse([remoteNote("shared-essay", "Shared Essay")]);
    }
  });

  for (let attempt = 0; attempt < 20 && linkBox.link.hrefValue !== "zh/post.html?slug=shared-essay"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(detailBox.detail.innerHTML, "");
  assert.equal(linkBox.link.hrefValue, "zh/post.html?slug=shared-essay");

  releaseCurrent();
  const { fakeDocument, detail } = await pending;
  assert.equal(fakeDocument.title, "Shared Essay | Anjou Zhao");
  assert.match(detail.innerHTML, /Shared Essay/);
});

test("untitled post page uses the body heading for the visible title and document title", async () => {
  const { detail, fakeDocument, languageSwitch, created } = await renderPostPage({
    lang: "en",
    search: "?slug=notes-on-pg-how-to-make-wealth",
    switchHref: "zh/post.html?slug=notes-on-pg-how-to-make-wealth",
    fetchImpl: async (url) => {
      if (String(url).includes("collection=chinese")) return jsonResponse([]);
      return jsonResponse([{
        slug: "notes-on-pg-how-to-make-wealth",
        title: null,
        format: "quote",
        bodyHtml: "<h2>Notes on Paul Graham&#39;s &quot;How to Make Wealth&quot;</h2><p>Source: paulgraham.com/earn.html</p>",
        bodyText: "Notes on Paul Graham's \"How to Make Wealth\" Source: paulgraham.com/earn.html",
        quoteText: "So how",
        publishedAt: 1706000000
      }]);
    }
  });

  assert.equal(fakeDocument.title, "Notes on Paul Graham's \"How to Make Wealth\" | Anjou Zhao");
  assert.match(detail.innerHTML, /<h1 class="post-heading">Notes on Paul Graham&#039;s &quot;How to Make Wealth&quot;<\/h1>/);
  assert.equal((detail.innerHTML.match(/How to Make Wealth/g) || []).length, 1);
  assert.match(detail.innerHTML, /Source: paulgraham.com\/earn.html/);
  assert.equal(languageSwitch.hrefValue, "zh/writing.html");
  assert.equal(created.length, 0);
});

test("post toggle falls back to writing when the other-locale request fails", async () => {
  const { languageSwitch, fakeDocument, created } = await renderPostPage({
    lang: "zh-CN",
    search: "?slug=zglx9",
    switchHref: "../post.html?slug=zglx9",
    fetchImpl: async (url) => {
      if (String(url).includes("collection=english")) throw new Error("offline");
      return jsonResponse([remoteNote("zglx9", "摘录")]);
    }
  });

  assert.equal(languageSwitch.hrefValue, "../writing.html");
  assert.equal(fakeDocument.title, "摘录 | Anjou Zhao");
  assert.equal(created.length, 0);
});

test("missing current post is noindex and still links to an existing other-locale post", async () => {
  const { languageSwitch, created, fakeDocument } = await renderPostPage({
    lang: "en",
    search: "?slug=zglx9",
    switchHref: "zh/post.html?slug=zglx9",
    fetchImpl: async (url) => {
      if (String(url).includes("collection=chinese")) return jsonResponse([remoteNote("zglx9", "摘录")]);
      return jsonResponse([remoteNote("3vvec", "Quote")]);
    }
  });

  assert.equal(fakeDocument.title, "Post not found | Anjou Zhao");
  assert.equal(languageSwitch.hrefValue, "zh/post.html?slug=zglx9");
  assert.equal(created.length, 1);
  assert.equal(created[0].getAttribute("content"), "noindex");
});
