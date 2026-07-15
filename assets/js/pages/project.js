import { projects } from "../data/projects.js";
import { projectsZh } from "../data/zh/projects.js";
import { renderProjectDetail, renderProjectNotFound } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";

const locale = getPageLocale();
const pageProjects = locale === "zh" ? projectsZh : projects;
const detailEl = document.getElementById("project-detail");
const backLinkEl = document.getElementById("project-back-link");
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const project = pageProjects.find((item) => item.slug === slug);

if (!project) {
  document.title = locale === "zh" ? "未找到项目 | Anjou Zhao" : "Project not found | Anjou Zhao";
  detailEl.innerHTML = renderProjectNotFound(locale);
  if (backLinkEl) backLinkEl.hidden = true;
} else {
  document.title = `${project.title} | Anjou Zhao`;
  detailEl.innerHTML = renderProjectDetail(project, locale);
}
