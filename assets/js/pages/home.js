import { posts } from "../data/posts.js";
import { projects } from "../data/projects.js";
import { nowSnapshot } from "../data/now.js";
import { renderHomeNow, renderHomePosts, renderHomeProjects } from "../core/templates.js";

const homePosts = document.getElementById("home-posts");
const homeProjects = document.getElementById("home-projects");
const homeNow = document.getElementById("home-now");

const recentPosts = [...posts]
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 3);

homePosts.innerHTML = renderHomePosts(recentPosts);

const featuredProjects = projects.filter((project) => project.featured).slice(0, 2);
homeProjects.innerHTML = renderHomeProjects(featuredProjects);

homeNow.innerHTML = renderHomeNow(nowSnapshot);
