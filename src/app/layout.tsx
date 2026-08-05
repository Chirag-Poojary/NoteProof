import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ─── Viewport ─────────────────────────────────────────────────────────────── */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,        // prevent accidental pinch-zoom on mobile
  userScalable: false,
  themeColor: "#ffffff",
};

/* ─── SEO + OpenGraph Metadata ─────────────────────────────────────────────── */
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://noteproof.vercel.app"
  ),
  title: {
    default: "NoteProof — Noticing Notes",
    template: "%s | NoteProof",
  },
  description:
    "Instantly identify and verify Indian Rupee notes using on-device AI. No internet required — all inference runs locally in your browser via ONNX Runtime.",
  keywords: [
    "Indian currency scanner",
    "rupee note detector",
    "fake note detection",
    "ONNX edge inference",
    "offline currency recognition",
    "Indian rupee AI",
  ],
  authors: [{ name: "NoteProof" }],
  creator: "NoteProof",
  applicationName: "NoteProof",
  category: "Finance",
  openGraph: {
    type: "website",
    locale: "en_IN",
    title: "NoteProof — Noticing Notes",
    description:
      "Point your camera at any Indian Rupee note to instantly identify its denomination and verify authenticity — 100% on-device AI.",
    siteName: "NoteProof",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "NoteProof currency scanner app preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NoteProof — Noticing Notes",
    description:
      "On-device AI that identifies Indian Rupee denominations and checks authenticity — no data leaves your phone.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* ─── Root Layout ──────────────────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* Preconnect for ONNX WASM CDN */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
