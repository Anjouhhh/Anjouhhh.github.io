import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".md"]);
const MODULE_EXTENSIONS = new Set([".js", ".mjs"]);
const IGNORED_DIRECTORIES = new Set([".git", ".worktrees", "build", "coverage", "dist", "node_modules"]);
const PRODUCTION_ROOT = new URL("https://anjouhhh.github.io/");
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function sourceFiles(rootDirectory) {
  const files = [];

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(entryPath);
      }
    }
  }

  visit(rootDirectory);
  return files.sort((left, right) => left.localeCompare(right));
}

export function countSourceFiles(rootDirectory) {
  return sourceFiles(path.resolve(rootDirectory)).length;
}

function addIssue(issues, rootDirectory, filePath, code, message) {
  issues.push({
    code,
    file: toPosixPath(path.relative(rootDirectory, filePath)),
    message
  });
}

function decodeSource(issues, rootDirectory, filePath) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(filePath));
  } catch {
    addIssue(issues, rootDirectory, filePath, "invalid-utf8", "File is not valid UTF-8.");
    return null;
  }
}

function attributesFrom(tag) {
  const attributes = new Map();
  const attributePattern = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const tagName = /^<\/?\s*([^\s>]+)/.exec(tag)?.[1]?.toLowerCase();

  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1].toLowerCase();
    if (name === tagName) continue;
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }

  return attributes;
}

function tagsNamed(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function hasNamedMeta(html, name) {
  return tagsNamed(html, "meta").some((tag) => {
    const attributes = attributesFrom(tag);
    return attributes.get("name")?.toLowerCase() === name && attributes.get("content")?.trim();
  });
}

function cleanReference(reference) {
  const cutoff = reference.search(/[?#]/);
  return (cutoff === -1 ? reference : reference.slice(0, cutoff)).trim();
}

function isExternalReference(reference) {
  const trimmed = reference.trim();
  if (!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmed)) return false;

  try {
    const url = new URL(trimmed, PRODUCTION_ROOT);
    return url.origin !== PRODUCTION_ROOT.origin;
  } catch {
    return true;
  }
}

function localTarget(rootDirectory, sourcePath, reference) {
  const trimmed = reference.trim();
  let cleaned = cleanReference(trimmed);
  if (!cleaned) return null;

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmed)) {
    try {
      const url = new URL(trimmed, PRODUCTION_ROOT);
      if (url.origin !== PRODUCTION_ROOT.origin) return null;
      cleaned = url.pathname;
    } catch {
      return null;
    }
  }

  let decoded;
  try {
    decoded = decodeURIComponent(cleaned);
  } catch {
    decoded = cleaned;
  }

  return decoded.startsWith("/")
    ? path.resolve(rootDirectory, `.${decoded}`)
    : path.resolve(path.dirname(sourcePath), decoded);
}

