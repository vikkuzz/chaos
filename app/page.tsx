import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">RTS Game Engine Demo</h1>
        <p className="text-slate-300">
          Откройте страницу игры, чтобы увидеть канвас и симуляцию.
        </p>
        <Link
          href="/game"
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium"
        >
          Перейти к игре
        </Link>
      </div>
    </main>
  );
}
