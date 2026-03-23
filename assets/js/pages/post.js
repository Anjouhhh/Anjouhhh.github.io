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
  const metaDesc = document.querySelector("meta[name='description']");
  if (metaDesc) metaDesc.setAttribute("content", post.summary);

  detailEl.innerHTML = `
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">${post.date} · ${post.type} · ${post.topic} · ${post.readingTime}</p>
    ${post.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
  `;

  // Reading progress bar
  const bar = document.getElementById("reading-progress");
  if (bar) {
    window.addEventListener("scroll", () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      bar.style.width = pct + "%";
    }, { passive: true });
  }
}
