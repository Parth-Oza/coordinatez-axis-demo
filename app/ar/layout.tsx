import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Place AXIS in your space | Coordinatez",
  description: "Preview a true-scale Coordinatez AXIS pergola in your patio using native augmented reality.",
};

export default function AugmentedRealityLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
