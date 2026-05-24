export const PRODUCTION_SITE_URL = "https://heros-journey.xyz";

export function getSiteUrl() {
  if (typeof window === "undefined") return PRODUCTION_SITE_URL;

  const { origin, hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") return origin;

  return PRODUCTION_SITE_URL;
}