function isInsideRoot(rootDirectory, targetPath) {
  const relativePath = path.relative(rootDirectory, targetPath);
  return relativePath === "" || (!path.isAbsolute(relativePath) && relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`));
}

function existsWithExactCase(rootDirectory, targetPath) {
  if (!isInsideRoot(rootDirectory, targetPath) || !existsSync(targetPath)) return false;

  try {
    if (!isInsideRoot(realpathSync(rootDirectory), realpathSync(targetPath))) return false;
  } catch {
    return false;
  }

  const relativePath = path.relative(rootDirectory, targetPath);
  if (!relativePath) return true;

  let directory = rootDirectory;
  for (const segment of relativePath.split(path.sep)) {
    const exactEntry = readdirSync(directory, { withFileTypes: true }).find((entry) => entry.name === segment);
    if (!exactEntry) return false;
    directory = path.join(directory, exactEntry.name);
  }

  return true;
}

function maskedHtml(contents) {
  return contents.replace(/[^\r\n]/g, " ");
}

function htmlTagAt(html, startIndex) {
  if (html[startIndex] !== "<") return null;

  let quote = "";
  for (let index = startIndex + 1; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "<") return null;
    if (character !== ">") continue;

    const source = html.slice(startIndex, index + 1);
    const nameMatch = /^<\s*(\/?)\s*([a-z][\w:-]*)/i.exec(source);
    const name = nameMatch?.[2]?.toLowerCase() ?? "";
    return {
      endIndex: index + 1,
      isClosing: nameMatch?.[1] === "/",
      isSelfClosing: VOID_ELEMENTS.has(name) && /\/\s*>$/.test(source),
      name,
      source
    };
  }

  return null;
}

function htmlForScanning(html) {
  const chunks = [];
  const inertTextElements = new Set([
    "script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"
  ]);
  const titleTexts = [];
  let index = 0;
  let rawTextElement = "";
  let pendingTitleText = "";
  let templateDepth = 0;
  let templateRawTextElement = "";

  while (index < html.length) {
    if (!rawTextElement && !templateRawTextElement && html.startsWith("<!--", index)) {
      const commentEnd = html.indexOf("-->", index + 4);
      const endIndex = commentEnd === -1 ? html.length : commentEnd + 3;
      chunks.push(maskedHtml(html.slice(index, endIndex)));
      index = endIndex;
      continue;
    }

    if (rawTextElement) {
      const nextTag = html.indexOf("<", index);
      if (nextTag === -1) {
        const remainder = html.slice(index);
        chunks.push(maskedHtml(remainder));
        if (rawTextElement === "title") pendingTitleText += remainder;
        break;
      }
      const text = html.slice(index, nextTag);
      chunks.push(maskedHtml(text));
      if (rawTextElement === "title") pendingTitleText += text;
      const tag = htmlTagAt(html, nextTag);
      if (tag?.isClosing && tag.name === rawTextElement) {
        chunks.push(tag.source);
        if (rawTextElement === "title") titleTexts.push(pendingTitleText);
        rawTextElement = "";
        pendingTitleText = "";
        index = tag.endIndex;
      } else {
        const endIndex = tag?.endIndex ?? nextTag + 1;
        const inertSource = html.slice(nextTag, endIndex);
        chunks.push(maskedHtml(inertSource));
        if (rawTextElement === "title") pendingTitleText += inertSource;
        index = endIndex;
      }
      continue;
    }

    if (templateDepth > 0) {
      const nextTag = html.indexOf("<", index);
      if (nextTag === -1) {
        chunks.push(maskedHtml(html.slice(index)));
        break;
      }
      chunks.push(maskedHtml(html.slice(index, nextTag)));
      if (!templateRawTextElement && html.startsWith("<!--", nextTag)) {
        const commentEnd = html.indexOf("-->", nextTag + 4);
        const endIndex = commentEnd === -1 ? html.length : commentEnd + 3;
        chunks.push(maskedHtml(html.slice(nextTag, endIndex)));
        index = endIndex;
        continue;
      }
      const tag = htmlTagAt(html, nextTag);

      if (templateRawTextElement) {
        if (tag?.isClosing && tag.name === templateRawTextElement) {
          templateRawTextElement = "";
        }
      } else if (tag?.name === "template") {
        if (tag.isClosing) {
          templateDepth -= 1;
        } else if (!tag.isSelfClosing) {
          templateDepth += 1;
        }
      } else if (tag && !tag.isClosing && !tag.isSelfClosing && inertTextElements.has(tag.name)) {
        templateRawTextElement = tag.name;
      }

      const endIndex = tag?.endIndex ?? nextTag + 1;
      chunks.push(maskedHtml(html.slice(nextTag, endIndex)));
      index = endIndex;
      continue;
    }

    const nextTag = html.indexOf("<", index);
    if (nextTag === -1) {
      chunks.push(html.slice(index));
      break;
    }
    chunks.push(html.slice(index, nextTag));
    if (html.startsWith("<!--", nextTag)) {
      const commentEnd = html.indexOf("-->", nextTag + 4);
      const endIndex = commentEnd === -1 ? html.length : commentEnd + 3;
      chunks.push(maskedHtml(html.slice(nextTag, endIndex)));
      index = endIndex;
      continue;
    }

    const tag = htmlTagAt(html, nextTag);
    if (!tag) {
      chunks.push("<");
      index = nextTag + 1;
      continue;
    }

    chunks.push(tag.source);
    index = tag.endIndex;
    if (!tag.isClosing && !tag.isSelfClosing) {
      if (inertTextElements.has(tag.name)) {
        rawTextElement = tag.name;
        if (tag.name === "title") pendingTitleText = "";
      }
      if (tag.name === "template") templateDepth = 1;
    }
  }

  return { html: chunks.join(""), titleText: titleTexts[0] ?? "" };
}

function openingTags(html) {
  return html.match(/<[a-z][^<>]*>/gi) ?? [];
}

function anchorRecords(html) {
  const records = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const openingTag = `<a${match[1]}>`;
    const attributes = attributesFrom(openingTag);
    const text = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    records.push({ attributes, text });
  }

  return records;
}

function validateHtmlReferences(issues, rootDirectory, filePath, html) {
  for (const tag of openingTags(html)) {
    const attributes = attributesFrom(tag);
    for (const attributeName of ["href", "src"]) {
      if (!attributes.has(attributeName)) continue;

      const reference = attributes.get(attributeName);
      const target = localTarget(rootDirectory, filePath, reference);
      if (target && !existsWithExactCase(rootDirectory, target)) {
        addIssue(
          issues,
          rootDirectory,
          filePath,
          "missing-reference",
          `Local reference does not exist: ${reference}`
        );
      }
    }
  }
}

function validatePageContract(issues, rootDirectory, filePath, html, titleText) {
  if (!titleText.trim()) {
    addIssue(issues, rootDirectory, filePath, "missing-title", "Page must have a non-empty title.");
  }

  if (!hasNamedMeta(html, "description")) {
    addIssue(issues, rootDirectory, filePath, "missing-description", "Page must have a meta description.");
  }
  if (!hasNamedMeta(html, "viewport")) {
    addIssue(issues, rootDirectory, filePath, "missing-viewport", "Page must have a viewport meta tag.");
  }

  const htmlTag = tagsNamed(html, "html")[0];
  if (!htmlTag || !attributesFrom(htmlTag).get("lang")?.trim()) {
    addIssue(issues, rootDirectory, filePath, "missing-lang", "The html element must declare a language.");
  }

  const mainCount = tagsNamed(html, "main").length;
  if (mainCount === 0) {
    addIssue(issues, rootDirectory, filePath, "missing-main", "Page must have one main landmark.");
  } else if (mainCount > 1) {
    addIssue(issues, rootDirectory, filePath, "multiple-main", "Page must not have more than one main landmark.");
  }

  if (tagsNamed(html, "h1").length === 0) {
    addIssue(issues, rootDirectory, filePath, "missing-h1", "Page must have at least one h1 heading.");
  }

  const relativePath = toPosixPath(path.relative(rootDirectory, filePath));
  const anchors = anchorRecords(html);

  if (relativePath === "index.html") {
    const indexPath = path.resolve(rootDirectory, "index.html");
    for (const { attributes } of anchors) {
      const href = attributes.get("href");
      if (!href) continue;

      const cleaned = cleanReference(href).toLowerCase();
      const target = localTarget(rootDirectory, filePath, href);
      let isProductionRoot = false;
      try {
        const url = new URL(href, PRODUCTION_ROOT);
        isProductionRoot = url.origin === PRODUCTION_ROOT.origin && url.pathname === "/";
      } catch {
        // Relative references are handled by localTarget above.
      }
      if (["/", ".", "./"].includes(cleaned) || target === indexPath || isProductionRoot) {
        addIssue(issues, rootDirectory, filePath, "entry-loop", `Root entry link loops back to itself: ${href}`);
      }
    }
  } else {
    const homePath = path.resolve(rootDirectory, "home.html");
    for (const { attributes, text } of anchors) {
      const label = attributes.get("aria-label")?.trim() || text;
      if (label.toLowerCase() !== "home") continue;

      const href = attributes.get("href") ?? "";
      if (href && isExternalReference(href)) continue;
      if (localTarget(rootDirectory, filePath, href) !== homePath) {
        addIssue(issues, rootDirectory, filePath, "home-route", `Internal Home link must point to home.html: ${href || "(missing href)"}`);
      }
    }
  }
}

function validateModuleImports(issues, rootDirectory, filePath, source) {
  const importPattern = /^\s*(?:import\s+(?:[^"';]+?\s+from\s+)?|export\s+[^"';]+?\s+from\s+)["']([^"']+)["']/gm;

  for (const match of source.matchAll(importPattern)) {
    const reference = match[1];
    if (!reference.startsWith(".") && !reference.startsWith("/")) continue;

    const target = localTarget(rootDirectory, filePath, reference);
    if (target && !existsWithExactCase(rootDirectory, target)) {
      addIssue(
        issues,
        rootDirectory,
        filePath,
        "missing-module-import",
        `Static module import does not exist: ${reference}`
      );
    }
  }
}

function stripJavaScriptComments(source) {
  let result = "";
  let state = "code";
  let quote = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === "line-comment") {
      if (character === "\n" || character === "\r") {
        result += character;
        state = "code";
      } else {
        result += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && nextCharacter === "/") {
        result += "  ";
        index += 1;
        state = "code";
      } else {
        result += character === "\n" || character === "\r" ? character : " ";
      }
      continue;
    }

    if (state === "string") {
      result += character;
      if (character === "\\") {
        if (nextCharacter !== undefined) {
          result += nextCharacter;
          index += 1;
        }
      } else if (character === quote) {
        state = "code";
      }
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      result += character;
      quote = character;
      state = "string";
    } else if (character === "/" && nextCharacter === "/") {
      result += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && nextCharacter === "*") {
      result += "  ";
      index += 1;
      state = "block-comment";
    } else {
      result += character;
    }
  }

  return result;
}

function maskJavaScriptTemplateLiterals(source) {
  let result = "";
  let inTemplate = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (!inTemplate) {
      if (character === "`") {
        result += " ";
        inTemplate = true;
      } else {
        result += character;
      }
      continue;
    }

    if (character === "\\" && source[index + 1] !== undefined) {
      result += "  ";
      index += 1;
    } else if (character === "`") {
      result += " ";
      inTemplate = false;
    } else {
      result += character === "\n" || character === "\r" ? character : " ";
    }
  }

  return result;
}

