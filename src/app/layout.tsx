import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Race Card Poster Generator",
  description: "Extract IndiaRace race-card PDFs and generate print-ready race posters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
