export const OFFICIAL_SITE_URL = "https://heros-journey.xyz";
export const LOCAL_SITE_URL = import.meta.env.VITE_SITE_URL;

export function getSiteUrl() {
  if (LOCAL_SITE_URL) {
    return LOCAL_SITE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return OFFICIAL_SITE_URL;
}
