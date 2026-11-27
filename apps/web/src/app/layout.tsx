import type { Metadata } from "next";
// Self-hosted fonts (bundled from npm): no build-time download and no request to a
// third-party font CDN from the visitor's browser.
import "@fontsource-variable/cairo";
import "@fontsource-variable/inter";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "معرض الأشياء — سوق البيع والشراء",
  description: "منصة معرض الأشياء لبيع وشراء الأغراض المستعملة والجديدة",
};

import FCMProvider from "@/components/providers/FCMProvider";
import { themeInitScript } from "@/components/ui/ThemeToggle";
import { SessionRestore } from "@/components/auth/SessionRestore";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a light/dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-canvas text-fg">
        <SessionRestore />
        <FCMProvider />
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
