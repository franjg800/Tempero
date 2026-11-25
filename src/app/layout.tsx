import type { Metadata } from "next";
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz", "SOFT"], display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["500"], display: "swap" });

export const metadata: Metadata = {
  title: "Tempero · tu explotación, en su punto",
  description: "Mapa de parcelas SIGPAC, lluvia y riego, plan de abonado y cuaderno de campo para explotaciones agrícolas.",
  openGraph: {
    title: "Tempero · tu explotación, en su punto",
    description: "Marca tu finca en el mapa. Tempero calcula el riego, el abonado y te lleva el cuaderno de campo.",
    images: ["/hero-pnoa.jpg"],
    locale: "es_ES",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${instrument.variable} ${jet.variable}`}>
      <body>{children}</body>
    </html>
  );
}
