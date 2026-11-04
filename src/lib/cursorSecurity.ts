import type { NextRequest } from "next/server";

/**
 * Origins that are allowed to read cursor packs from the asset API.
 *
 * Add customer domains with the CURASES_ALLOWED_ORIGINS environment variable
 * (comma separated, full origins only):
 *
 *   CURASES_ALLOWED_ORIGINS=https://acme.com,https://app.acme.com
 *
 * Set CURASES_PUBLIC_CDN=true to keep the old public-CDN behaviour and allow
 * every origin. Direct browser navigation is still blocked in that mode.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://curases.com",
  "https://www.curases.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function parseOrigin(value: string | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(): Set<string> {
  const configured = (process.env.CURASES_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isOriginAllowed(origin: string): boolean {
  return getAllowedOrigins().has(origin);
}

/** The Origin header, or the origin of the Referer when Origin is absent. */
export function getRequestOrigin(request: NextRequest): string | null {
  return (
    parseOrigin(request.headers.get("origin")) ||
    parseOrigin(request.headers.get("referer"))
  );
}

/**
 * Gate cursor JSON requests.
 *
 * Browsers send Origin/Referer on cross-origin fetches. Same-origin GETs may
 * omit both, but always carry Sec-Fetch-Site. Direct navigation (opening the
 * URL in a tab) is always rejected.
 */
export function isAllowedAssetRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "none") return false;

  if (process.env.CURASES_PUBLIC_CDN === "true") return true;

  const origin = getRequestOrigin(request);
  if (origin) return isOriginAllowed(origin);

  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;

  // Non-browser clients (curl, server-side fetch) have no Origin/Referer and
  // no Sec-Fetch-* headers. Keep them out of production unless explicitly
  // allowed (useful for tests or a trusted server-side integration).
  if (process.env.CURASES_ALLOW_SERVER_REQUESTS === "true") return true;

  return process.env.NODE_ENV !== "production";
}

/** Optional shared-secret check on top of the origin allow-list. */
export function isAssetRequestAuthorized(request: NextRequest): boolean {
  if (!isAllowedAssetRequest(request)) return false;

  const requiredKey = process.env.CURASES_API_KEY;
  if (!requiredKey) return true;

  const providedKey =
    request.headers.get("x-curases-key") ||
    request.nextUrl.searchParams.get("key");

  return providedKey === requiredKey;
}

export function getAssetCorsHeaders(
  request: NextRequest
): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, X-Curases-Key",
    "Access-Control-Max-Age": "86400",
  };

  const origin = getRequestOrigin(request);

  if (process.env.CURASES_PUBLIC_CDN === "true") {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function getAssetCacheHeaders(): Record<string, string> {
  // Keep the gate re-evaluated: a cached response must not outlive a domain
  // being removed from the allow-list.
  return {
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
}
