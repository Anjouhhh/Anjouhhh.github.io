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

async function renderMissingDetail(kind) {
  const detail = { innerHTML: "" };
  const outerBackLink = { hidden: false, classList: new FakeClassList() };
  const fakeDocument = {
    title: kind === "post" ? "Post | Anjou Zhao" : "Project | Anjou Zhao",
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
    return { detail, fakeDocument, outerBackLink };
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
    const { detail, fakeDocument, outerBackLink } = await renderMissingDetail(kind);

    assert.equal(fakeDocument.title, `${label} not found | Anjou Zhao`);
    assert.equal(outerBackLink.hidden, true);
    assert.match(detail.innerHTML, new RegExp(`<h1>${label} not found<\\/h1>`));
    assert.match(detail.innerHTML, new RegExp(`href=["']${recoveryHref}["']`));
  });

  test(`${kind} detail page provides a stable outer recovery-link id`, async () => {
    const html = await readFile(new URL(`../${kind}.html`, import.meta.url), "utf8");
    assert.match(html, new RegExp(`id=["']${kind}-back-link["']`));
  });
}
