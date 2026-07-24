export interface PdfWord {
  text: string;
  page: number;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export interface PdfLine {
  page: number;
  top: number;
  bottom: number;
  x0: number;
  x1: number;
  text: string;
  words: PdfWord[];
}

export interface ExtractedPdf {
  pages: number;
  lines: PdfLine[];
}

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

type PdfjsWorkerGlobal = typeof globalThis & {
  pdfjsWorker?: {
    WorkerMessageHandler: unknown;
  };
};

export async function extractPdfText(buffer: ArrayBuffer): Promise<ExtractedPdf> {
  ensureServerDomMatrix();
  await ensurePdfjsWorkerGlobal();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;
  const lines: PdfLine[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const words: PdfWord[] = [];

    for (const item of content.items as TextItem[]) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const top = viewport.height - y - item.height;
      const bottom = viewport.height - y;
      words.push(...splitTextItem(item.str, x, item.width, top, bottom, pageNumber));
    }

    lines.push(...groupWordsIntoLines(words));
  }

  return { pages: pdf.numPages, lines };
}

async function ensurePdfjsWorkerGlobal(): Promise<void> {
  const target = globalThis as PdfjsWorkerGlobal;
  if (target.pdfjsWorker?.WorkerMessageHandler) return;
  target.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
}

function ensureServerDomMatrix(): void {
  if (typeof globalThis.DOMMatrix !== "undefined") return;

  class ServerDOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;

    constructor(init?: number[]) {
      if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }

    multiplySelf(): this {
      return this;
    }

    preMultiplySelf(): this {
      return this;
    }

    translate(): this {
      return this;
    }

    scale(): this {
      return this;
    }

    invertSelf(): this {
      return this;
    }
  }

  Object.defineProperty(globalThis, "DOMMatrix", {
    value: ServerDOMMatrix,
    configurable: true,
    writable: true,
  });
}

function splitTextItem(text: string, x: number, width: number, top: number, bottom: number, page: number): PdfWord[] {
  const matches = [...text.matchAll(/\S+/g)];
  if (matches.length === 0) return [];
  const units = text.length || 1;
  return matches.map((match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    return {
      text: match[0],
      page,
      x0: x + (width * start) / units,
      x1: x + (width * end) / units,
      top,
      bottom,
    };
  });
}

function groupWordsIntoLines(words: PdfWord[]): PdfLine[] {
  const sorted = [...words].sort((a, b) => a.top - b.top || a.x0 - b.x0);
  const groups: PdfWord[][] = [];

  for (const word of sorted) {
    const group = groups.find((candidate) => Math.abs(avg(candidate.map((w) => w.top)) - word.top) <= 3);
    if (group) group.push(word);
    else groups.push([word]);
  }

  return groups
    .map((group) => {
      const wordsInLine = group.sort((a, b) => a.x0 - b.x0);
      return {
        page: wordsInLine[0].page,
        top: avg(wordsInLine.map((word) => word.top)),
        bottom: Math.max(...wordsInLine.map((word) => word.bottom)),
        x0: Math.min(...wordsInLine.map((word) => word.x0)),
        x1: Math.max(...wordsInLine.map((word) => word.x1)),
        text: wordsInLine.map((word) => word.text).join(" "),
        words: wordsInLine,
      };
    })
    .sort((a, b) => a.page - b.page || a.top - b.top || a.x0 - b.x0);
}

function avg(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
