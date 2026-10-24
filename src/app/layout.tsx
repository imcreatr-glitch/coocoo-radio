import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Gurmukhi } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='0.9em' font-size='90'%3E%F0%9F%90%93%3C/text%3E%3C/svg%3E",
  },
  openGraph: {
    title: "CooCoo Radio 24x7",
    description: "Punjabi • English — 24x7 live desi radio with a morning rooster!",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
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
      </body>
    </html>
  );
}
