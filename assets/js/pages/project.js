import { projects } from "../data/projects.js";
import { renderProjectDetail, renderProjectNotFound } from "../core/templates.js";

const detailEl = document.getElementById("project-detail");
const backLinkEl = document.getElementById("project-back-link");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const project = projects.find((item) => item.slug === slug);

if (!project) {
  document.title = "Project not found | Anjou Zhao";
  detailEl.innerHTML = renderProjectNotFound();
  if (backLinkEl) backLinkEl.hidden = true;
} else {
  document.title = `${project.title} | Anjou Zhao`;
  detailEl.innerHTML = renderProjectDetail(project);
}
