import assert from "node:assert/strict";
import test from "node:test";
import { posts } from "../assets/js/data/posts.js";
import {
  fetchJantPosts,
  loadPosts,
  localeHasPost,
  mapJantPost
} from "../assets/js/core/content-source.js";
import { renderHomePosts, renderPostDetail, renderWritingPosts } from "../assets/js/core/templates.js";

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
    format: "note",
    type: "Note",
    readingTime: "1 min",
    featured: false,
    sourceUrl: undefined,
    sourceName: undefined,
    quoteText: undefined,
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

test("Jant formats preserve quote fields and support titleless posts", () => {
  const quote = mapJantPost({
    slug: "quote-example",
    title: null,
    format: "quote",
    quoteText: "A quoted paragraph.\n\nA second quoted paragraph.",
    sourceName: "Paul Graham",
    sourceUrl: "https://paulgraham.com/love.html",
    bodyText: "My thoughts about the quote.",
    publishedAt: 1706000000
  });

  assert.equal(quote.title, "");
  assert.equal(quote.format, "quote");
  assert.equal(quote.quoteText, "A quoted paragraph.\n\nA second quoted paragraph.");
  assert.equal(quote.sourceName, "Paul Graham");
  assert.equal(quote.sourceUrl, "https://paulgraham.com/love.html");
  assert.deepEqual(quote.content, ["My thoughts about the quote."]);
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

  const result = await fetchJantPosts("https://cms.example.com/blog", "en", { fetchImpl, contentMode: "latest" });

  assert.deepEqual(result.map((post) => post.slug), ["first", "second"]);
  assert.match(requests[0].url, /\/blog\/api\/public\/posts\?limit=100$/);
  assert.match(requests[1].url, /cursor=cursor-2/);
  assert.equal(requests[0].options.headers.Authorization, undefined);
});

test("Jant archive mode includes Hidden from Latest content", async () => {
  const requests = [];
  const result = await fetchJantPosts("https://cms.example.com", "en", {
    contentMode: "archive",
    collectionSlug: "english",
    fetchImpl: async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({
          posts: [{
            slug: "hidden-essay",
            title: "Hidden Essay",
            visibility: "latest_hidden",
            bodyText: "Still public, but not on Latest.",
            publishedAt: 1706000000
          }],
          nextCursor: null
        })
      };
    }
  });

  assert.equal(result[0].slug, "hidden-essay");
  assert.match(requests[0], /\/api\/public\/archive\?limit=100&collection=english$/);
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
  assert.match(requests[0], /\/api\/public\/archive\?/);
  assert.match(requests[0], /collection=english/);
});

test("locale existence check uses one page of the other locale's endpoint", async () => {
  const requests = [];
  const found = await localeHasPost("zh", "proof-writing-is-a-design-problem", {
    baseUrl: "https://cms.example.com",
    fetchImpl: async (url) => {
      requests.push(url);
      return {
        ok: true,
        json: async () => ({
          posts: [{
            slug: "zh-proof-writing-is-a-design-problem",
            title: "证明写作也是一个设计问题",
            bodyText: "第一段",
            publishedAt: 1706000000
          }],
          nextCursor: "more"
        })
      };
    }
  });

  assert.equal(found, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0], /\/api\/public\/posts\?limit=100&collection=chinese$/);
});

test("locale existence check reports a missing remote slug without local fallback", async () => {
  const found = await localeHasPost("en", "proof-writing-is-a-design-problem", {
    baseUrl: "https://cms.example.com",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ posts: [], nextCursor: null })
    })
  });

  assert.equal(found, false);
});

test("locale existence check throws when the remote request fails", async () => {
  await assert.rejects(
    () => localeHasPost("en", "proof-writing-is-a-design-problem", {
      baseUrl: "https://cms.example.com",
      fetchImpl: async () => { throw new Error("offline"); }
    }),
    /offline/
  );
});

