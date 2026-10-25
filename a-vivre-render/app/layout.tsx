import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "À vivre — Ton espace personnel",
  description: "Tes envies, tes objectifs et leurs souvenirs, dans un espace personnel.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/app-icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "À vivre",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
