import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Both Hands on the Wheel", template: "%s | Both Hands on the Wheel" },
  description: "Lead yourself. Develop others. Build a life by design. A personal leadership and coaching platform by Jason Mosley, Mosley Foundry.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F6F2EA" }, { media: "(prefers-color-scheme: dark)", color: "#0D1118" }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