test("locale existence check uses mirrored local posts when Jant is not configured", async () => {
  const requests = [];
  const found = await localeHasPost("zh", "proof-writing-is-a-design-problem", {
    baseUrl: "",
    fetchImpl: async (url) => {
      requests.push(url);
      return { ok: true, json: async () => ({ posts: [], nextCursor: null }) };
    }
  });

  assert.equal(found, true);
  assert.deepEqual(requests, []);
});

test("an empty title uses the first HTML heading and drops it from the body", () => {
  const mapped = mapJantPost({
    slug: "notes-on-pg-how-to-make-wealth",
    title: null,
    format: "quote",
    bodyHtml: "<h2>Notes on Paul Graham&#39;s &quot;How to Make Wealth&quot;</h2><p>Source: paulgraham.com/earn.html</p><p>Second paragraph.</p>",
    bodyText: "Notes on Paul Graham's \"How to Make Wealth\" Source: paulgraham.com/earn.html",
    quoteText: "So how, exactly, do you make something people like?",
    sourceName: "Paul Graham",
    sourceUrl: "https://paulgraham.com/earn.html",
    publishedAt: 1706000000
  });

  assert.equal(mapped.title, "Notes on Paul Graham's \"How to Make Wealth\"");
  assert.deepEqual(mapped.content, ["Source: paulgraham.com/earn.html", "Second paragraph."]);
  assert.equal(mapped.content.join("\n").includes("How to Make Wealth"), false);

  const detail = renderPostDetail(mapped);
  const cards = `${renderWritingPosts([mapped])}${renderHomePosts([mapped])}`;
  assert.match(detail, /<h1 class="post-heading">Notes on Paul Graham&#039;s &quot;How to Make Wealth&quot;<\/h1>/);
  assert.equal(detail.includes("post-heading--untitled"), false);
  assert.equal((detail.match(/How to Make Wealth/g) || []).length, 1);
  assert.match(cards, /<h3>Notes on Paul Graham&#039;s &quot;How to Make Wealth&quot;<\/h3>/);
  assert.equal(cards.includes("post-format"), false);
});

test("an empty Chinese title uses the first heading in that post's body", () => {
  const mapped = mapJantPost({
    slug: "zh-notes-on-pg-how-to-make-wealth",
    title: null,
    format: "quote",
    bodyHtml: "<h2>Paul Graham《如何创造财富》的笔记</h2><p>原文：paulgraham.com/earn.html</p>",
    bodyText: "Paul Graham《如何创造财富》的笔记 原文：paulgraham.com/earn.html",
    publishedAt: 1706000000
  }, "zh");

  assert.equal(mapped.slug, "notes-on-pg-how-to-make-wealth");
  assert.equal(mapped.title, "Paul Graham《如何创造财富》的笔记");
  assert.deepEqual(mapped.content, ["原文：paulgraham.com/earn.html"]);
});

test("an empty title uses a markdown heading when the body has no HTML heading", () => {
  const mapped = mapJantPost({
    slug: "markdown-heading",
    title: "",
    format: "note",
    bodyText: "Before\n\n## Kept Title ##\n\nAfter\n\n### Later heading\n\nEnd",
    publishedAt: 1706000000
  });

  assert.equal(mapped.title, "Kept Title");
  assert.deepEqual(mapped.content, ["Before", "After", "### Later heading", "End"]);
});

test("an empty title ignores headings below h3 and keeps the format label path", () => {
  const quote = mapJantPost({
    slug: "3vvec",
    title: null,
    format: "quote",
    bodyHtml: "<h4>Not a title</h4><p>The full article goes much deeper.</p>",
    bodyText: "The full article goes much deeper.",
    quoteText: "A quoted paragraph.",
    publishedAt: 1706000000
  });
  const excerpt = mapJantPost({
    slug: "zglx9",
    title: null,
    format: "quote",
    bodyHtml: "<p>所以，我们都没有机会走上那条绝对正确的道路。</p>",
    bodyText: "所以，我们都没有机会走上那条绝对正确的道路。",
    publishedAt: 1706000000
  }, "zh");

  assert.equal(quote.title, "");
  assert.deepEqual(quote.content, ["The full article goes much deeper."]);
  assert.equal(excerpt.title, "");
  assert.equal(excerpt.type, "摘录");
});

test("the first non-empty heading wins, including an HTML heading stored in the text body", () => {
  const html = mapJantPost({
    slug: "heading-order",
    title: "   ",
    format: "note",
    bodyHtml: "<h2> </h2><h1>Actual</h1><p>Paragraph.</p>",
    publishedAt: 1706000000
  });
  const text = mapJantPost({
    slug: "heading-in-text",
    title: "",
    format: "note",
    bodyText: "<h3>From text <em>heading</em></h3>\n\nParagraph.",
    publishedAt: 1706000000
  });

  assert.equal(html.title, "Actual");
  assert.deepEqual(html.content, ["Paragraph."]);
  assert.equal(text.title, "From text heading");
  assert.deepEqual(text.content, ["Paragraph."]);
});

test("a body that is only a heading becomes the title and is not repeated", () => {
  const html = mapJantPost({
    slug: "heading-only-html",
    title: null,
    format: "note",
    bodyHtml: "<h2>Only Heading</h2>",
    bodyText: "",
    publishedAt: 1706000000
  });
  const markdown = mapJantPost({
    slug: "heading-only-markdown",
    title: null,
    format: "note",
    bodyText: "   ## Only Heading",
    publishedAt: 1706000000
  });

  assert.equal(html.title, "Only Heading");
  assert.deepEqual(html.content, []);
  assert.equal(markdown.title, "Only Heading");
  assert.deepEqual(markdown.content, []);
});

test("posts that already have a title keep that title and body", () => {
  const mapped = mapJantPost({
    slug: "kept",
    title: "Given Title",
    format: "note",
    bodyHtml: "<h2>Body Heading</h2><p>Paragraph.</p>",
    bodyText: "## Body Heading\n\nParagraph.",
    publishedAt: 1706000000
  });
  const markdownOnly = mapJantPost({
    slug: "kept-markdown",
    title: "Given Title",
    format: "note",
    bodyText: "## Body Heading\n\nParagraph.",
    publishedAt: 1706000000
  });

  assert.equal(mapped.title, "Given Title");
  assert.deepEqual(mapped.content, ["Paragraph."]);
  assert.equal(markdownOnly.title, "Given Title");
  assert.deepEqual(markdownOnly.content, ["## Body Heading", "Paragraph."]);
});

test("a matched local post keeps its type while an empty remote title uses the body heading", async () => {
  const result = await fetchJantPosts("https://cms.example.com", "en", {
    contentMode: "archive",
    collectionSlug: "english",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        posts: [{
          slug: "notes-on-pg-how-to-make-wealth",
          title: null,
          format: "quote",
          bodyHtml: "<h2>Notes on Paul Graham&#39;s &quot;How to Make Wealth&quot;</h2><p>Source: paulgraham.com/earn.html</p>",
          bodyText: "Notes on Paul Graham's \"How to Make Wealth\" Source: paulgraham.com/earn.html",
          quoteText: "So how",
          publishedAt: 1706000000
        }],
        nextCursor: null
      })
    })
  });

  assert.equal(result[0].title, "Notes on Paul Graham's \"How to Make Wealth\"");
  assert.equal(result[0].type, "Repost");
  assert.deepEqual(result[0].content, ["Source: paulgraham.com/earn.html"]);
});

test("Jant failures fall back to local content", async () => {
  const fallback = await loadPosts("en", {
    baseUrl: "https://cms.example.com",
    fetchImpl: async () => { throw new Error("offline"); }
  });

  assert.strictEqual(fallback, posts);
});