function isDataModule(rootDirectory, filePath) {
  const relativePath = toPosixPath(path.relative(rootDirectory, filePath)).toLowerCase();
  return relativePath.split("/").includes("data") || /(?:^|\/)[^/]*data[^/]*\.(?:m?js)$/.test(relativePath);
}

function javaScriptTokens(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      const lineEnd = source.indexOf("\n", index + 2);
      index = lineEnd === -1 ? source.length : lineEnd + 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      const valueStart = index + 1;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += Math.min(2, source.length - index);
        } else if (source[index] === quote) {
          break;
        } else {
          index += 1;
        }
      }
      tokens.push({ type: quote === "`" ? "template" : "string", value: source.slice(valueStart, index) });
      if (source[index] === quote) index += 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(character)) {
      const identifierMatch = /^[A-Za-z_$][\w$]*/.exec(source.slice(index));
      tokens.push({ type: "identifier", value: identifierMatch[0] });
      index += identifierMatch[0].length;
      continue;
    }
    if ("{},:[]".includes(character)) {
      tokens.push({ type: "punctuator", value: character });
    }
    index += 1;
  }

  return tokens;
}

function validateDuplicateSlugs(issues, rootDirectory, filePath, source) {
  if (!isDataModule(rootDirectory, filePath)) return;

  const seen = new Set();
  const tokens = javaScriptTokens(source);
  for (let index = 0; index < tokens.length - 2; index += 1) {
    const previousToken = tokens[index - 1];
    const keyToken = tokens[index];
    const separatorToken = tokens[index + 1];
    const valueToken = tokens[index + 2];
    const followsPropertyBoundary = !previousToken || previousToken.value === "{" || previousToken.value === ",";
    const isSlugKey = (keyToken.type === "identifier" || keyToken.type === "string") && keyToken.value === "slug";
    const isStaticValue = valueToken.type === "string" || valueToken.type === "template";
    if (!followsPropertyBoundary || !isSlugKey || separatorToken.value !== ":" || !isStaticValue) continue;

    const slug = valueToken.value;
    if (seen.has(slug)) {
      addIssue(issues, rootDirectory, filePath, "duplicate-slug", `Duplicate slug: ${slug}`);
    } else {
      seen.add(slug);
    }
  }
}

export async function validateSite(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const issues = [];

  for (const filePath of sourceFiles(root)) {
    const source = decodeSource(issues, root, filePath);
    if (source === null) continue;

    if (source.includes("\uFFFD")) {
      addIssue(issues, root, filePath, "replacement-character", "File contains a visible Unicode replacement character (U+FFFD).");
    }

    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".html") {
      const { html: scannableHtml, titleText } = htmlForScanning(source);
      validateHtmlReferences(issues, root, filePath, scannableHtml);
      validatePageContract(issues, root, filePath, scannableHtml, titleText);
    }
    if (MODULE_EXTENSIONS.has(extension)) {
      const uncommentedSource = stripJavaScriptComments(source);
      validateModuleImports(issues, root, filePath, maskJavaScriptTemplateLiterals(uncommentedSource));
      validateDuplicateSlugs(issues, root, filePath, source);
    }
  }

  return issues;
}
