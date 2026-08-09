import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: "Coordinatez AXIS POWER+ Gen 2 — Interactive Pergola",
    description:
      "Explore the Coordinatez AXIS POWER+ Gen 2 in real-time 3D, compare specifications, watch product and installation films, and configure a complete outdoor room.",
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
}

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
