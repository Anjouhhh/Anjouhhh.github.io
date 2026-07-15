import { renderTopicButtons, renderWritingPosts } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";
import { configureJantAdminLink, loadPosts } from "../core/content-source.js";

const locale = getPageLocale();
configureJantAdminLink(document, locale);
const pagePosts = await loadPosts(locale);
const listEl = document.getElementById("post-list");
const chipEl = document.getElementById("topic-chips");

const topics = [...new Set(pagePosts.map((p) => p.topic))];
const sorted = [...pagePosts].sort((a, b) => new Date(b.date) - new Date(a.date));

let activeTopic = "";

function renderPosts() {
  const filtered = activeTopic ? sorted.filter((post) => post.topic === activeTopic) : sorted;
  listEl.innerHTML = renderWritingPosts(filtered, locale);
}

chipEl.innerHTML = renderTopicButtons(topics, activeTopic, locale);

chipEl.addEventListener("click", (event) => {
  const selectedButton = event.target.closest(".chip");
  if (!selectedButton) return;

  chipEl.querySelectorAll(".chip").forEach((button) => {
    const selected = button === selectedButton;
    button.classList[selected ? "add" : "remove"]("active");
    button.setAttribute("aria-pressed", String(selected));
  });
  activeTopic = selectedButton.dataset.topic;
  renderPosts();
});

renderPosts();
