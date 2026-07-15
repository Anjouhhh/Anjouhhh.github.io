import { renderPostDetail, renderPostNotFound } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";
import { loadPosts } from "../core/content-source.js";

const locale = getPageLocale();
const pagePosts = await loadPosts(locale);
const detailEl = document.getElementById("post-detail");
const backLinkEl = document.getElementById("post-back-link");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const post = pagePosts.find((item) => item.slug === slug);

if (!post) {
  document.title = locale === "zh" ? "未找到文章 | Anjou Zhao" : "Post not found | Anjou Zhao";
  detailEl.innerHTML = renderPostNotFound(locale);
  if (backLinkEl) backLinkEl.hidden = true;
} else {
  document.title = `${post.title} | Anjou Zhao`;
  const metaDesc = document.querySelector("meta[name='description']");
  if (metaDesc) metaDesc.setAttribute("content", post.summary);

  detailEl.innerHTML = renderPostDetail(post, locale);

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
