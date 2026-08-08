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
    title: "Coordinatez — Motorized Pergola Model Range",
    description:
      "Compare Coordinatez Axis motorized pergola systems, then explore each model in an interactive 3D studio.",
    openGraph: {
      title: "Coordinatez Axis — Find Your Structure",
      description: "Compare the complete Coordinatez Axis range and explore every model in 3D.",
      type: "website",
      images: [{ url: "/og.png", width: 1792, height: 930, alt: "Coordinatez Axis motorized pergola at dusk" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Coordinatez Axis — Find Your Structure",
      description: "Compare the complete Coordinatez Axis range and explore every model in 3D.",
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
