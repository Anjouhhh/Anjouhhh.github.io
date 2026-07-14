import { mirrorPosts } from "../data/mirror.js";
import { escapeHtml } from "../site.js";

const detailEl = document.getElementById("mirror-post-detail");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const post = mirrorPosts.find((item) => item.slug === slug);

if (!post) {
  detailEl.innerHTML =
    "<h1>文章未找到</h1><p class='subtle'>请检查链接或返回 Mirror 专栏。</p>";
} else {
  document.title = `${post.title} | Mirror | Anjou Zhao`;
  const metaDesc = document.querySelector("meta[name='description']");
  if (metaDesc) metaDesc.setAttribute("content", post.summary);

  const sourceLink = post.sourceUrl
    ? `<a href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="mirror-source-link">查看原文 ↗</a>`
    : "";

  detailEl.innerHTML = `
    <div class="mirror-post-header">
      <span class="mirror-type-badge">${escapeHtml(post.type)}</span>
    </div>
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">
      作者：${escapeHtml(post.author)} · 来源：${escapeHtml(post.source)} · ${post.date}
    </p>
    ${sourceLink}
    <div class="mirror-post-body">
      ${post.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
    <div class="mirror-post-footer">
      ${sourceLink ? `<p class="subtle">本文转载自 <a href="${escapeHtml(post.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.source)}</a>，原作者：${escapeHtml(post.author)}。</p>` : ""}
    </div>
  `;

  // Reading progress bar
  const bar = document.getElementById("reading-progress");
  if (bar) {
    window.addEventListener(
      "scroll",
      () => {
        const scrollTop = window.scrollY;
        const docHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const pct =
          docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
        bar.style.width = pct + "%";
      },
      { passive: true }
    );
  }
}
