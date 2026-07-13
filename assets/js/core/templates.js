import { escapeHtml } from "./dom.js";

function renderTags(tags) {
  return tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("");
}

export function renderHomePosts(posts) {
  return posts.map((post) => `
    <a class="item" href="post.html?slug=${encodeURIComponent(post.slug)}">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>
      <p>${escapeHtml(post.summary)}</p>
    </a>`).join("");
}

export function renderHomeProjects(projects) {
  return projects.map((project) => `
    <a class="card" href="project.html?slug=${encodeURIComponent(project.slug)}">
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.summary)}</p>
      <div class="tag-row">
        ${renderTags(project.tags)}
      </div>
    </a>`).join("");
}

export function renderHomeNow(snapshot) {
  return `
  <p class="meta">Updated ${escapeHtml(snapshot.updatedAt)}</p>
  <p><strong>Learning:</strong> ${escapeHtml(snapshot.learning[0])}</p>
  <p><strong>Building:</strong> ${escapeHtml(snapshot.building[0])}</p>
  <p><strong>Thinking:</strong> ${escapeHtml(snapshot.thinking[0])}</p>
`;
}

export function renderWritingPosts(posts) {
  if (posts.length === 0) return `<p class="subtle">No posts in this topic yet.</p>`;

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

export function renderTopicButtons(topics, activeTopic = "") {
  return [
    renderTopicButton("All", "", activeTopic),
    ...topics.map((topic) => renderTopicButton(topic, topic, activeTopic))
  ].join("");
}

export function renderProjectList(projects) {
  return projects.map((project) => `
    <a class="card" href="project.html?slug=${encodeURIComponent(project.slug)}">
      <div class="section-head">
        <h3>${escapeHtml(project.title)}</h3>
        <span class="status ${escapeHtml(project.status)}">${escapeHtml(project.status)}</span>
      </div>
      <p>${escapeHtml(project.summary)}</p>
      <p class="meta">Updated ${escapeHtml(project.updated)}</p>
      <div class="tag-row">
        ${renderTags(project.tags)}
      </div>
    </a>
  `).join("");
}

export function renderPostNotFound() {
  return `
    <h1>Post not found</h1>
    <p class="subtle">The requested post could not be found.</p>
    <p><a class="text-link" href="writing.html">Return to Writing</a></p>
  `;
}

export function renderProjectNotFound() {
  return `
    <h1>Project not found</h1>
    <p class="subtle">The requested project could not be found.</p>
    <p><a class="text-link" href="projects.html">Return to Projects</a></p>
  `;
}

export function renderPostDetail(post) {
  return `
    <h1>${escapeHtml(post.title)}</h1>
    <p class="meta">${escapeHtml(post.date)} · ${escapeHtml(post.type)} · ${escapeHtml(post.topic)} · ${escapeHtml(post.readingTime)}</p>
    ${post.content.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
  `;
}

export function renderProjectDetail(project) {
  return `
    <h1>${escapeHtml(project.title)}</h1>
    <p class="meta">Status: ${escapeHtml(project.status)} · Updated ${escapeHtml(project.updated)}</p>
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
