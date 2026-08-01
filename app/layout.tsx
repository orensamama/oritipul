import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

// Self-hosted via next/font — fetched and inlined at build time, so there is no
// render-blocking request to Google Fonts on first load (this was previously
// loaded twice: once via <link> and once via @import in globals.css).
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "הסלון | סיכום פגישות",
  description: "מערכת חכמה לסיכום פגישות טיפוליות",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4d8050",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
