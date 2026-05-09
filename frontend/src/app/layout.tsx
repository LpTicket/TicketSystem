import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import { LanguageProvider } from "@/context/LanguageContext";
import { CategoryProvider } from "@/context/CategoryContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "LPTicket — Tu plataforma de tickets en línea",
  description: "Compra tickets para los mejores eventos: conciertos, teatro, deportes y más. Plataforma segura con pagos por Stripe.",
  keywords: "tickets, eventos, conciertos, teatro, deportes, comprar boletos, LPTicket",
  icons: {
    icon: "/image.png",
    shortcut: "/image.png",
    apple: "/image.png",
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
      <body className="antialiased">
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
