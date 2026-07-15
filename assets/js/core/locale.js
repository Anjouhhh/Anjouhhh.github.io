export function getPageLocale(documentRef = globalThis.document) {
  const language = documentRef?.documentElement?.lang?.toLowerCase() ?? "";
  return language.startsWith("zh") ? "zh" : "en";
}

