import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as templates from "../assets/js/core/templates.js";
import {
  renderHomeNow,
  renderHomePosts,
  renderHomeProjects,
  renderNowList,
  renderPostDetail,
  renderProjectDetail,
  renderProjectList,
  renderTopicButtons,
  renderWritingPosts
} from "../assets/js/core/templates.js";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const hostile = `<img src=x onerror="alert('x')"> "quoted" & 'single'`;
const hostileSlug = `\"><img src=x onerror=alert(1)>&/?#'`;

const post = {
  slug: hostileSlug,
  title: hostile,
  summary: hostile,
  date: hostile,
  topic: hostile,
  type: hostile,
  readingTime: hostile,
  content: [hostile]
};

const project = {
  slug: hostileSlug,
  title: hostile,
  summary: hostile,
  updated: hostile,
  status: hostile,
  tags: [hostile],
  details: [hostile]
};

function assertMarkupEscapesHostileText(markup) {
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(&#039;x&#039;\)&quot;&gt;/);
  assert.doesNotMatch(markup, /<img\b/i);
  assert.doesNotMatch(markup, /onerror="/i);
  assert.match(markup, /&quot;quoted&quot; &amp; &#039;single&#039;/);
}

function assertEncodedSlug(markup, resource) {
  assert.ok(markup.includes(`${resource}.html?slug=${encodeURIComponent(hostileSlug)}`));
  assert.doesNotMatch(markup, /slug="><img/i);
}

test("home post renderer escapes display fields and URL-encodes slugs", () => {
  const markup = renderHomePosts([post]);

  assertMarkupEscapesHostileText(markup);
  assertEncodedSlug(markup, "post");
});

test("home project renderer escapes cards, tags, and URL slugs", () => {
  const markup = renderHomeProjects([project]);

  assertMarkupEscapesHostileText(markup);
  assertEncodedSlug(markup, "project");
});

test("home Now renderer escapes snapshot values", () => {
  const markup = renderHomeNow({
    updatedAt: hostile,
    learning: [hostile],
    building: [hostile],
    thinking: [hostile]
  });

  assertMarkupEscapesHostileText(markup);
});

test("writing list renderer escapes fields, encodes slugs, and retains its empty state", () => {
  const markup = renderWritingPosts([post]);

  assertMarkupEscapesHostileText(markup);
  assertEncodedSlug(markup, "post");
  assert.match(renderWritingPosts([]), /No posts in this topic yet\./);
});

test("topic renderer creates accessible buttons with escaped attributes and labels", () => {
  const markup = renderTopicButtons([hostile], hostile);

  assert.match(markup, /<button type="button" class="chip" data-topic="" aria-pressed="false">All<\/button>/);
  assert.match(markup, /<button type="button" class="chip active" data-topic="&lt;img/);
  assert.match(markup, /aria-pressed="true"/);
  assertMarkupEscapesHostileText(markup);
});

test("project list renderer escapes fields, tags, statuses, and URL slugs", () => {
  const markup = renderProjectList([project]);

  assertMarkupEscapesHostileText(markup);
  assertEncodedSlug(markup, "project");
});

test("post detail renderer escapes metadata and body paragraphs", () => {
  const markup = renderPostDetail(post);

  assertMarkupEscapesHostileText(markup);
});

test("project detail renderer escapes metadata, details, and tags", () => {
  const markup = renderProjectDetail(project);

  assertMarkupEscapesHostileText(markup);
});

test("post not-found renderer provides a visible explanation and writing recovery link", () => {
  assert.equal(typeof templates.renderPostNotFound, "function");
  const markup = templates.renderPostNotFound();

  assert.match(markup, /<h1>Post not found<\/h1>/);
  assert.match(markup, /<p[^>]*>[^<]*(?:could not|not available|does not exist)[^<]*<\/p>/i);
  assert.match(markup, /<a\b[^>]*href=["']writing\.html["'][^>]*>[^<]+<\/a>/i);
  assert.doesNotMatch(markup, /\son\w+\s*=/i);
});

test("project not-found renderer provides a visible explanation and projects recovery link", () => {
  assert.equal(typeof templates.renderProjectNotFound, "function");
  const markup = templates.renderProjectNotFound();

  assert.match(markup, /<h1>Project not found<\/h1>/);
  assert.match(markup, /<p[^>]*>[^<]*(?:could not|not available|does not exist)[^<]*<\/p>/i);
  assert.match(markup, /<a\b[^>]*href=["']projects\.html["'][^>]*>[^<]+<\/a>/i);
  assert.doesNotMatch(markup, /\son\w+\s*=/i);
});

test("Now list renderer escapes every list item", () => {
  const markup = renderNowList([hostile]);

  assertMarkupEscapesHostileText(markup);
  assert.match(markup, /^<li>/);
});

test("page controllers delegate HTML rendering to focused template functions", async () => {
  const expectedRenderers = {
    "home.js": ["renderHomePosts", "renderHomeProjects", "renderHomeNow"],
    "writing.js": ["renderWritingPosts", "renderTopicButtons"],
    "projects.js": ["renderProjectList"],
    "post.js": ["renderPostDetail", "renderPostNotFound"],
    "project.js": ["renderProjectDetail", "renderProjectNotFound"],
    "now.js": ["renderNowList"]
  };

  for (const [file, renderers] of Object.entries(expectedRenderers)) {
    const source = await readFile(path.join(repositoryRoot, "assets/js/pages", file), "utf8");
    assert.match(source, /from\s+["']\.\.\/core\/templates\.js["']/);
    assert.doesNotMatch(source, /from\s+["']\.\.\/core\/dom\.js["']/);
    for (const renderer of renderers) assert.match(source, new RegExp(`\\b${renderer}\\s*\\(`));
  }
});
