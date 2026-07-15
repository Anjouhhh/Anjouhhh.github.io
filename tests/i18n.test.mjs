import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getPageLocale } from "../assets/js/core/locale.js";
import {
  renderHomeNow,
  renderPostNotFound,
  renderProjectDetail,
  renderProjectList,
  renderTopicButtons,
  renderWritingPosts
} from "../assets/js/core/templates.js";
import { posts } from "../assets/js/data/posts.js";
import { postsZh } from "../assets/js/data/zh/posts.js";
import { projects } from "../assets/js/data/projects.js";
import { projectsZh } from "../assets/js/data/zh/projects.js";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const mirrorPages = ["home", "about", "writing", "projects", "now", "post", "project"];

async function source(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

test("the entry page remains outside the language mirror", async () => {
  const entry = await source("index.html");
  assert.doesNotMatch(entry, /data-language-switch/);
  assert.doesNotMatch(entry, /href=["']zh\//);
});

test("every internal page has a bidirectional language switch", async () => {
  for (const page of mirrorPages) {
    const english = await source(`${page}.html`);
    const chinese = await source(`zh/${page}.html`);

    assert.match(english, new RegExp(`href=["']zh/${page}\\.html["']`));
    assert.match(english, /data-language-switch/);
    assert.match(chinese, /<html lang="zh-CN">/);
    assert.match(chinese, new RegExp(`href=["']\\.\\./${page}\\.html["']`));
    assert.match(chinese, /data-language-switch/);
  }
});

test("Chinese content mirrors every English post and project slug", () => {
  assert.deepEqual(postsZh.map(({ slug }) => slug), posts.map(({ slug }) => slug));
  assert.deepEqual(projectsZh.map(({ slug }) => slug), projects.map(({ slug }) => slug));
  assert.ok(postsZh.every(({ title, summary, readingTime }) => title && summary && /分钟/.test(readingTime)));
  assert.ok(projectsZh.every(({ title, summary, details }) => title && summary && details.length > 0));
});

test("locale detection defaults to English and recognizes Chinese variants", () => {
  assert.equal(getPageLocale({ documentElement: { lang: "zh-CN" } }), "zh");
  assert.equal(getPageLocale({ documentElement: { lang: "en" } }), "en");
  assert.equal(getPageLocale({}), "en");
});

test("shared templates localize labels, states, and recovery copy", () => {
  const snapshot = { updatedAt: "2026-07-14", learning: ["甲"], building: ["乙"], thinking: ["丙"] };
  assert.match(renderHomeNow(snapshot, "zh"), /正在学习：/);
  assert.match(renderTopicButtons(["数学"], "", "zh"), />全部<\/button>/);
  assert.match(renderWritingPosts([], "zh"), /暂时还没有文章/);
  assert.match(renderProjectList([projectsZh[0]], "zh"), />进行中<\/span>/);
  assert.match(renderProjectDetail(projectsZh[0], "zh"), /状态：进行中/);
  assert.match(renderPostNotFound("zh"), /未找到文章/);
});
