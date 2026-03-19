import Link from "next/link";
import { SocialLinks } from "../components/SocialLinks";
import { socialLinks } from "../config/social";

export const metadata = {
  title: "Соцсети",
  description:
    "Каналы RTS Game в социальных сетях: ВКонтакте, Telegram, Макс. Подписывайтесь на новости и обновления.",
};

export default function SocialPage() {
  if (socialLinks.length === 0) {
    return (
      <main className="min-h-screen py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Соцсети</h1>
          <p className="text-slate-400 mb-6">
            Каналы пока не настроены.
          </p>
          <Link
            href="/"
            className="text-sky-400 hover:text-sky-300 font-medium"
          >
            ← На главную
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Соцсети</h1>
        <p className="text-slate-400 mb-8">
          Подписывайтесь на новости и обновления игры.
        </p>
        <SocialLinks className="justify-center" />
        <div className="mt-12 pt-8 border-t border-slate-700">
          <Link
            href="/"
            className="text-sky-400 hover:text-sky-300 font-medium"
          >
            ← На главную
          </Link>
        </div>
      </div>
    </main>
  );
}
