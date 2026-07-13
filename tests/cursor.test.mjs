import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { initCustomCursor } from "../assets/js/cursor.js";

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

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  listenerCount(type) {
    return (this.listeners.get(type) ?? []).length;
  }
}

class FakeElement {
  constructor() {
    this.className = "";
    this.classList = new FakeClassList();
    this.style = {};
    this.parentNode = null;
    this.rect = { left: 0, top: 0, width: 100, height: 40 };
    this.geometryReads = 0;
  }

  closest() {
    return this;
  }

  contains(candidate) {
    return candidate === this;
  }

  getBoundingClientRect() {
    this.geometryReads += 1;
    return this.rect;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }
}

class FakeMediaQuery extends FakeEventTarget {
  constructor(matches) {
    super();
    this.matches = matches;
  }

  setMatches(matches) {
    if (matches === this.matches) return;
    this.matches = matches;
    this.dispatch("change", { matches, media: this.media });
  }
}

function createEnvironment({ finePointer = true, reducedMotion = false, withBody = true } = {}) {
  const children = [];
  const body = new FakeEventTarget();
  body.classList = new FakeClassList();
  body.appendChild = (element) => {
    children.push(element);
    element.parentNode = body;
    return element;
  };
  body.removeChild = (element) => {
    const index = children.indexOf(element);
    if (index >= 0) children.splice(index, 1);
    element.parentNode = null;
  };

  const fakeDocument = new FakeEventTarget();
  fakeDocument.body = withBody ? body : null;
  fakeDocument.hidden = false;
  fakeDocument.visibilityState = "visible";
  fakeDocument.createElement = () => new FakeElement();

  const fineQuery = new FakeMediaQuery(finePointer);
  fineQuery.media = "(pointer: fine)";
  const motionQuery = new FakeMediaQuery(reducedMotion);
  motionQuery.media = "(prefers-reduced-motion: reduce)";
  const mediaQueries = new Map([
    [fineQuery.media, fineQuery],
    [motionQuery.media, motionQuery]
  ]);

  const fakeWindow = new FakeEventTarget();
  fakeWindow.matchMedia = (query) => mediaQueries.get(query) ?? new FakeMediaQuery(false);
  fakeWindow.getComputedStyle = () => ({ borderRadius: "4px" });

  let nextFrameId = 1;
  const animationFrames = new Map();
  const cancelledFrames = [];
  fakeWindow.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    animationFrames.set(id, callback);
    return id;
  };
  fakeWindow.cancelAnimationFrame = (id) => {
    cancelledFrames.push(id);
    animationFrames.delete(id);
  };

  return {
    animationFrames,
    body,
    cancelledFrames,
    children,
    fakeDocument,
    fakeWindow,
    fineQuery,
    motionQuery,
    runNextFrame() {
      const next = animationFrames.entries().next();
      assert.equal(next.done, false, "expected a queued animation frame");
      const [id, callback] = next.value;
      animationFrames.delete(id);
      callback(16);
    },
    drainAnimationFrames(safetyCap = 120) {
      let frameCount = 0;
      while (animationFrames.size > 0 && frameCount < safetyCap) {
        this.runNextFrame();
        frameCount += 1;
      }
      return frameCount;
    }
  };
}

async function withEnvironment(environment, callback) {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  globalThis.document = environment.fakeDocument;
  globalThis.window = environment.fakeWindow;

  try {
    await callback();
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
}

function cursorClassNames(environment) {
  return environment.children.map(({ className }) => className);
}

function assertOneActiveListenerSet(environment) {
  assert.equal(environment.fakeWindow.listenerCount("pointermove"), 1);
  assert.equal(environment.fakeWindow.listenerCount("mousemove"), 1);
  assert.equal(environment.fakeWindow.listenerCount("mousedown"), 1);
  assert.equal(environment.fakeWindow.listenerCount("mouseup"), 1);
  assert.equal(environment.fakeWindow.listenerCount("pagehide"), 1);
  assert.equal(environment.fakeWindow.listenerCount("pageshow"), 1);
  assert.equal(environment.fakeWindow.listenerCount("resize"), 1);
  assert.equal(environment.fakeWindow.listenerCount("scroll"), 1);
  assert.equal(environment.fakeDocument.listenerCount("mouseleave"), 1);
  assert.equal(environment.fakeDocument.listenerCount("mouseenter"), 1);
  assert.equal(environment.fakeDocument.listenerCount("mouseover"), 1);
  assert.equal(environment.fakeDocument.listenerCount("mouseout"), 1);
  assert.equal(environment.fakeDocument.listenerCount("visibilitychange"), 1);
}

function dispatchMovement(environment, x = 40, y = 60) {
  environment.fakeWindow.dispatch("mousemove", { clientX: x, clientY: y });
}

test("native cursor CSS is an explicit JavaScript-enabled enhancement", async () => {
  const css = await readFile(new URL("../assets/css/site.css", import.meta.url), "utf8");
  const cursorNoneRules = [...css.matchAll(/([^{}]+)\{[^{}]*cursor:\s*none\s*!important[^{}]*\}/g)];

  assert.ok(cursorNoneRules.length > 0, "expected a custom-cursor native hiding rule");
  for (const [, selectors] of cursorNoneRules) {
    assert.match(selectors, /\.custom-cursor-enabled/);
  }
  assert.doesNotMatch(css, /(?:^|,)\s*(?:html|body)\s*(?:,|\{)[^}]*cursor:\s*none/m);
});

test("ineligible documents preserve the native cursor while monitoring eligibility", async () => {
  for (const options of [{ finePointer: false }, { reducedMotion: true }]) {
    const environment = createEnvironment(options);
    await withEnvironment(environment, () => initCustomCursor());

    assert.deepEqual(environment.children, []);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), false);
    assert.equal(environment.animationFrames.size, 0);
    assert.equal(environment.fineQuery.listenerCount("change"), 1);
    assert.equal(environment.motionQuery.listenerCount("change"), 1);
    assert.equal(environment.fakeWindow.listenerCount("mousemove"), 0);
    assert.equal(environment.fakeWindow.listenerCount("pointermove"), 1);
  }
});

