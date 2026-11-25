import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", weight: ["500", "600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Tempero · tu explotación, en su punto",
  description: "Mapa de parcelas SIGPAC, lluvia y riego, plan de abonado y cuaderno de campo para explotaciones agrícolas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${archivo.variable} ${inter.variable} ${jet.variable}`}>
      <body>{children}</body>
    </html>
  );
}
