import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const manifestPath = join(process.cwd(), "public/cursors/manifest.json");
    if (!existsSync(manifestPath)) {
      return NextResponse.json({ error: "Manifest not found" }, { status: 404 });
    }

    const data = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const cursorsWithMeta = data.cursors.map((cursor: { id: string; name: string; file: string }) => {
      let description = "Expressive hand-drawn multi-state cursor with precision interactive transformations.";
      if (cursor.id.toLowerCase() === "handy") {
        description = "Expressive hand-drawn multi-state cursor with precision responsive transformations.";
      }

      return {
        ...cursor,
        description,
        fileUrl: `/cursors/${cursor.file}`,
        agentPrompt: `Install Curases cursor engine in this project using the '${cursor.id}' style. Set data-cursor="${cursor.id}", data-size="1.0", and data-speed="1.0". Reference docs: https://curases.com/llms.txt.`,
        cdnScript: `<script src="https://curases.com/engine.js" data-cursor="${cursor.id}" data-size="1.0" data-speed="1.0" defer></script>`,
      };
    });

    return NextResponse.json({
      name: "Curases Registry",
      version: "1.0.0",
      engineUrl: "https://curases.com/engine.js",
      llmsTxt: "https://curases.com/llms.txt",
      llmsFullTxt: "https://curases.com/llms-full.txt",
      cursors: cursorsWithMeta,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to read registry" }, { status: 500 });
  }
}
