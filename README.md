# Race Card Poster Generator

Local Next.js app for converting an IndiaRace race-card PDF into editable race data and print-ready posters.

## Commands

```bash
npm install
npx playwright install chromium
npm run dev
npm run test
npm run build
```

Open `http://localhost:3000`, upload the race-card PDF, review or correct the extracted data, then download the ZIP.

## Outputs

The ZIP contains:

- one individual vector PDF per race
- one combined multi-page vector PDF
- one PNG per race

Each PDF page is exactly `250mm x 760mm` via:

```css
@page {
  size: 250mm 760mm;
  margin: 0;
}
```

Poppins is bundled locally from `@fontsource/poppins`; export does not depend on Google Fonts.

## Docker

```bash
docker build -t race-card-poster-generator .
docker run --rm -p 3000:3000 race-card-poster-generator
```

## Notes

The parser uses native PDF text and coordinates first. OCR fallback is intentionally reserved for image-only PDFs because native text is more accurate for trainer and jockey columns.
