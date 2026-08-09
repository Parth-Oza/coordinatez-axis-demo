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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b100d",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://coordinatez-axis-demo.ozaparth055.workers.dev"),
  title: "Coordinatez AXIS POWER+ Gen 2 — Interactive Pergola",
  description:
    "Explore the Coordinatez AXIS POWER+ Gen 2 in real-time 3D, compare specifications, watch product and installation films, and configure a complete outdoor room.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Coordinatez AXIS POWER+ Gen 2",
    description: "Configure the complete AXIS POWER+ Gen 2 pergola in real-time 3D.",
    type: "website",
    images: [{ url: "/og.png", width: 1792, height: 930, alt: "Coordinatez Axis motorized pergola at dusk" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coordinatez AXIS POWER+ Gen 2",
    description: "Configure the complete AXIS POWER+ Gen 2 pergola in real-time 3D.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
