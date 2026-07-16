import type { Metadata } from "next";
import { Archivo, Inter, Great_Vibes } from "next/font/google";
import MagmaSymbol from "@/components/MagmaSymbol";
import "../styles/tokens.css";
import "../styles/lp.css";
import "../styles/fonts-bridge.css";
import "../styles/home.css";
import "../styles/platform.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://magmacursosltda.com.br",
  ),
  title: "Magma Cursos",
  description: "Formação presencial com prática real e certificado verificável.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${inter.variable} ${greatVibes.variable}`}
    >
      <body>
        <MagmaSymbol />
        {children}
      </body>
    </html>
  );
}
