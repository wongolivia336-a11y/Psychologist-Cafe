import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "在场 · Philosopher's Café",
  description: "给独自吃饭的人，一顿有人在场的饭。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="grain vignette min-h-screen antialiased">{children}</body>
    </html>
  );
}
