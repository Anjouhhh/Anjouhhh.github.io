// Custom cursor progressive enhancement: core dot, lagged trail, magnetic hover,
// click compression, and dynamic pointer/reduced-motion lifecycle handling.

const documentControllers = new WeakMap();
const ENABLED_CLASS = "custom-cursor-enabled";
const STATE_CLASSES = [
  "cursor-clicking",
  "cursor-hovering-magnetic",
  "cursor-hovering-general"
];
const INTERACTIVE_SELECTOR = 'a, button, .chip, #scroll-top, [role="button"]';
const VISUAL_EPSILON = 0.1;

function addMediaListener(query, listener) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }

  if (typeof query.addListener === "function") {
    query.addListener(listener);
    return () => query.removeListener(listener);
  }

  return () => {};
}

function createCursorController(cursorWindow, cursorDocument) {
  const finePointerQuery = cursorWindow.matchMedia("(pointer: fine)");
  const reducedMotionQuery = cursorWindow.matchMedia("(prefers-reduced-motion: reduce)");
  let active = null;
  let waitingForBody = false;
  let reconciling = false;

  const isEligible = () => finePointerQuery.matches && !reducedMotionQuery.matches;

  function clearBodyClasses(body = cursorDocument.body) {
    if (!body?.classList) return;
    body.classList.remove(ENABLED_CLASS, ...STATE_CLASSES);
  }

  function stopActiveCursor() {
    if (!active) {
      clearBodyClasses();
      return;
    }

    active.stopAnimation();
    for (const removeListener of active.removeListeners.reverse()) removeListener();
    active.core.remove();
    active.trail.remove();
    clearBodyClasses(active.body);
    active = null;
  }

  function retryWhenBodyIsReady() {
    if (waitingForBody) return;
    waitingForBody = true;

    const onReady = () => {
      waitingForBody = false;
      cursorDocument.removeEventListener("DOMContentLoaded", onReady);
      reconcile();
    };

    cursorDocument.addEventListener("DOMContentLoaded", onReady);
  }

  function startActiveCursor() {
    const body = cursorDocument.body;
    if (!body) {
      retryWhenBodyIsReady();
      return;
    }

    const core = cursorDocument.createElement("div");
    core.className = "custom-cursor-core";
    core.style.opacity = "0";

    const trail = cursorDocument.createElement("div");
    trail.className = "custom-cursor-trail";
    trail.style.opacity = "0";

    const removeListeners = [];
    const removeOnFailure = [];
    let frameId = null;
    let mouseX = 0;
    let mouseY = 0;
    let coreX = 0;
    let coreY = 0;
    let trailX = 0;
    let trailY = 0;
    let trailWidth = 32;
    let trailHeight = 32;
    let trailBorderRadius = "50%";
    let hasMoved = false;
    let outsideDocument = false;
    let pageHidden = cursorDocument.hidden || cursorDocument.visibilityState === "hidden";
    let pageSuspended = false;
    let isClicking = false;
    let isMagnetic = false;
    let isHoveringGeneral = false;
    let hoveredElement = null;
    let cachedBorderRadius = "50%";

    const lerp = (start, end, amount) => (1 - amount) * start + amount * end;
    const converge = (start, end) => {
      const next = lerp(start, end, 0.18);
      return Math.abs(end - next) <= VISUAL_EPSILON ? end : next;
    };
    const needsConvergence = (value, target) => Math.abs(target - value) > VISUAL_EPSILON;
    const canAnimate = () => (
      active?.core === core &&
      hasMoved &&
      !outsideDocument &&
      !pageHidden &&
      !pageSuspended &&
      isEligible()
    );

    function cancelAnimation() {
      if (frameId === null) return;
      cursorWindow.cancelAnimationFrame(frameId);
      frameId = null;
    }

    function scheduleAnimation() {
      if (frameId !== null || !canAnimate()) return;
      frameId = cursorWindow.requestAnimationFrame(tick);
    }

    function hideCursor() {
      core.style.opacity = "0";
      trail.style.opacity = "0";
    }

    function showCursor() {
      if (!hasMoved) return;
      core.style.opacity = "1";
      trail.style.opacity = "1";
    }

    function tick() {
      frameId = null;
      if (!isEligible()) {
        reconcile();
        return;
      }
      if (!canAnimate()) return;

      coreX = mouseX;
      coreY = mouseY;

      let targetX = mouseX;
      let targetY = mouseY;
      let targetWidth;
      let targetHeight;

      if (isMagnetic && hoveredElement) {
        const rect = hoveredElement.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
        targetWidth = rect.width + 12;
        targetHeight = rect.height + 8;
        trailBorderRadius = cachedBorderRadius;
      } else if (isHoveringGeneral) {
        targetWidth = 56;
        targetHeight = 56;
        trailBorderRadius = "50%";
      } else {
        targetWidth = isClicking ? 12 : 32;
        targetHeight = targetWidth;
        trailBorderRadius = "50%";
      }

      trailX = converge(trailX, targetX);
      trailY = converge(trailY, targetY);
      trailWidth = converge(trailWidth, targetWidth);
      trailHeight = converge(trailHeight, targetHeight);

      core.style.transform = `translate3d(${coreX}px, ${coreY}px, 0) translate(-50%, -50%)`;
      trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0) translate(-50%, -50%)`;
      trail.style.width = `${trailWidth}px`;
      trail.style.height = `${trailHeight}px`;
      trail.style.borderRadius = trailBorderRadius;

      if (
        needsConvergence(trailX, targetX) ||
        needsConvergence(trailY, targetY) ||
        needsConvergence(trailWidth, targetWidth) ||
        needsConvergence(trailHeight, targetHeight)
      ) {
        scheduleAnimation();
      }
    }

    function listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      const remove = () => target.removeEventListener(type, listener, options);
      removeListeners.push(remove);
      removeOnFailure.push(remove);
    }

    try {
      body.appendChild(core);
      removeOnFailure.push(() => core.remove());
      body.appendChild(trail);
      removeOnFailure.push(() => trail.remove());

      listen(cursorWindow, "mousemove", (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;

        if (!hasMoved) {
          coreX = mouseX;
          coreY = mouseY;
          trailX = mouseX;
          trailY = mouseY;
          hasMoved = true;
        }

        showCursor();
        scheduleAnimation();
      }, { passive: true });

      listen(cursorWindow, "mousedown", () => {
        isClicking = true;
        body.classList.add("cursor-clicking");
        scheduleAnimation();
      });

      listen(cursorWindow, "mouseup", () => {
        isClicking = false;
        body.classList.remove("cursor-clicking");
        scheduleAnimation();
      });

      listen(cursorDocument, "mouseleave", () => {
        outsideDocument = true;
        hideCursor();
        cancelAnimation();
      });

      listen(cursorDocument, "mouseenter", () => {
        outsideDocument = false;
        showCursor();
      });

      listen(cursorDocument, "mouseover", (event) => {
        const interactiveElement = event.target.closest(INTERACTIVE_SELECTOR);
        if (!interactiveElement) return;

        const isLargeCard = interactiveElement.classList.contains("panel") ||
          interactiveElement.classList.contains("card") ||
          interactiveElement.classList.contains("item");

        hoveredElement = interactiveElement;
        if (isLargeCard) {
          isHoveringGeneral = true;
          isMagnetic = false;
          body.classList.remove("cursor-hovering-magnetic");
          body.classList.add("cursor-hovering-general");
          scheduleAnimation();
          return;
        }

        isMagnetic = true;
        isHoveringGeneral = false;
        body.classList.remove("cursor-hovering-general");
        body.classList.add("cursor-hovering-magnetic");
        const radius = cursorWindow.getComputedStyle(interactiveElement).borderRadius;
        cachedBorderRadius = radius && radius !== "0px" ? radius : "4px";
        scheduleAnimation();
      });

      listen(cursorDocument, "mouseout", (event) => {
        const interactiveElement = event.target.closest(INTERACTIVE_SELECTOR);
        if (!interactiveElement || interactiveElement.contains(event.relatedTarget)) return;

        isMagnetic = false;
        isHoveringGeneral = false;
        hoveredElement = null;
        body.classList.remove("cursor-hovering-magnetic", "cursor-hovering-general");
        scheduleAnimation();
      });

      const scheduleMagneticLayoutUpdate = () => {
        if (isMagnetic && hoveredElement) scheduleAnimation();
      };
      listen(cursorWindow, "resize", scheduleMagneticLayoutUpdate, { passive: true });
      listen(cursorWindow, "scroll", scheduleMagneticLayoutUpdate, { passive: true });

      listen(cursorDocument, "visibilitychange", () => {
        pageHidden = cursorDocument.hidden || cursorDocument.visibilityState === "hidden";
        if (pageHidden) {
          hideCursor();
          cancelAnimation();
          return;
        }
        showCursor();
        scheduleAnimation();
      });

      listen(cursorWindow, "pagehide", () => {
        pageSuspended = true;
        hideCursor();
        cancelAnimation();
      });

      listen(cursorWindow, "pageshow", () => {
        pageSuspended = false;
        pageHidden = cursorDocument.hidden || cursorDocument.visibilityState === "hidden";
        showCursor();
        scheduleAnimation();
      });

      active = {
        body,
        core,
        trail,
        removeListeners,
        stopAnimation: cancelAnimation
      };
      body.classList.add(ENABLED_CLASS);
    } catch (error) {
      active = null;
      cancelAnimation();
      for (const cleanup of removeOnFailure.reverse()) cleanup();
      clearBodyClasses(body);
      throw error;
    }
  }

  function reconcile() {
    if (reconciling) return;
    reconciling = true;
    try {
      if (!isEligible()) {
        stopActiveCursor();
        return;
      }
      if (!active) startActiveCursor();
    } finally {
      reconciling = false;
    }
  }

  const onEligibilityChange = () => reconcile();
  const removeFineListener = addMediaListener(finePointerQuery, onEligibilityChange);
  try {
    addMediaListener(reducedMotionQuery, onEligibilityChange);
  } catch (error) {
    removeFineListener();
    throw error;
  }

  cursorWindow.addEventListener("pointermove", () => {
    if (!active || !isEligible()) reconcile();
  }, { passive: true });

  return { reconcile };
}

export function initCustomCursor() {
  const cursorWindow = window;
  const cursorDocument = document;
  let controller = documentControllers.get(cursorDocument);

  if (!controller) {
    controller = createCursorController(cursorWindow, cursorDocument);
    documentControllers.set(cursorDocument, controller);
  }

  controller.reconcile();
}
