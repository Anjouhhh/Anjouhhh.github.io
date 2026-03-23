import { posts } from "../data/posts.js";
import { escapeHtml } from "../site.js";

const detailEl = document.getElementById("post-detail");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const post = posts.find((item) => item.slug === slug);

if (!post) {
  detailEl.innerHTML = "<h1>Post not found</h1><p class='subtle'>Check the URL or return to the writing index.</p>";
} else {
  document.title = `${post.title} | Anjou Zhao`;
  detailEl.innerHTML = `
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">${post.date} · ${post.type} · ${post.topic} · ${post.readingTime}</p>
    ${post.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
  `;
}
