import { projects } from "../data/projects.js";
import { escapeHtml } from "../site.js";

const listEl = document.getElementById("project-list");

const sorted = [...projects].sort((a, b) => new Date(b.updated) - new Date(a.updated));
listEl.innerHTML = sorted
  .map(
    (project) => `
    <a class="card" href="project.html?slug=${encodeURIComponent(project.slug)}">
      <div class="section-head">
        <h3>${escapeHtml(project.title)}</h3>
        <span class="status ${project.status}">${project.status}</span>
      </div>
      <p>${escapeHtml(project.summary)}</p>
      <p class="meta">Updated ${project.updated}</p>
      <div class="tag-row">
        ${project.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
      </div>
    </a>
  `
  )
  .join("");
