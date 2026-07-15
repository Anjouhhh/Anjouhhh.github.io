import { posts } from "../data/posts.js";
import { postsZh } from "../data/zh/posts.js";
import {
  JANT_ADMIN_URL,
  JANT_PUBLIC_API_BASE_URL,
  JANT_PUBLIC_API_BASE_URL_ZH,
  JANT_PUBLIC_COLLECTION_SLUG,
  JANT_PUBLIC_COLLECTION_SLUG_ZH
} from "../config/content-source.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const DEFAULT_TOPIC = { en: "Notes", zh: "笔记" };
const FORMAT_LABELS = {
  en: { note: "Note", link: "Link", quote: "Quote" },
  zh: { note: "随笔", link: "链接", quote: "摘录" }
};

function getFallbackPosts(locale) {
  return locale === "zh" ? postsZh : posts;
}

function getBaseUrl(locale) {
  return locale === "zh" ? JANT_PUBLIC_API_BASE_URL_ZH : JANT_PUBLIC_API_BASE_URL;
}

function getCollectionSlug(locale) {
  return locale === "zh" ? JANT_PUBLIC_COLLECTION_SLUG_ZH : JANT_PUBLIC_COLLECTION_SLUG;
}

function getLocalSlug(slug, locale) {
  if (locale === "zh" && slug.startsWith("zh-")) return slug.slice(3);
  return slug;
}

function toDateString(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function paragraphsFromHtml(html) {
  return [...String(html ?? "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")).trim())
    .filter(Boolean);
}

function splitParagraphs(text, fallback, html = "") {
  const htmlParagraphs = paragraphsFromHtml(html);
  if (htmlParagraphs.length > 0) return htmlParagraphs;

  const paragraphs = String(text ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return paragraphs.length > 0 ? paragraphs : [fallback];
}

function estimateReadingTime(text, locale) {
  const value = String(text ?? "").trim();
  const latinWords = value ? value.split(/\s+/).filter(Boolean).length : 0;
  const cjkCharacters = [...value].filter((character) => /[\u3040-\u30ff\u3400-\u9fff]/u.test(character)).length;
  const readingUnits = latinWords + cjkCharacters / 2;
  const minutes = Math.max(1, Math.ceil(readingUnits / 200));
  return locale === "zh" ? `${minutes} 分钟` : `${minutes} min`;
}

function firstCollection(post, locale) {
  const languageSlug = getCollectionSlug(locale);
  const collection = Array.isArray(post.collections)
    ? post.collections.find((item) => item?.slug !== languageSlug)
    : null;
  return collection?.title || collection?.name || collection?.slug || DEFAULT_TOPIC[locale];
}

export function mapJantPost(post, locale = "en") {
  if (!post || typeof post.slug !== "string" || !post.slug.trim()) return null;

  const format = Object.hasOwn(FORMAT_LABELS.en, post.format) ? post.format : "note";
  const bodyText = String(post.bodyText ?? "").trim();
  const quoteText = String(post.quoteText ?? "").trim();
  const title = String(post.title ?? "").trim();
  const content = bodyText || post.bodyHtml
    ? splitParagraphs(bodyText, title || quoteText || FORMAT_LABELS[locale]?.[format] || format, post.bodyHtml)
    : [];
  const summary = String(
    post.summary ??
    (format === "quote" ? quoteText || content[0] : content[0] || title || FORMAT_LABELS[locale]?.[format] || format)
  ).slice(0, 240);
  const readingText = [quoteText, bodyText].filter(Boolean).join("\n\n");

  return {
    slug: getLocalSlug(post.slug, locale),
    title,
    summary,
    date: toDateString(post.publishedAt),
    topic: firstCollection(post, locale),
    format,
    type: FORMAT_LABELS[locale]?.[format] ?? FORMAT_LABELS.en[format],
    readingTime: estimateReadingTime(readingText, locale),
    featured: Boolean(post.featuredAt ?? post.featured),
    sourceUrl: post.url || post.sourceUrl || undefined,
    sourceName: post.sourceName || undefined,
    quoteText: quoteText || undefined,
    content
  };
}

function apiUrl(baseUrl, cursor, collectionSlug) {
  const url = new URL("api/public/posts", `${baseUrl.replace(/\/+$/, "")}/`);
  url.searchParams.set("limit", String(PAGE_SIZE));
  if (collectionSlug) url.searchParams.set("collection", collectionSlug);
  if (cursor) url.searchParams.set("cursor", cursor);
  return url.href;
}

async function requestPage(url, fetchImpl, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      ...(controller ? { signal: controller.signal } : {})
    });

    if (!response.ok) throw new Error(`Jant API returned ${response.status}`);
    return await response.json();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchJantPosts(baseUrl, locale = "en", {
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
  collectionSlug = ""
} = {}) {
  if (!baseUrl || typeof fetchImpl !== "function") return [];

  const remotePosts = [];
  let cursor = "";

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await requestPage(apiUrl(baseUrl, cursor, collectionSlug), fetchImpl, timeoutMs);
    if (!Array.isArray(payload?.posts)) throw new Error("Jant API returned an invalid posts payload");

    remotePosts.push(...payload.posts);
    if (!payload.nextCursor || payload.posts.length === 0) break;
    cursor = payload.nextCursor;
  }

  const fallbackBySlug = new Map(getFallbackPosts(locale).map((post) => [post.slug, post]));

  return remotePosts.map((post) => {
    const mapped = mapJantPost(post, locale);
    const local = mapped ? fallbackBySlug.get(mapped.slug) : null;
    if (!mapped || !local) return mapped;

    return {
      ...mapped,
      summary: local.summary,
      type: local.type,
      readingTime: local.readingTime
    };
  }).filter(Boolean);
}

export async function loadPosts(locale = "en", options = {}) {
  const fallback = getFallbackPosts(locale);
  const baseUrl = options.baseUrl ?? getBaseUrl(locale);

  if (!baseUrl) return fallback;

  try {
    const remotePosts = await fetchJantPosts(baseUrl, locale, {
      ...options,
      collectionSlug: options.collectionSlug ?? getCollectionSlug(locale)
    });
    return remotePosts.length > 0 ? remotePosts : fallback;
  } catch {
    return fallback;
  }
}

export function configureJantAdminLink(documentRef = globalThis.document, locale = "en") {
  const link = documentRef?.getElementById?.("jant-admin-link");
  if (!link || !JANT_ADMIN_URL) return;

  link.href = JANT_ADMIN_URL;
  link.hidden = false;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = locale === "zh" ? "打开写作后台" : "Open writing dashboard";
}
