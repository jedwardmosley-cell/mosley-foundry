import type { Metadata, Viewport } from "next";
import "@fontsource-variable/overpass/index.css";
import "@fontsource-variable/newsreader/opsz.css";
import "./globals.css";
import { Suspense } from "react";
import { ScrollTop } from "@/components/ScrollTop";

export const metadata: Metadata = {
  title: { default: "Both Hands on the Wheel", template: "%s | Both Hands on the Wheel" },
  description: "Lead yourself. Develop others. Build a life by design. A personal leadership and coaching platform by Jason Mosley, Mosley Foundry.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#EEF0EC" }, { media: "(prefers-color-scheme: dark)", color: "#11161B" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Suspense fallback={null}><ScrollTop /></Suspense>{children}</body>
    </html>
  );
}
