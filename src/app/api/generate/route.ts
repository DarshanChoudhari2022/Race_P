import { NextResponse } from "next/server";
import { racesSchema } from "@/lib/schemas/race";
import { exportPosterZip } from "@/lib/poster/exportZip";

export const runtime = "nodejs";

/**
 * Maximum execution time for the generate endpoint.
 * Vercel Pro allows 300s, Hobby allows 60s. Set to 300 for Pro.
 * If you're on Hobby, lower this to 60.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // --- 1. Parse & validate request body ---
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 },
      );
    }

    const parsed = (payload as Record<string, unknown>)?.races;
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'races' array." },
        { status: 400 },
      );
    }

    let races;
    try {
      races = racesSchema.parse(parsed);
    } catch (zodError) {
      const message = zodError instanceof Error ? zodError.message : "Validation failed";
      return NextResponse.json(
        { error: `Race data validation failed: ${message}` },
        { status: 400 },
      );
    }

    // --- 2. Generate poster assets ---
    const archive = await exportPosterZip(races);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[generate] ZIP created: ${archive.fileName} (${(archive.bytes.length / 1024).toFixed(0)} KB) in ${elapsed}s`);

    return new NextResponse(new Uint8Array(archive.bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.fileName}"`,
        "X-Generation-Time": `${elapsed}s`,
      },
    });
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const message = error instanceof Error ? error.message : "Unknown generation error";
    console.error(`[generate] Failed after ${elapsed}s: ${message}`);

    // Provide user-friendly error messages for known failure patterns
    const userMessage = diagnoseError(message);

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

/**
 * Maps internal error messages to user-friendly diagnostics.
 */
function diagnoseError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("chromium") && lower.includes("launch")) {
    return "The poster rendering engine (Chromium) could not start. This is a server configuration issue — please try again or contact support.";
  }

  if (lower.includes("page crashed") || lower.includes("target closed") || lower.includes("browser has been closed")) {
    return "The rendering engine ran out of memory while generating your posters. Try reducing the number of races or try again shortly.";
  }

  if (lower.includes("font") && (lower.includes("not found") || lower.includes("enoent"))) {
    return "Required poster font files are missing from the server deployment. Please contact support.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Poster generation timed out. This can happen with many races. Please try with fewer races or try again.";
  }

  if (lower.includes("memory") || lower.includes("oom") || lower.includes("heap")) {
    return "Server ran out of memory during poster generation. Try with fewer races or try again shortly.";
  }

  if (lower.includes("zip")) {
    return "Failed to package the poster files into a ZIP archive. Please try again.";
  }

  // Fallback: return the original message
  return message;
}
