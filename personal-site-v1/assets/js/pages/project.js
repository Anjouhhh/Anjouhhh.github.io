import { projects } from "../data/projects.js";
import { escapeHtml } from "../site.js";

const detailEl = document.getElementById("project-detail");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const project = projects.find((item) => item.slug === slug);

if (!project) {
  detailEl.innerHTML = "<h1>Project not found</h1><p class='subtle'>Check the URL or return to the project index.</p>";
} else {
  document.title = `${project.title} | Anjou Zhao`;
  detailEl.innerHTML = `
    <h1>${escapeHtml(project.title)}</h1>
    <p class="meta">Status: ${project.status} · Updated ${project.updated}</p>
    <p>${escapeHtml(project.summary)}</p>
    ${project.details.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <div class="tag-row">
      ${project.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}
