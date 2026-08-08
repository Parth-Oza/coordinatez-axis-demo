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
    title: "Coordinatez Axis — Interactive Pergola Studio",
    description:
      "Configure the Coordinatez Axis motorized pergola in an immersive real-time 3D product studio.",
    openGraph: {
      title: "Coordinatez Axis — Architecture That Moves",
      description: "An interactive 3D motorized pergola concept experience.",
      type: "website",
      images: [{ url: "/og.png", width: 1792, height: 930, alt: "Coordinatez Axis motorized pergola at dusk" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Coordinatez Axis — Architecture That Moves",
      description: "An interactive 3D motorized pergola concept experience.",
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
