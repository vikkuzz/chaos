import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-white">RTS Game Engine Demo</h1>
        <p className="text-slate-300">
          Выберите режим игры.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/game"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium"
          >
            Локальная игра
          </Link>
          <span
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-slate-500 text-slate-400 font-medium cursor-not-allowed"
            aria-disabled="true"
            title="Временно недоступно"
          >
            Мультиплеер
          </span>
        </div>
      </div>
    </main>
  );
}
