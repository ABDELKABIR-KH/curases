import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import {
  getAssetCacheHeaders,
  getAssetCorsHeaders,
  isAssetRequestAuthorized,
} from "@/lib/cursorSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANIFEST_PATH = join(process.cwd(), "public/cursors/manifest.json");
const CURSORS_DIR = join(process.cwd(), "src/data/cursors");

interface CursorManifest {
  cursors: Array<{ id: string; name: string; file: string }>;
}

async function readManifest(): Promise<CursorManifest> {
  const raw = await readFile(MANIFEST_PATH, "utf-8");
  const data = JSON.parse(raw) as CursorManifest;

  if (!data || !Array.isArray(data.cursors)) {
    throw new Error("Invalid cursor manifest");
  }

  return data;
}

function resolveCursorPath(file: string): string | null {
  const root = resolve(CURSORS_DIR);
  const candidate = resolve(root, file);

  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }

  return candidate;
}

function jsonError(
  message: string,
  status: number,
  headers: Record<string, string>
) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const corsHeaders = getAssetCorsHeaders(request);

  if (!isAssetRequestAuthorized(request)) {
    return jsonError("Forbidden", 403, corsHeaders);
  }

  const { file } = await params;

  if (!file || file.length > 128 || !/^[a-zA-Z0-9._-]+$/.test(file)) {
    return jsonError("Invalid cursor file", 400, corsHeaders);
  }

  try {
    const manifest = await readManifest();
    const requested = file.toLowerCase();
    const withJson = requested.endsWith(".json")
      ? requested
      : `${requested}.json`;

    const entry = manifest.cursors.find(
      (cursor) =>
        cursor.file.toLowerCase() === withJson ||
        cursor.id.toLowerCase() === requested
    );

    if (!entry) {
      return jsonError("Cursor not found", 404, corsHeaders);
    }

    const cursorPath = resolveCursorPath(entry.file);
    if (!cursorPath) {
      return jsonError("Invalid cursor file", 400, corsHeaders);
    }

    const cursor = await readFile(cursorPath, "utf-8");

    return new NextResponse(cursor, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...getAssetCacheHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return jsonError("Cursor not found", 404, corsHeaders);
  }
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getAssetCorsHeaders(request),
  });
}
