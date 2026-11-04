import type { Metadata } from "next";
import { Inter, Nunito_Sans, Playpen_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playpen = Playpen_Sans({
  subsets: ["latin"],
  variable: "--font-playpen",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Curases — The Agentic Custom Cursor Engine for the Web",
  description:
    "Zero-dependency custom cursor engine with instant AI agent prompts, CDN script delivery, and multi-state SVG presets for any web stack.",
  keywords: [
    "custom cursor",
    "cursor engine",
    "agentic ui",
    "cursor rules",
    "llms.txt",
    "web cursor",
    "framer cursor",
    "react cursor",
  ],
  authors: [{ name: "Curases" }],
  openGraph: {
    title: "Curases — The Agentic Custom Cursor Engine for the Web",
    description:
      "Zero-dependency custom cursor engine with instant AI agent prompts, CDN script delivery, and multi-state SVG presets for any web stack.",
    url: "https://curases.com",
    siteName: "Curases",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${inter.variable} ${playpen.variable} h-full antialiased`}
    >
      <head>
        {/* Curases Custom Cursor Engine */}
        <Script
          src="/engine.js?v=sandbox-fix-1"
          strategy="afterInteractive"
          data-cursor="Handy"
          data-size="1.0"
          data-speed="1.0"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white font-sans text-ink">
        {children}
      </body>
    </html>
  );
}
