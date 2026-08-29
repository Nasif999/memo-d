import type { Metadata } from "next";
import { Instrument_Serif, Azeret_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Editorial voice throughout: serif for headlines, mono for everything that
// reads as a record — labels, identifiers, body copy. Matches the landing
// page's design language site-wide.
const sans = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});

const mono = Azeret_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Memo'd — Inter-Office Memo Management",
  description:
    "Multi-tenant inter-office memo management with sequential approval workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(sans.variable, mono.variable)}>
      <body className="font-mono antialiased">{children}</body>
    </html>
  );
}