test("successful initialization enables exactly one cursor pair and listener set without idle RAF", async () => {
  const environment = createEnvironment();

  await withEnvironment(environment, () => {
    initCustomCursor();
    initCustomCursor();
  });

  assert.deepEqual(cursorClassNames(environment), [
    "custom-cursor-core",
    "custom-cursor-trail"
  ]);
  assert.equal(environment.body.classList.contains("custom-cursor-enabled"), true);
  assertOneActiveListenerSet(environment);
  assert.equal(environment.fineQuery.listenerCount("change"), 1);
  assert.equal(environment.motionQuery.listenerCount("change"), 1);
  assert.equal(environment.animationFrames.size, 0);
});

test("RAF converges after one pointer movement instead of scheduling forever", async (context) => {
  const environment = createEnvironment();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment, 100, 120);
    environment.fakeWindow.dispatch("mousedown");

    const frameCount = environment.drainAnimationFrames(120);

    assert.ok(frameCount > 1 && frameCount < 120, `expected finite convergence, got ${frameCount} frames`);
    assert.equal(environment.animationFrames.size, 0);
    assert.match(environment.children[0].style.transform, /100px, 120px/);
    assert.equal(environment.children[1].style.width, "12px");
    assert.equal(environment.children[1].style.height, "12px");
    context.diagnostic(`finite RAF frame count: ${frameCount}`);
  });
});

test("RAF restarts for movement and click state changes after convergence", async () => {
  const environment = createEnvironment();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment, 100, 120);
    assert.equal(environment.drainAnimationFrames(), 1);
    assert.equal(environment.animationFrames.size, 0);

    dispatchMovement(environment, 130, 150);
    assert.equal(environment.animationFrames.size, 1);
    assert.ok(environment.drainAnimationFrames() > 1);
    assert.equal(environment.animationFrames.size, 0);

    environment.fakeWindow.dispatch("mousedown");
    assert.equal(environment.animationFrames.size, 1);
    assert.ok(environment.drainAnimationFrames() > 1);
    assert.equal(environment.children[1].style.width, "12px");

    environment.fakeWindow.dispatch("mouseup");
    assert.equal(environment.animationFrames.size, 1);
    assert.ok(environment.drainAnimationFrames() > 1);
    assert.equal(environment.children[1].style.width, "32px");
  });
});

test("RAF stops outside the document and restarts only after movement", async () => {
  const environment = createEnvironment();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment, 100, 120);
    environment.fakeDocument.dispatch("mouseleave");
    assert.equal(environment.animationFrames.size, 0);
    assert.equal(environment.children[0].style.opacity, "0");
    assert.equal(environment.children[1].style.opacity, "0");

    environment.fakeDocument.dispatch("mouseenter");
    assert.equal(environment.animationFrames.size, 0);
    dispatchMovement(environment, 130, 150);
    assert.equal(environment.animationFrames.size, 1);
  });
});

test("magnetic hover converges, idles without geometry reads, and restarts when layout moves", async () => {
  const environment = createEnvironment();
  const target = new FakeElement();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment, 20, 30);
    environment.drainAnimationFrames();

    environment.fakeDocument.dispatch("mouseover", { target });
    assert.equal(environment.animationFrames.size, 1);
    assert.ok(environment.drainAnimationFrames() > 1);
    assert.equal(environment.animationFrames.size, 0);
    assert.equal(environment.children[1].style.transform, "translate3d(50px, 20px, 0) translate(-50%, -50%)");
    assert.equal(environment.children[1].style.width, "112px");
    assert.equal(environment.children[1].style.height, "48px");

    const readsAfterConvergence = target.geometryReads;
    assert.equal(environment.animationFrames.size, 0);
    assert.equal(target.geometryReads, readsAfterConvergence);

    target.rect = { left: 100, top: 80, width: 120, height: 60 };
    environment.fakeWindow.dispatch("resize");
    assert.equal(environment.animationFrames.size, 1);
    environment.drainAnimationFrames();
    assert.equal(environment.children[1].style.transform, "translate3d(160px, 110px, 0) translate(-50%, -50%)");

    target.rect = { left: 90, top: 70, width: 120, height: 60 };
    environment.fakeWindow.dispatch("scroll");
    assert.equal(environment.animationFrames.size, 1);
    environment.drainAnimationFrames();
    assert.equal(environment.children[1].style.transform, "translate3d(150px, 100px, 0) translate(-50%, -50%)");
  });
});

