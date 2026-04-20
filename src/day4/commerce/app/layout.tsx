import type { Metadata } from "next";
import { IBM_Plex_Sans, Instrument_Serif, Newsreader } from "next/font/google";
import "./globals.css";
import ConciergeButton from "../components/ConciergeButton";
import ConciergeDrawer from "../components/ConciergeDrawer";
import { ConciergeProvider } from "../lib/concierge";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const newsreader = Newsreader({
  weight: ["300", "400", "500"],
  style: ["italic", "normal"],
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShopAgent · Commerce",
  description:
    "Agentic Commerce — a concept store where every product decision is considered by a three-agent crew reading the ledger and the memory.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${instrumentSerif.variable} ${newsreader.variable} ${plex.variable}`}
    >
      <body>
        <div className="atmosphere" aria-hidden />
        <div className="paper-grain" aria-hidden />
        <ConciergeProvider>
          {children}
          <ConciergeButton />
          <ConciergeDrawer />
        </ConciergeProvider>
      </body>
    </html>
  );
}
