import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Both Hands on the Wheel", template: "%s | Both Hands on the Wheel" },
  description: "Lead yourself. Develop others. Build a life by design. A personal leadership and coaching platform by Jason Mosley, Mosley Foundry.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F1EA" }, { media: "(prefers-color-scheme: dark)", color: "#0C0F15" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
