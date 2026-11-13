import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Atelier Garment Rack — 3D Boutique Clothing & Multi-Size Receipt Studio",
  description:
    "3D Boutique clothing rack experience with interactive garment inspection, customizable shirt sizes, and multi-size receipt printing studio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="th"
      className={`${cinzel.variable} ${cormorant.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0c0907] text-[#e8ded2] overflow-hidden select-none print:overflow-visible print:bg-white print:text-black print:select-text">
        {children}
      </body>
    </html>
  );
}
