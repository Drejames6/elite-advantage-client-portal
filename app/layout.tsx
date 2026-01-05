import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Elite Advantage Tax Group",
  description: "Secure Client Portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
