import { projects } from "../data/projects.js";
import { renderProjectList } from "../core/templates.js";

const listEl = document.getElementById("project-list");

const sorted = [...projects].sort((a, b) => new Date(b.updated) - new Date(a.updated));
listEl.innerHTML = renderProjectList(sorted);
