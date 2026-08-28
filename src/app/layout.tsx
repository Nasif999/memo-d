import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Plex was drawn for an office-machine company, which is exactly what this is:
// institutional without costume. The mono carries every identifier — memo
// numbers, invite codes, timestamps — so records read as records.
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
