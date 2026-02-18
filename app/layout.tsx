import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stamp Collection",
  description: "Stamp Collection with OCR background processing"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="text-ink antialiased">{children}</body>
    </html>
  );
}
