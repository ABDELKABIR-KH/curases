import type { NextRequest } from "next/server";

/**
 * Cursor packs are public UI assets: they are rendered inline as SVG on the
 * customer's page, so they can always be inspected in devtools. Delivery is
 * therefore open to every origin by default, which is what makes the
 * drop-in CDN script work on any domain (Framer, Webflow, custom sites).
 *
 * Strict mode is opt-in. Set CURASES_ALLOWED_ORIGINS to a comma separated
 * list of full origins, or CURASES_PUBLIC_CDN=false, to restrict who can
 * read packs:
 *
 *   CURASES_ALLOWED_ORIGINS=https://acme.com,https://app.acme.com
 *
 * In strict mode only the configured origins (plus the defaults below) are
 * served, and responses are origin-reflected and never shared by a CDN.
 *
 * Direct browser navigation to a pack is always blocked, in both modes.
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

function getConfiguredOrigins(): string[] {
  return (process.env.CURASES_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins(): Set<string> {
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...getConfiguredOrigins()]);
}

function isOriginAllowed(origin: string): boolean {
  return getAllowedOrigins().has(origin);
}

/**
 * True unless an operator explicitly opted into strict origin gating.
 *
 * CURASES_PUBLIC_CDN=true   -> force public delivery
 * CURASES_PUBLIC_CDN=false  -> force strict delivery
 * CURASES_ALLOWED_ORIGINS   -> strict delivery
 * otherwise                 -> public delivery
 */
export function isPublicDelivery(): boolean {
  if (process.env.CURASES_PUBLIC_CDN === "true") return true;

  if (process.env.CURASES_PUBLIC_CDN === "false") return false;

  return getConfiguredOrigins().length === 0;
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
 * Direct navigation (opening the URL in a tab) is always rejected. In public
 * mode every other request is served; in strict mode the Origin/Referer must
 * match the allow-list.
 */
export function isAllowedAssetRequest(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "none") return false;

  if (isPublicDelivery()) return true;

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
    "Access-Control-Allow-Methods": "GET, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, X-Curases-Key",
    "Access-Control-Max-Age": "86400",
  };

  if (isPublicDelivery()) {
    // One shared, CDN-cacheable response for every origin.
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  headers.Vary = "Origin";

  const origin = getRequestOrigin(request);
  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function getAssetCacheHeaders(): Record<string, string> {
  if (isPublicDelivery()) {
    return {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    };
  }

  // Keep the gate re-evaluated: a cached response must not outlive a domain
  // being removed from the allow-list.
  return {
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
}
