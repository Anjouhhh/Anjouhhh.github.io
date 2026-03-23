import { posts } from "../data/posts.js";
import { escapeHtml } from "../site.js";

const listEl = document.getElementById("post-list");
const chipEl = document.getElementById("topic-chips");

const topics = [...new Set(posts.map((p) => p.topic))];
const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

let activeTopic = null;

function renderPosts() {
  const filtered = activeTopic ? sorted.filter((p) => p.topic === activeTopic) : sorted;
  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="subtle">No posts in this topic yet.</p>`;
    return;
  }
  listEl.innerHTML = filtered
    .map(
      (post) => `
    <a class="item" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${post.date} · ${post.type} · ${post.topic} · ${post.readingTime}</p>
      <p>${escapeHtml(post.summary)}</p>
    </a>
  `
    )
    .join("");
}

// Render "All" chip + topic chips
chipEl.innerHTML =
  `<span class="chip active" data-topic="">All</span>` +
  topics.map((topic) => `<span class="chip" data-topic="${escapeHtml(topic)}">${escapeHtml(topic)}</span>`).join("");

chipEl.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  chipEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeTopic = chip.dataset.topic || null;
  renderPosts();
});

renderPosts();
