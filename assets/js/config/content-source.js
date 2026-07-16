/**
 * Optional remote content configuration.
 *
 * Leave the Jant URLs empty to keep using the checked-in local data. These
 * values are public configuration only; never put a Jant API token here.
 */
export const JANT_PUBLIC_API_BASE_URL = "https://my-site.coolz0928.workers.dev";
export const JANT_PUBLIC_API_BASE_URL_ZH = "https://my-site.coolz0928.workers.dev";
export const JANT_PUBLIC_COLLECTION_SLUG = "english";
export const JANT_PUBLIC_COLLECTION_SLUG_ZH = "chinese";

/**
 * `archive` includes public posts marked Hidden from Latest. Keep the
 * Chinese mirror on the curated Latest endpoint unless you want hidden
 * Chinese posts to appear there too.
 */
export const JANT_PUBLIC_CONTENT_MODE = {
  en: "archive",
  zh: "latest"
};

/**
 * Full sign-in URL for the Jant writing dashboard. Leave empty to hide the
 * optional dashboard link from the public site.
 */
export const JANT_ADMIN_URL = "https://my-site.coolz0928.workers.dev/signin";
