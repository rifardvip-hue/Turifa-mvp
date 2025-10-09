import type { Metadata } from "next";
import { Inter } from "next/font/google"; // ✅ Importamos Inter
import "./globals.css";

// ✅ Cargamos la fuente Inter desde Google Fonts con variables para Tailwind
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sistema de Rifas",
  description: "Generado por Create Next App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
