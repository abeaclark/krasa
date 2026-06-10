import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

// GA4 Measurement ID for krasadev.com (carried over from the Vite build).
const GA_MEASUREMENT_ID = "G-4DLFYNXNZZ";

const SITE_URL = "https://krasadev.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Krasa — CTO-Level Tech & AI for Your Brand",
  description:
    "Outsource technology & AI implementation to Krasa's CTO-level experts. Packages from $3,000/month.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Krasa",
    title: "Krasa — CTO-Level Tech & AI for Your Brand",
    description:
      "Outsource technology & AI implementation to Krasa's CTO-level experts. Packages from $3,000/month.",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf8f3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen flex flex-col antialiased"
        style={{
          background: "#faf8f3",
          color: "#0e0f0c",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        }}
      >
        {children}
        <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />
      </body>
    </html>
  );
}
