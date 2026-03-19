import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Играть",
  description:
    "Играйте в RTS Game — локальная симуляция или мультиплеер. 4 игрока, замки, бараки, герои.",
};

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
