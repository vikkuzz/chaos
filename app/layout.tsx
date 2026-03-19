import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Header } from "./components/Header";
import { GamePageHudProvider } from "@/lib/GamePageHudContext";

export const metadata: Metadata = {
  title: {
    default: "RTS Game — стратегия в реальном времени",
    template: "%s | RTS Game",
  },
  description:
    "Браузерная RTS-игра: 4 игрока, замки, бараки, башни, герои и нейтральные точки. Локальная симуляция и мультиплеер. Играйте бесплатно.",
  keywords: [
    "RTS",
    "стратегия",
    "игра в браузере",
    "многопользовательская игра",
    "тактическая игра",
  ],
  openGraph: {
    title: "RTS Game — стратегия в реальном времени",
    description:
      "Браузерная RTS-игра: 4 игрока, замки, бараки, башни, герои. Локальная симуляция и мультиплеер.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RTS Game — стратегия в реальном времени",
    description: "Браузерная RTS-игра: 4 игрока, замки, бараки, башни, герои.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-slate-900 text-slate-100">
        <GamePageHudProvider>
          <Header />
          {children}
        </GamePageHudProvider>
      </body>
    </html>
  );
}
