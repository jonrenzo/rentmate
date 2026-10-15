import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Rentmate",
  description: "A little more clarity. A lot less paperwork.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/rentmate-logo.png", apple: "/rentmate-logo.png" },
  appleWebApp: { capable: true, title: "Rentmate", statusBarStyle: "default" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f5f5f7",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
