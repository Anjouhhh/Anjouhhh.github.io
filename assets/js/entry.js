const body = document.body;
const shell = document.getElementById("entry-shell");
const door = document.getElementById("portal-door");
const status = document.getElementById("entry-status");
const veil = document.getElementById("transition-veil");
const farField = document.getElementById("stars-far");
const nearField = document.getElementById("stars-near");

if (body && shell && door && status && veil && farField && nearField) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let entering = false;
  let starsBuilt = false;
  let pointerFrame = null;
  let pointerPosition = { x: 0, y: 0 };
  let navigationTimeout = null;

  function randomFactory(seed) {
    let value = seed >>> 0;
    return function random() {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function createStar(field, random, index, near) {
    const star = document.createElement("span");
    const x = random() * 100;
    const y = random() * (near ? 82 : 94);
    const isCross = index % (near ? 4 : 13) === 0;
    const isGold = index % (near ? 3 : 11) === 0;
    const size = near ? 2.4 + random() * 4.2 : 0.8 + random() * 1.9;

    star.className = `star${isCross ? " star--cross" : ""}${isGold ? " star--gold" : ""}`;
    star.style.left = `${x.toFixed(2)}%`;
    star.style.top = `${y.toFixed(2)}%`;
    star.style.setProperty("--size", `${(isCross ? size * 1.9 : size).toFixed(2)}px`);
    star.style.setProperty("--alpha", (0.24 + random() * (near ? 0.5 : 0.34)).toFixed(2));
    star.style.setProperty("--duration", `${(5.5 + random() * 6).toFixed(2)}s`);
    star.style.setProperty("--delay", `${(-random() * 8).toFixed(2)}s`);
    field.appendChild(star);
  }

  function buildStars() {
    if (starsBuilt) return;
    starsBuilt = true;

    const random = randomFactory(19062026);
    const farFragment = document.createDocumentFragment();
    const nearFragment = document.createDocumentFragment();

    for (let index = 0; index < 70; index += 1) createStar(farFragment, random, index, false);
    for (let index = 0; index < 15; index += 1) createStar(nearFragment, random, index, true);

    farField.appendChild(farFragment);
    nearField.appendChild(nearFragment);
  }

  function updatePortalOrigin() {
    const rect = door.getBoundingClientRect();
    const viewportWidth = Math.max(window.innerWidth, 1);
    const viewportHeight = Math.max(window.innerHeight, 1);
    const x = ((rect.left + rect.width * 0.5) / viewportWidth) * 100;
    const y = ((rect.top + rect.height * 0.58) / viewportHeight) * 100;

    shell.style.setProperty("--portal-x", `${x.toFixed(2)}%`);
    shell.style.setProperty("--portal-y", `${y.toFixed(2)}%`);
  }

  function isUnmodifiedPrimaryActivation(event) {
    return !event.defaultPrevented
      && event.button === 0
      && !event.altKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.shiftKey;
  }

  function enterBlog(event) {
    if (!isUnmodifiedPrimaryActivation(event)) return;

    event.preventDefault();
    if (entering) return;

    entering = true;
    updatePortalOrigin();
    door.setAttribute("aria-disabled", "true");
    status.textContent = "Entering Anjou's personal blog";
    door.classList.add("is-entering");
    body.classList.add("is-entering");

    navigationTimeout = window.setTimeout(() => {
      navigationTimeout = null;
      window.location.assign(door.href);
    }, reducedMotion.matches ? 200 : 1580);
  }

  function writePointerPosition() {
    pointerFrame = null;
    if (entering || reducedMotion.matches) return;

    const { x, y } = pointerPosition;
    body.style.setProperty("--far-x", `${(x * -0.12).toFixed(2)}px`);
    body.style.setProperty("--far-y", `${(y * -0.12).toFixed(2)}px`);
    body.style.setProperty("--near-x", `${(x * 0.3).toFixed(2)}px`);
    body.style.setProperty("--near-y", `${(y * 0.3).toFixed(2)}px`);
    body.style.setProperty("--orbit-x", `${(x * 0.16).toFixed(2)}px`);
    body.style.setProperty("--orbit-y", `${(y * 0.16).toFixed(2)}px`);
  }

  function handlePointerMove(event) {
    if (entering || reducedMotion.matches) return;

    pointerPosition = {
      x: (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 10,
      y: (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 7
    };

    if (pointerFrame === null) {
      pointerFrame = window.requestAnimationFrame(writePointerPosition);
    }
  }

  function handlePageHide() {
    if (pointerFrame === null) return;
    window.cancelAnimationFrame(pointerFrame);
    pointerFrame = null;
  }

  function resetEntryTransition() {
    entering = false;
    if (navigationTimeout !== null) window.clearTimeout(navigationTimeout);
    navigationTimeout = null;
    if (pointerFrame !== null) window.cancelAnimationFrame(pointerFrame);
    pointerFrame = null;
    body.classList.remove("is-entering");
    door.classList.remove("is-entering");
    door.removeAttribute("aria-disabled");
    status.textContent = "";
  }

  function handlePageShow(event) {
    if (!event.persisted) return;
    resetEntryTransition();
  }

  buildStars();
  updatePortalOrigin();
  door.addEventListener("click", enterBlog);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("resize", updatePortalOrigin, { passive: true });
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("pageshow", handlePageShow);
}
