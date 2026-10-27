import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import InstallPrompt from "@/components/site/install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoGurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-gurmukhi",
  subsets: ["gurmukhi"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CooCoo Radio 24x7 — ਪੰਜਾਬੀ • English Live Radio",
  description:
    "24x7 live desi radio: Punjabi and English music, latest news, scheduled shows with YouTube videos, image + video ads — and a rooster that crows Coo coo kdooo every morning!",
  keywords: ["punjabi radio", "live radio 24x7", "desi radio", "coocoo radio", "bhangra", "news"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "CooCoo Radio",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "CooCoo Radio 24x7",
    description: "Punjabi • English — 24x7 live desi radio with a morning rooster!",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pa" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoGurmukhi.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        {/* PWA install prompt — registers /sw.js and shows install CTA when ready */}
        <InstallPrompt />
      </body>
    </html>
  );
}
