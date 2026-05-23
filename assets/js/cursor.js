// Custom Cursor Effect matching Moonshot AI (https://www.moonshot.cn/)
// Features: Core dot + lagged trail circle, magnetic snapping/morphing on buttons/links,
// click compression, touch device bypass.

export function initCustomCursor() {
  // Only enable on devices with a mouse/fine pointer
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (!isFinePointer) return;

  // Create cursor DOM elements
  const core = document.createElement("div");
  core.className = "custom-cursor-core";
  core.style.opacity = "0"; // hidden until first movement

  const trail = document.createElement("div");
  trail.className = "custom-cursor-trail";
  trail.style.opacity = "0";

  document.body.appendChild(core);
  document.body.appendChild(trail);

  // Position and state tracking variables
  let mouseX = 0;
  let mouseY = 0;
  let coreX = 0;
  let coreY = 0;
  let trailX = 0;
  let trailY = 0;
  let trailWidth = 32;
  let trailHeight = 32;
  let trailBorderRadius = "50%";

  let initialized = false;
  let isClicking = false;
  let isMagnetic = false;
  let isHoveringGeneral = false;
  let hoveredElement = null;
  let cachedBorderRadius = "50%";

  const LERP_FACTOR = 0.18; // speed of the lag effect

  // Mouse move listener
  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!initialized) {
      // Fade in on first movement and sync positions
      core.style.opacity = "1";
      trail.style.opacity = "1";
      coreX = mouseX;
      coreY = mouseY;
      trailX = mouseX;
      trailY = mouseY;
      initialized = true;
    }
  }, { passive: true });

  // Mouse down/up listeners for click compression effect
  window.addEventListener("mousedown", () => {
    isClicking = true;
    document.body.classList.add("cursor-clicking");
  });

  window.addEventListener("mouseup", () => {
    isClicking = false;
    document.body.classList.remove("cursor-clicking");
  });

  // Keep cursor hidden when mouse leaves window
  document.addEventListener("mouseleave", () => {
    core.style.opacity = "0";
    trail.style.opacity = "0";
  });

  document.addEventListener("mouseenter", () => {
    if (initialized) {
      core.style.opacity = "1";
      trail.style.opacity = "1";
    }
  });

  // Event delegation to detect hovered interactive elements
  document.addEventListener("mouseover", (e) => {
    const interactiveEl = e.target.closest('a, button, .chip, #scroll-top, [role="button"]');
    if (!interactiveEl) return;

    // Check if it is a large panel/card that shouldn't snap but should scale the cursor
    const isLargeCard = interactiveEl.classList.contains("panel") || 
                        interactiveEl.classList.contains("card") || 
                        interactiveEl.classList.contains("item");

    if (isLargeCard) {
      isHoveringGeneral = true;
      isMagnetic = false;
      hoveredElement = interactiveEl;
      document.body.classList.add("cursor-hovering-general");
    } else {
      isMagnetic = true;
      isHoveringGeneral = false;
      hoveredElement = interactiveEl;
      document.body.classList.add("cursor-hovering-magnetic");

      // Cache computed style once to avoid layout thrashing in requestAnimationFrame
      const style = window.getComputedStyle(interactiveEl);
      let r = style.borderRadius;
      if (r === "0px" || !r) {
        cachedBorderRadius = "4px"; // fallback for square/near-square elements
      } else {
        cachedBorderRadius = r;
      }
    }
  });

  document.addEventListener("mouseout", (e) => {
    const interactiveEl = e.target.closest('a, button, .chip, #scroll-top, [role="button"]');
    if (!interactiveEl) return;

    // Check if mouse actually left the interactive element boundary
    if (interactiveEl.contains(e.relatedTarget)) return;

    isMagnetic = false;
    isHoveringGeneral = false;
    hoveredElement = null;
    document.body.classList.remove("cursor-hovering-magnetic", "cursor-hovering-general");
  });

  // Linear Interpolation helper
  const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

  // Animation Loop
  function tick() {
    if (!initialized) {
      requestAnimationFrame(tick);
      return;
    }

    // Core instantly moves to mouse position
    coreX = mouseX;
    coreY = mouseY;

    if (isMagnetic && hoveredElement) {
      // Magnetic snapping - target is the center of the hovered element
      const rect = hoveredElement.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;

      trailX = lerp(trailX, targetX, LERP_FACTOR);
      trailY = lerp(trailY, targetY, LERP_FACTOR);

      // Snap trail size to match element dimensions plus some padding
      const paddingX = 12;
      const paddingY = 8;
      trailWidth = lerp(trailWidth, rect.width + paddingX, LERP_FACTOR);
      trailHeight = lerp(trailHeight, rect.height + paddingY, LERP_FACTOR);
      trailBorderRadius = cachedBorderRadius;
    } else if (isHoveringGeneral) {
      // Hovering a large card - cursor remains centered on mouse but grows in size
      trailX = lerp(trailX, mouseX, LERP_FACTOR);
      trailY = lerp(trailY, mouseY, LERP_FACTOR);
      
      const targetSize = 56;
      trailWidth = lerp(trailWidth, targetSize, LERP_FACTOR);
      trailHeight = lerp(trailHeight, targetSize, LERP_FACTOR);
      trailBorderRadius = "50%";
    } else {
      // Normal state - trail lags behind mouse coordinates
      trailX = lerp(trailX, mouseX, LERP_FACTOR);
      trailY = lerp(trailY, mouseY, LERP_FACTOR);

      const targetSize = isClicking ? 12 : 32;
      trailWidth = lerp(trailWidth, targetSize, LERP_FACTOR);
      trailHeight = lerp(trailHeight, targetSize, LERP_FACTOR);
      trailBorderRadius = "50%";
    }

    // Update style positioning via transform
    core.style.transform = `translate3d(${coreX}px, ${coreY}px, 0) translate(-50%, -50%)`;
    
    trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0) translate(-50%, -50%)`;
    trail.style.width = `${trailWidth}px`;
    trail.style.height = `${trailHeight}px`;
    trail.style.borderRadius = trailBorderRadius;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}
