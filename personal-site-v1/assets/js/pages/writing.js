import { posts } from "../data/posts.js";
import { escapeHtml } from "../site.js";

const listEl = document.getElementById("post-list");
const chipEl = document.getElementById("topic-chips");

const topics = [...new Set(posts.map((p) => p.topic))];
chipEl.innerHTML = topics.map((topic) => `<span class="chip">${escapeHtml(topic)}</span>`).join("");

const sorted = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
listEl.innerHTML = sorted
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