test("RAF pauses for hidden and pagehide lifecycle states and resumes safely", async () => {
  const environment = createEnvironment();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment);

    environment.fakeDocument.hidden = true;
    environment.fakeDocument.visibilityState = "hidden";
    environment.fakeDocument.dispatch("visibilitychange");
    assert.equal(environment.animationFrames.size, 0);

    environment.fakeDocument.hidden = false;
    environment.fakeDocument.visibilityState = "visible";
    environment.fakeDocument.dispatch("visibilitychange");
    assert.equal(environment.animationFrames.size, 1);

    environment.fakeWindow.dispatch("pagehide");
    assert.equal(environment.animationFrames.size, 0);
    environment.fakeWindow.dispatch("pageshow");
    assert.equal(environment.animationFrames.size, 1);
  });
});

test("media changes fully tear down and reinitialize one cursor", async () => {
  const environment = createEnvironment();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment);

    environment.fineQuery.setMatches(false);
    assert.deepEqual(environment.children, []);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), false);
    assert.equal(environment.body.classList.contains("cursor-clicking"), false);
    assert.equal(environment.animationFrames.size, 0);
    assert.equal(environment.fakeWindow.listenerCount("mousemove"), 0);
    assert.equal(environment.fakeDocument.listenerCount("mouseover"), 0);

    environment.fineQuery.setMatches(true);
    assert.deepEqual(cursorClassNames(environment), [
      "custom-cursor-core",
      "custom-cursor-trail"
    ]);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), true);
    assertOneActiveListenerSet(environment);
    assert.equal(environment.animationFrames.size, 0);

    environment.motionQuery.setMatches(true);
    environment.motionQuery.setMatches(false);
    assert.deepEqual(cursorClassNames(environment), [
      "custom-cursor-core",
      "custom-cursor-trail"
    ]);
    assertOneActiveListenerSet(environment);
  });
});

test("RAF fallback tears down silently lost eligibility and interaction restores one cursor", async () => {
  const environment = createEnvironment();
  await withEnvironment(environment, () => {
    initCustomCursor();
    dispatchMovement(environment);
    assert.equal(environment.animationFrames.size, 1);

    environment.motionQuery.matches = true;
    environment.runNextFrame();
    assert.deepEqual(environment.children, []);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), false);
    assert.equal(environment.animationFrames.size, 0);
    assert.equal(environment.fakeWindow.listenerCount("mousemove"), 0);
    assert.equal(environment.fakeWindow.listenerCount("pointermove"), 1);

    environment.motionQuery.matches = false;
    environment.fakeWindow.dispatch("pointermove", { clientX: 80, clientY: 90 });
    assert.deepEqual(cursorClassNames(environment), [
      "custom-cursor-core",
      "custom-cursor-trail"
    ]);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), true);
    assertOneActiveListenerSet(environment);
    assert.equal(environment.fakeWindow.listenerCount("pointermove"), 1);
    assert.equal(environment.animationFrames.size, 0);
  });
});

test("initialization before body exists retries on DOMContentLoaded", async () => {
  const environment = createEnvironment({ withBody: false });
  await withEnvironment(environment, () => {
    initCustomCursor();
    assert.equal(environment.fakeDocument.listenerCount("DOMContentLoaded"), 1);
    assert.equal(environment.animationFrames.size, 0);

    environment.fakeDocument.body = environment.body;
    environment.fakeDocument.dispatch("DOMContentLoaded");
    assert.equal(environment.fakeDocument.listenerCount("DOMContentLoaded"), 0);
    assert.deepEqual(cursorClassNames(environment), [
      "custom-cursor-core",
      "custom-cursor-trail"
    ]);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), true);
  });
});

test("partial initialization failure leaves native cursor and remains retryable", async () => {
  const environment = createEnvironment();
  const appendChild = environment.body.appendChild;
  let shouldFail = true;
  environment.body.appendChild = (element) => {
    if (shouldFail && element.className === "custom-cursor-trail") {
      shouldFail = false;
      throw new Error("simulated append failure");
    }
    return appendChild(element);
  };

  await withEnvironment(environment, () => {
    assert.throws(() => initCustomCursor(), /simulated append failure/);
    assert.deepEqual(environment.children, []);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), false);
    assert.equal(environment.fakeWindow.listenerCount("mousemove"), 0);

    initCustomCursor();
    assert.deepEqual(cursorClassNames(environment), [
      "custom-cursor-core",
      "custom-cursor-trail"
    ]);
    assert.equal(environment.body.classList.contains("custom-cursor-enabled"), true);
    assertOneActiveListenerSet(environment);
  });
});
