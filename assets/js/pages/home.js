import { posts } from "../data/posts.js";
import { projects } from "../data/projects.js";
import { nowSnapshot } from "../data/now.js";
import { escapeHtml } from "../site.js";

const homePosts = document.getElementById("home-posts");
const homeProjects = document.getElementById("home-projects");
const homeNow = document.getElementById("home-now");

const recentPosts = [...posts]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 3);

homePosts.innerHTML = recentPosts
  .map(
    (post) => `
    <a class="item" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${post.date} · ${post.topic} · ${post.readingTime}</p>
      <p>${escapeHtml(post.summary)}</p>
    </a>`
  )
  .join("");

const featuredProjects = projects.filter((project) => project.featured).slice(0, 2);
homeProjects.innerHTML = featuredProjects
  .map(
    (project) => `
    <a class="card" href="project.html?slug=${encodeURIComponent(project.slug)}">
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.summary)}</p>
      <div class="tag-row">
        ${project.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </a>`
  )
  .join("");

homeNow.innerHTML = `
  <p class="meta">Updated ${nowSnapshot.updatedAt}</p>
  <p><strong>Learning:</strong> ${escapeHtml(nowSnapshot.learning[0])}</p>
  <p><strong>Building:</strong> ${escapeHtml(nowSnapshot.building[0])}</p>
  <p><strong>Thinking:</strong> ${escapeHtml(nowSnapshot.thinking[0])}</p>
`;
