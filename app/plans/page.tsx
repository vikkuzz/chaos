import Link from "next/link";
import { roadmapSections } from "../data/roadmap";

export const metadata = {
  title: "Планы развития",
  description:
    "Планы развития RTS Game: мультиплеер, новые карты, баланс, реплеи. Roadmap игры.",
};

export default function PlansPage() {
  return (
    <main className="min-h-screen">
      <article className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Планы развития
          </h1>
          <p className="text-slate-400 text-lg mb-12">
            Что планируется добавить в игру. Roadmap обновляется по мере
            разработки.
          </p>

          <div className="space-y-12">
            {roadmapSections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-20"
                aria-labelledby={`${section.id}-heading`}
              >
                <h2
                  id={`${section.id}-heading`}
                  className="text-xl sm:text-2xl font-semibold text-amber-400 mb-6"
                >
                  {section.title}
                </h2>
                <ul className="space-y-4">
                  {section.items.map((item) => (
                    <li
                      key={item.title}
                      className="rounded-lg border border-slate-600 bg-slate-800/80 p-4 sm:p-5"
                    >
                      <h3 className="font-semibold text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-slate-400 text-sm sm:text-base">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-700">
            <Link
              href="/"
              className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
            >
              ← На главную
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}
