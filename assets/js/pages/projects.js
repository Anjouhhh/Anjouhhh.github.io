import { projects } from "../data/projects.js";
import { projectsZh } from "../data/zh/projects.js";
import { renderProjectList } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";

const locale = getPageLocale();
const pageProjects = locale === "zh" ? projectsZh : projects;
const listEl = document.getElementById("project-list");

const sorted = [...pageProjects].sort((a, b) => new Date(b.updated) - new Date(a.updated));
listEl.innerHTML = renderProjectList(sorted, locale);
