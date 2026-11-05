import { NextResponse, type NextRequest } from "next/server";

const ENGINE_PATHS = new Set(["/engine.js", "/cursor-engine.js"]);
const PUBLIC_CURSOR_FILES = new Set(["/cursors/manifest.json"]);

const DOCUMENT_DESTINATIONS = new Set([
  "document",
  "iframe",
  "frame",
  "embed",
  "object",
]);

function forbidden() {
  return new NextResponse("Forbidden", {
    status: 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function hardenedEngineResponse() {
  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ENGINE_PATHS.has(pathname)) {
    const destination = request.headers.get("sec-fetch-dest");
    const mode = request.headers.get("sec-fetch-mode");

    // A browser tab opening the engine URL is a document navigation, not a
    // script request. Send casual browsers back to the site instead of
    // exposing the engine as a readable page.
    if (destination === "document" || mode === "navigate") {
      return NextResponse.redirect(new URL("/", request.url), 307);
    }

    // Frames/objects are never a legitimate way to load the engine.
    if (destination && DOCUMENT_DESTINATIONS.has(destination)) {
      return forbidden();
    }

    return hardenedEngineResponse();
  }

  if (pathname.startsWith("/cursors/")) {
    // The manifest is public metadata. Cursor packs themselves live behind
    // /api/cursors/* and are origin-gated.
    if (PUBLIC_CURSOR_FILES.has(pathname)) {
      return NextResponse.next();
    }

    return forbidden();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/engine.js", "/cursor-engine.js", "/cursors/:path*"],
};
