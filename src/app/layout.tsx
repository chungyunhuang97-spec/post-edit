import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Newsreader,
  Archivo_Black,
  Playfair_Display,
  Space_Grotesk,
  Caveat,
  Bebas_Neue,
  Pacifico,
  Fraunces,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: ["400"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: ["400"],
});

const pacifico = Pacifico({
  variable: "--font-pacifico",
  subsets: ["latin"],
  weight: ["400"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const fontVariables = [
  geistSans.variable,
  geistMono.variable,
  newsreader.variable,
  archivoBlack.variable,
  playfairDisplay.variable,
  spaceGrotesk.variable,
  caveat.variable,
  bebasNeue.variable,
  pacifico.variable,
  fraunces.variable,
].join(" ");

export const metadata: Metadata = {
  title: "BE4 THE POST",
  description: "上傳一張照片，拖曳挖空方塊，生成帶有詩意文案的社群海報。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${fontVariables} h-full antialiased`}>
      <body className="h-dvh overflow-hidden bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
