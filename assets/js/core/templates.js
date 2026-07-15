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

function postFormat(post) {
  if (["note", "link", "quote"].includes(post?.format)) return post.format;
  if (post?.quoteText) return "quote";
  if (post?.sourceUrl) return "link";
  return "note";
}

function postType(post, locale) {
  const labels = {
    en: { note: "Note", link: "Link", quote: "Quote" },
    zh: { note: "随笔", link: "链接", quote: "摘录" }
  };
  const format = postFormat(post);
  return post?.type || labels[locale]?.[format] || labels.en[format];
}

function safeExternalUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function splitText(value) {
  return String(value ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function truncate(value, length = 260) {
  const text = String(value ?? "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function renderPostCard(post, locale) {
  const type = postType(post, locale);
  const title = post.title
    ? `<h3>${escapeHtml(post.title)}</h3>`
    : `<p class="post-format">${escapeHtml(type)}</p>`;
  const meta = post.title
    ? `<p class="meta">${escapeHtml(post.date)} · ${escapeHtml(type)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>`
    : `<p class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>`;
  const preview = postFormat(post) === "quote" && post.quoteText
    ? `<blockquote class="post-excerpt">${escapeHtml(truncate(splitText(post.quoteText)[0] || post.quoteText))}</blockquote>`
    : `<p>${escapeHtml(post.summary || post.content?.[0] || "")}</p>`;

  return `
    <a class="item" href="post.html?slug=${encodeURIComponent(post.slug)}">
      ${title}
      ${meta}
      ${preview}
    </a>`;
}

function renderTags(tags) {
  return tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("");
}

export function renderHomePosts(posts, locale = "en") {
  return posts.map((post) => renderPostCard(post, locale)).join("");
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

  return posts.map((post) => renderPostCard(post, locale)).join("");
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
  const format = postFormat(post);
  const type = postType(post, locale);
  const title = post.title || type;
  const titleClass = post.title ? "" : " post-heading--untitled";
  const quote = format === "quote" && post.quoteText
    ? `<blockquote class="post-quote">${splitText(post.quoteText).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</blockquote>`
    : "";
  const sourceUrl = safeExternalUrl(post.sourceUrl);
  const sourceLabel = post.sourceName || (locale === "zh" ? "来源链接" : "Source link");
  const source = sourceUrl
    ? `<p class="post-source">${format === "quote" ? "— " : ""}<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)} ↗</a></p>`
    : post.sourceName && format === "quote"
      ? `<p class="post-source">— ${escapeHtml(post.sourceName)}</p>`
      : "";
  const body = (post.content ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");

  return `
    <h1 class="post-heading${titleClass}">${escapeHtml(title)}</h1>
    <p class="meta">${escapeHtml(post.date)} · ${escapeHtml(type)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>
    ${format === "quote" ? quote : ""}
    ${source}
    ${body}
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
