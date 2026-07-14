import { posts } from "../data/posts.js";
import { projects } from "../data/projects.js";
import { mirrorPosts } from "../data/mirror.js";
import { nowSnapshot } from "../data/now.js";
import { renderHomeNow, renderHomePosts, renderHomeProjects } from "../core/templates.js";
import { escapeHtml } from "../core/dom.js";

const homePosts = document.getElementById("home-posts");
const homeMirror = document.getElementById("home-mirror");
const homeProjects = document.getElementById("home-projects");
const homeNow = document.getElementById("home-now");

const recentPosts = [...posts]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 3);

homePosts.innerHTML = renderHomePosts(recentPosts);

// Mirror posts on home
const recentMirror = [...mirrorPosts]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 2);

if (homeMirror) {
  homeMirror.innerHTML = recentMirror
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
    </a>`
    )
    .join("");
}

const featuredProjects = projects.filter((project) => project.featured).slice(0, 2);
homeProjects.innerHTML = renderHomeProjects(featuredProjects);

homeNow.innerHTML = renderHomeNow(nowSnapshot);
