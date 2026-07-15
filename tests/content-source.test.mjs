import assert from "node:assert/strict";
import test from "node:test";
import { posts } from "../assets/js/data/posts.js";
import {
  fetchJantPosts,
  loadPosts,
  mapJantPost
} from "../assets/js/core/content-source.js";

test("content source keeps the checked-in posts when Jant is not configured", async () => {
  assert.strictEqual(await loadPosts("en", { baseUrl: "" }), posts);
});

test("Jant posts map into the existing site post shape", () => {
  const mapped = mapJantPost({
    slug: "hello-jant",
    title: "Hello Jant",
    format: "note",
    bodyText: "First paragraph.\n\nSecond paragraph.",
    bodyHtml: "<p>First paragraph.</p><p>Second paragraph.</p>",
    publishedAt: 1706000000,
    collections: [{ title: "Building" }]
  });

  assert.deepEqual(mapped, {
    slug: "hello-jant",
    title: "Hello Jant",
    summary: "First paragraph.",
    date: "2024-01-23",
    topic: "Building",
    type: "Note",
    readingTime: "1 min",
    featured: false,
    sourceUrl: undefined,
    content: ["First paragraph.", "Second paragraph."]
  });
});

test("Chinese Jant slugs map back to the existing Chinese route", () => {
  const mapped = mapJantPost({
    slug: "zh-proof-writing-is-a-design-problem",
    title: "证明写作也是一个设计问题",
    format: "note",
    bodyText: "第一段",
    collections: [{ slug: "zh-math", title: "数学" }, { slug: "chinese", title: "中文" }],
    publishedAt: 1706000000
  }, "zh");

  assert.equal(mapped.slug, "proof-writing-is-a-design-problem");
  assert.equal(mapped.topic, "数学");
});

test("Jant HTML paragraphs and featured timestamps are preserved", () => {
  const mapped = mapJantPost({
    slug: "featured-jant",
    title: "Featured",
    format: "note",
    bodyText: "First Second",
    bodyHtml: "<p>First &quot;paragraph&quot;.</p><p>Second paragraph.</p>",
    featuredAt: 1706000000,
    publishedAt: 1706000000
  });

  assert.equal(mapped.featured, true);
  assert.deepEqual(mapped.content, ["First \"paragraph\".", "Second paragraph."]);
});

test("Jant pagination is followed without exposing an API token", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const page = requests.length === 1
      ? { posts: [{ slug: "first", title: "First", bodyText: "One", publishedAt: 1706000000 }], nextCursor: "cursor-2" }
      : { posts: [{ slug: "second", title: "Second", bodyText: "Two", publishedAt: 1706000001 }], nextCursor: null };
    return { ok: true, json: async () => page };
  };

  const result = await fetchJantPosts("https://cms.example.com/blog", "en", { fetchImpl });

  assert.deepEqual(result.map((post) => post.slug), ["first", "second"]);
  assert.match(requests[0].url, /\/blog\/api\/public\/posts\?limit=100$/);
  assert.match(requests[1].url, /cursor=cursor-2/);
  assert.equal(requests[0].options.headers.Authorization, undefined);
});

test("configured loading scopes Jant requests to the locale collection", async () => {
  const requests = [];
  const result = await loadPosts("en", {
    baseUrl: "https://cms.example.com",
    fetchImpl: async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({
          posts: [{ slug: "remote-only", title: "Remote", bodyText: "Body", publishedAt: 1706000000 }],
          nextCursor: null
        })
      };
    }
  });

  assert.equal(result[0].slug, "remote-only");
  assert.match(requests[0], /collection=english/);
});

test("Jant failures fall back to local content", async () => {
  const fallback = await loadPosts("en", {
    baseUrl: "https://cms.example.com",
    fetchImpl: async () => { throw new Error("offline"); }
  });

  assert.strictEqual(fallback, posts);
});
