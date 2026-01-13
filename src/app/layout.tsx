import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import Footer from "@/components/footer";
import { Providers } from "../components/providers";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import { UpdateNotification } from "@/components/pwa/update-notification";

import "./globals.css";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hoador",
    template: "%s | Hoador",
  },
  description:
    "Your neighborhood tool rental marketplace. Borrow tools from neighbors, save money, and build community.",
  keywords: ["tool rental", "neighborhood marketplace", "community sharing"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Resource hints for external domains */}
        {/* Note: Google Fonts preconnect is handled automatically by next/font/google */}
        {/* Preconnect to Vercel Blob storage for images */}
        <link
          rel="preconnect"
          href="https://hvom5mpictiugrk9.public.blob.vercel-storage.com"
        />
        {/* Preload critical resources */}
        <link
          rel="preload"
          href="/site.webmanifest"
          as="manifest"
          crossOrigin="anonymous"
        />
        <link rel="preload" href="/sw.js" as="script" crossOrigin="anonymous" />
        {/* Icons */}
        <link
          rel="icon"
          type="image/png"
          href="/favicon-96x96.png"
          sizes="96x96"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        {/* PWA capability meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS-specific meta tags for PWA (keeping for Safari compatibility) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Hoador" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <OfflineIndicator position="top" />
            {children}
            <Footer />
            <UpdateNotification position="bottom" />
            <InstallPrompt variant="banner" position="bottom" />
          </ThemeProvider>
        </Providers>
        <Toaster richColors />
      </body>
    </html>
  );
}
