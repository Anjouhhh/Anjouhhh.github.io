const initializedDocuments = new WeakSet();

const hrefByPage = {
  home: "home.html",
  about: "about.html",
  writing: "writing.html",
  projects: "projects.html",
  now: "now.html"
};

function isCurrentPageLink(link, page) {
  const expectedHref = hrefByPage[page];
  const href = link.getAttribute("href");
  if (!expectedHref || !href) return false;

  try {
    const baseUrl = new URL(document.baseURI ?? window.location.href);
    const linkUrl = new URL(href, baseUrl);
    const expectedUrl = new URL(expectedHref, baseUrl);
    return linkUrl.origin === expectedUrl.origin && linkUrl.pathname === expectedUrl.pathname;
  } catch {
    return false;
  }
}

export function initSiteShell() {
  if (initializedDocuments.has(document)) return;
  initializedDocuments.add(document);

  const page = document.body.dataset.page;
  document.querySelectorAll("[data-language-switch]").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || !window.location.search) return;

    const hashIndex = href.indexOf("#");
    const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
    const path = (hashIndex >= 0 ? href.slice(0, hashIndex) : href).split("?")[0];
    link.setAttribute("href", `${path}${window.location.search}${hash}`);
  });

  document.querySelectorAll("nav a").forEach((link) => {
    const active = isCurrentPageLink(link, page);
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  const toggle = document.getElementById("nav-toggle");
  const nav = document.querySelector("nav");
  if (toggle && nav) {
    const closeNavigation = () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeNavigation);
    });

    document.addEventListener("click", (event) => {
      if (!toggle.contains(event.target) && !nav.contains(event.target)) {
        closeNavigation();
      }
    });

    const mobileNavigationQuery = window.matchMedia("(max-width: 580px)");
    mobileNavigationQuery.addEventListener("change", (event) => {
      if (!event.matches) closeNavigation();
    });

    document.documentElement.classList.add("site-navigation-enhanced");
  }

  const scrollButton = document.getElementById("scroll-top");
  if (scrollButton) {
    window.addEventListener("scroll", () => {
      scrollButton.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });

    scrollButton.addEventListener("click", () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }
}
