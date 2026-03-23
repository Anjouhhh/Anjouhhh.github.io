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

export function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
