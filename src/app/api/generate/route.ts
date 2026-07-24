import { NextResponse } from "next/server";
import { racesSchema } from "@/lib/schemas/race";
import { exportPosterZip } from "@/lib/poster/exportZip";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const payload = await request.json();
  const races = racesSchema.parse(payload.races);
  const archive = await exportPosterZip(races);
  return new NextResponse(new Uint8Array(archive.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.fileName}"`,
    },
  });
}
