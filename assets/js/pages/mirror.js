import { mirrorPosts, mirrorMeta } from "../data/mirror.js";
import { escapeHtml } from "../site.js";

const descEl = document.getElementById("mirror-description");
const listEl = document.getElementById("mirror-list");

// Render column description
if (descEl) {
  descEl.textContent = mirrorMeta.description;
}

const sorted = [...mirrorPosts].sort(
  (a, b) => new Date(b.date) - new Date(a.date)
);

if (sorted.length === 0) {
  listEl.innerHTML = `<p class="subtle">暂无文章。</p>`;
} else {
  listEl.innerHTML = sorted
    .map(
      (post) => `
    <a class="item mirror-item" href="mirror-post.html?slug=${encodeURIComponent(post.slug)}">
      <div class="mirror-item-header">
        <span class="mirror-type-badge">${escapeHtml(post.type)}</span>
        <span class="meta">${post.date}</span>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">作者：${escapeHtml(post.author)} · 来源：${escapeHtml(post.source)}</p>
      <p>${escapeHtml(post.summary)}</p>
    </a>
  `
    )
    .join("");
}
