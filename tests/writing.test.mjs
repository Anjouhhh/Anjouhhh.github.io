import assert from "node:assert/strict";
import test from "node:test";

class FakeClassList {
  constructor(names = []) {
    this.values = new Set(names);
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

class FakeButton {
  constructor(tagName, attributes) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.classList = new FakeClassList((attributes.class ?? "").split(/\s+/).filter(Boolean));
    this.dataset = { topic: attributes["data-topic"] ?? "" };
  }

  closest(selector) {
    return selector === ".chip" && this.classList.contains("chip") ? this : null;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

class FakeChipContainer {
  constructor() {
    this.buttons = [];
    this.listeners = new Map();
    this.markup = "";
  }

  set innerHTML(markup) {
    this.markup = markup;
    this.buttons = [...markup.matchAll(/<(span|button)\b([^>]*)>/g)].map((match) => {
      const attributes = {};
      for (const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
        attributes[attribute[1]] = attribute[2];
      }
      return new FakeButton(match[1], attributes);
    });
  }

  get innerHTML() {
    return this.markup;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  querySelectorAll(selector) {
    return selector === ".chip" ? this.buttons : [];
  }

  click(button) {
    this.listeners.get("click")?.({ target: button });
  }
}

test("writing topic controls are native buttons and click delegation synchronizes filter state", async () => {
  const chipContainer = new FakeChipContainer();
  const postList = { innerHTML: "" };
  const fakeDocument = {
    getElementById(id) {
      return { "post-list": postList, "topic-chips": chipContainer }[id] ?? null;
    }
  };
  const originalDocument = globalThis.document;
  globalThis.document = fakeDocument;

  try {
    await import("../assets/js/pages/writing.js?behavior-test");

    assert.ok(chipContainer.buttons.length > 1);
    for (const button of chipContainer.buttons) {
      assert.equal(button.tagName, "BUTTON");
      assert.equal(button.getAttribute("type"), "button");
    }

    const allButton = chipContainer.buttons.find((button) => button.dataset.topic === "");
    const aiButton = chipContainer.buttons.find((button) => button.dataset.topic === "AI");
    assert.ok(allButton);
    assert.ok(aiButton);
    assert.equal(allButton.classList.contains("active"), true);
    assert.equal(allButton.getAttribute("aria-pressed"), "true");

    chipContainer.click(aiButton);

    for (const button of chipContainer.buttons) {
      const selected = button === aiButton;
      assert.equal(button.classList.contains("active"), selected);
      assert.equal(button.getAttribute("aria-pressed"), String(selected));
    }
    assert.match(postList.innerHTML, /Using AI as a Thinking Partner/);
    assert.doesNotMatch(postList.innerHTML, /Proof Writing Is Also a Design Problem/);
  } finally {
    globalThis.document = originalDocument;
  }
});
