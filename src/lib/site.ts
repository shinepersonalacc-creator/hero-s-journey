export const OFFICIAL_SITE_URL = "https://heros-journey.xyz";

const ENV_SITE_URL = import.meta.env.VITE_SITE_URL;

export function getSiteUrl() {
  if (ENV_SITE_URL) {
    return ENV_SITE_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return OFFICIAL_SITE_URL;
}