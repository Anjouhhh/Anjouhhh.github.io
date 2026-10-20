import { renderPostDetail, renderPostNotFound } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";
import { loadPosts, localeHasPost } from "../core/content-source.js";

const locale = getPageLocale();
const otherLocale = locale === "zh" ? "en" : "zh";
const detailEl = document.getElementById("post-detail");
const backLinkEl = document.getElementById("post-back-link");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");
const languageSwitch = document.querySelector("[data-language-switch]");
const switchTargets = languageSwitch && slug
  ? otherLocaleTargets(languageSwitch.getAttribute("href") || "", slug)
  : null;

if (languageSwitch && switchTargets) {
  languageSwitch.setAttribute("href", switchTargets.writing);
}

const pagePostsPromise = loadPosts(locale);
const otherHasPostPromise = switchTargets
  ? localeHasPost(otherLocale, slug).catch(() => false)
  : Promise.resolve(false);

if (languageSwitch && switchTargets) {
  otherHasPostPromise.then((otherHasPost) => {
    if (otherHasPost) languageSwitch.setAttribute("href", switchTargets.post);
  });
}

const pagePosts = await pagePostsPromise;

const post = pagePosts.find((item) => item.slug === slug);

if (!post) {
  document.title = locale === "zh" ? "未找到文章 | Anjou Zhao" : "Post not found | Anjou Zhao";
  detailEl.innerHTML = renderPostNotFound(locale);
  if (backLinkEl) backLinkEl.hidden = true;
  markNoIndex();
} else {
  document.title = `${post.title || post.type} | Anjou Zhao`;
  const metaDesc = document.querySelector("meta[name='description']");
  if (metaDesc) metaDesc.setAttribute("content", post.summary || post.quoteText || post.type);

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

function otherLocaleTargets(href, slugValue) {
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const path = (hashIndex >= 0 ? href.slice(0, hashIndex) : href).split("?")[0];
  if (!/(^|\/)(?:post|writing)\.html$/.test(path)) return null;

  const encodedSlug = encodeURIComponent(slugValue);
  return {
    post: `${path.replace(/(?:post|writing)\.html$/, "post.html")}?slug=${encodedSlug}${hash}`,
    writing: `${path.replace(/(?:post|writing)\.html$/, "writing.html")}${hash}`
  };
}

function markNoIndex() {
  const existing = document.querySelector("meta[name='robots']");
  if (existing) {
    existing.setAttribute("content", "noindex");
    return;
  }
  if (typeof document.createElement !== "function" || !document.head?.appendChild) return;

  const meta = document.createElement("meta");
  meta.setAttribute("name", "robots");
  meta.setAttribute("content", "noindex");
  document.head.appendChild(meta);
}
