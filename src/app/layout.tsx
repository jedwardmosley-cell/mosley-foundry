import type { Metadata, Viewport } from "next";
import "@fontsource-variable/overpass/index.css";
import "@fontsource-variable/newsreader/opsz.css";
// The book's own typeface, for the chapter pages.
import "@fontsource/alegreya/400.css";
import "@fontsource/alegreya/400-italic.css";
import "@fontsource/alegreya/500.css";
import "./globals.css";
import { Suspense } from "react";
import { ScrollTop } from "@/components/ScrollTop";

export const metadata: Metadata = {
  title: { default: "Both Hands on the Wheel", template: "%s | Both Hands on the Wheel" },
  description: "Lead yourself. Develop others. Build a life by design. A personal leadership and coaching platform by Jason Mosley, Mosley Foundry.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F1EA" }, { media: "(prefers-color-scheme: dark)", color: "#0C0F15" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Suspense fallback={null}><ScrollTop /></Suspense>{children}</body>
    </html>
  );
}
