import type { Metadata, Viewport } from "next";
import "./globals.css";
import AdultGate from "@/components/AdultGate";
import { APPEARANCE_BOOTSTRAP } from "@/lib/appearance";

export const metadata: Metadata = {
  title: "在场 · Philosopher's Café",
  description: "给独自吃饭的人，一顿有人在场的饭。",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f2ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1419" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }} /></head>
      <body className="grain vignette min-h-screen antialiased">
        <AdultGate>{children}</AdultGate>
      </body>
    </html>
  );
}
