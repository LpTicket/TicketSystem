import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { LanguageProvider } from "@/context/LanguageContext";
import { CategoryProvider } from "@/context/CategoryContext";
import { Toaster } from "react-hot-toast";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lpticket.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "LPTicket — Tu plataforma de tickets en línea",
  description: "Compra tickets para los mejores eventos: conciertos, teatro, deportes y más. Plataforma segura con pagos por Stripe.",
  keywords: "tickets, eventos, conciertos, teatro, deportes, comprar boletos, LPTicket",
  openGraph: {
    title: "LPTicket",
    description: "Compra tickets para los mejores eventos.",
    url: siteUrl,
    siteName: "LPTicket",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "LPTicket" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LPTicket",
    description: "Compra tickets para los mejores eventos.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased overflow-x-hidden w-screen">
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }} />
        <LanguageProvider>
          <CategoryProvider>
            <AppShell>{children}</AppShell>
          </CategoryProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
