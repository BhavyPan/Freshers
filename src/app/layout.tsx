import type { Metadata, Viewport } from "next";
import { Geist_Mono, Space_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OBSIDIAN '26 — Smart QR Entry | Freshers 2K26",
  description:
    "OBSIDIAN '26 Freshers — official Smart QR Entry & Access Management System. Scan, verify your Student ID, and unfold the unknown.",
  keywords: ["OBSIDIAN 26", "Freshers 2K26", "QR Entry", "Access Management", "Check-in"],
  authors: [{ name: "OBSIDIAN '26 Team" }],
  icons: {
    icon: "/obsidian-icon.svg",
    apple: "/obsidian-icon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OBSIDIAN '26",
  },
  openGraph: {
    title: "OBSIDIAN '26 — Unfold the Unknown",
    description: "Smart QR Entry & Access Management System for Freshers 2K26",
    siteName: "OBSIDIAN '26",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0614",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${unbounded.variable} ${spaceGrotesk.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
