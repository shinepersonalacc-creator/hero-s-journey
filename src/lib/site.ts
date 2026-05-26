export const LOCAL_SITE_URL = import.meta.env.VITE_SITE_URL ?? "";

export function getSiteUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return LOCAL_SITE_URL || "https://example.invalid";
}
