import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coordinatez Account — Project Studio",
  description: "Sign in to save and manage Coordinatez AXIS pergola configurations.",
};

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
