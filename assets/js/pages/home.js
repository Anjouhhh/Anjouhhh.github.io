import { posts } from "../data/posts.js";
import { postsZh } from "../data/zh/posts.js";
import { projects } from "../data/projects.js";
import { projectsZh } from "../data/zh/projects.js";
import { nowSnapshot } from "../data/now.js";
import { nowSnapshotZh } from "../data/zh/now.js";
import { renderHomeNow, renderHomePosts, renderHomeProjects } from "../core/templates.js";
import { getPageLocale } from "../core/locale.js";

const locale = getPageLocale();
const pagePosts = locale === "zh" ? postsZh : posts;
const pageProjects = locale === "zh" ? projectsZh : projects;
const pageNow = locale === "zh" ? nowSnapshotZh : nowSnapshot;

const homePosts = document.getElementById("home-posts");
const homeProjects = document.getElementById("home-projects");
const homeNow = document.getElementById("home-now");

const recentPosts = [...pagePosts]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 3);

homePosts.innerHTML = renderHomePosts(recentPosts, locale);

const featuredProjects = pageProjects.filter((project) => project.featured).slice(0, 2);
homeProjects.innerHTML = renderHomeProjects(featuredProjects, locale);

homeNow.innerHTML = renderHomeNow(pageNow, locale);
