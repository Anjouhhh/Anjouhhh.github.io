import { posts } from "../data/posts.js";
import { renderPostDetail, renderPostNotFound } from "../core/templates.js";

const detailEl = document.getElementById("post-detail");
const backLinkEl = document.getElementById("post-back-link");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const post = posts.find((item) => item.slug === slug);

if (!post) {
  document.title = "Post not found | Anjou Zhao";
  detailEl.innerHTML = renderPostNotFound();
  if (backLinkEl) backLinkEl.hidden = true;
} else {
  document.title = `${post.title} | Anjou Zhao`;
  const metaDesc = document.querySelector("meta[name='description']");
  if (metaDesc) metaDesc.setAttribute("content", post.summary);

  detailEl.innerHTML = renderPostDetail(post);

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
