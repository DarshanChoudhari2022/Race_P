import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf/extractText";
import { parseRaceCard } from "@/lib/pdf/parseRaceCard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF file using the 'file' form field." }, { status: 400 });
    }

    const extracted = await extractPdfText(await file.arrayBuffer());
    const parsed = parseRaceCard(extracted);
    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
