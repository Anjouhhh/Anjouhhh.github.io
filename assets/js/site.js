const page = document.body.dataset.page;
document.querySelectorAll("nav a").forEach((link) => {
  const href = link.getAttribute("href");
  const map = {
    "index.html": "home",
    "about.html": "about",
    "writing.html": "writing",
    "projects.html": "projects",
    "now.html": "now"
  };
  if (map[href] === page) {
    link.classList.add("active");
  }
});

const year = document.getElementById("year");
if (year) {
  year.textContent = String(new Date().getFullYear());
}

// Hamburger nav toggle
const toggle = document.getElementById("nav-toggle");
const navEl = document.querySelector("nav");
if (toggle && navEl) {
  toggle.addEventListener("click", () => {
    const isOpen = navEl.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
  // Close nav when a link is clicked
  navEl.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      navEl.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  // Close nav when clicking outside
  document.addEventListener("click", (e) => {
    if (!toggle.contains(e.target) && !navEl.contains(e.target)) {
      navEl.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

// Scroll-to-top button
const scrollBtn = document.getElementById("scroll-top");
if (scrollBtn) {
  window.addEventListener("scroll", () => {
    scrollBtn.classList.toggle("visible", window.scrollY > 400);
  }, { passive: true });
  scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
