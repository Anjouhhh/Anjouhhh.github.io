import { escapeHtml } from "./dom.js";

const copy = {
  en: {
    all: "All",
    emptyPosts: "No posts in this topic yet.",
    updated: "Updated",
    learning: "Learning",
    building: "Building",
    thinking: "Thinking",
    status: "Status",
    statuses: { active: "active", paused: "paused", complete: "complete" },
    postNotFound: "Post not found",
    postMissing: "The requested post could not be found.",
    returnWriting: "Return to Writing",
    projectNotFound: "Project not found",
    projectMissing: "The requested project could not be found.",
    returnProjects: "Return to Projects"
  },
  zh: {
    all: "全部",
    emptyPosts: "这个主题下暂时还没有文章。",
    updated: "更新于",
    learning: "正在学习",
    building: "正在构建",
    thinking: "正在思考",
    status: "状态",
    statuses: { active: "进行中", paused: "已暂停", complete: "已完成" },
    postNotFound: "未找到文章",
    postMissing: "找不到你请求的文章。",
    returnWriting: "返回文章列表",
    projectNotFound: "未找到项目",
    projectMissing: "找不到你请求的项目。",
    returnProjects: "返回项目列表"
  }
};

function strings(locale) {
  return copy[locale] ?? copy.en;
}

function renderTags(tags) {
  return tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("");
}

export function renderHomePosts(posts, locale = "en") {
  return posts.map((post) => `
    <a class="item" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>
      <p>${escapeHtml(post.summary)}</p>
    </a>`).join("");
}

export function renderHomeProjects(projects, locale = "en") {
  return projects.map((project) => `
    <a class="card" href="project.html?slug=${encodeURIComponent(project.slug)}">
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.summary)}</p>
      <div class="tag-row">
        ${renderTags(project.tags)}
      </div>
    </a>`).join("");
}

export function renderHomeNow(snapshot, locale = "en") {
  const text = strings(locale);
  const punctuation = locale === "zh" ? "：" : ": ";
  return `
  <p class="meta">${text.updated} ${escapeHtml(snapshot.updatedAt)}</p>
  <p><strong>${text.learning}${punctuation}</strong>${escapeHtml(snapshot.learning[0])}</p>
  <p><strong>${text.building}${punctuation}</strong>${escapeHtml(snapshot.building[0])}</p>
  <p><strong>${text.thinking}${punctuation}</strong>${escapeHtml(snapshot.thinking[0])}</p>
`;
}

export function renderWritingPosts(posts, locale = "en") {
  if (posts.length === 0) return `<p class="subtle">${strings(locale).emptyPosts}</p>`;

  return posts.map((post) => `
    <a class="item" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.type)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>
      <p>${escapeHtml(post.summary)}</p>
    </a>
  `).join("");
}

function renderTopicButton(label, topic, activeTopic) {
  const active = topic === activeTopic;
  return `<button type="button" class="chip${active ? " active" : ""}" data-topic="${escapeHtml(topic)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
}

export function renderTopicButtons(topics, activeTopic = "", locale = "en") {
  return [
    renderTopicButton(strings(locale).all, "", activeTopic),
    ...topics.map((topic) => renderTopicButton(topic, topic, activeTopic))
  ].join("");
}

export function renderProjectList(projects, locale = "en") {
  const text = strings(locale);
  return projects.map((project) => `
    <a class="card" href="project.html?slug=${encodeURIComponent(project.slug)}">
      <div class="section-head">
        <h3>${escapeHtml(project.title)}</h3>
        <span class="status ${escapeHtml(project.status)}">${escapeHtml(text.statuses[project.status] ?? project.status)}</span>
      </div>
      <p>${escapeHtml(project.summary)}</p>
      <p class="meta">${text.updated} ${escapeHtml(project.updated)}</p>
      <div class="tag-row">
        ${renderTags(project.tags)}
      </div>
    </a>
  `).join("");
}

export function renderPostNotFound(locale = "en") {
  const text = strings(locale);
  return `
    <h1>${text.postNotFound}</h1>
    <p class="subtle">${text.postMissing}</p>
    <p><a class="text-link" href="writing.html">${text.returnWriting}</a></p>
  `;
}

export function renderProjectNotFound(locale = "en") {
  const text = strings(locale);
  return `
    <h1>${text.projectNotFound}</h1>
    <p class="subtle">${text.projectMissing}</p>
    <p><a class="text-link" href="projects.html">${text.returnProjects}</a></p>
  `;
}

export function renderPostDetail(post, locale = "en") {
  return `
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.type)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>
    ${post.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
  `;
}

export function renderProjectDetail(project, locale = "en") {
  const text = strings(locale);
  const separator = locale === "zh" ? "：" : ": ";
  return `
    <h1>${escapeHtml(project.title)}</h1>
    <p class="meta">${text.status}${separator}${escapeHtml(text.statuses[project.status] ?? project.status)} · ${text.updated} ${escapeHtml(project.updated)}</p>
    <p>${escapeHtml(project.summary)}</p>
    ${project.details.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    <div class="tag-row">
      ${renderTags(project.tags)}
    </div>
  `;
}

export function renderNowList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}
