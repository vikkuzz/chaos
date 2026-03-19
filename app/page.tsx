import Link from "next/link";
import { gameParams } from "./data/gameParams";
import { supportConfig } from "./config/support";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "RTS Game",
  description:
    "Браузерная RTS-игра: 4 игрока, замки, бараки, башни, герои и нейтральные точки. Локальная симуляция и мультиплеер.",
  genre: "Strategy",
  gamePlatform: "Web browser",
  playMode: "SinglePlayer, Multiplayer",
};

export const metadata = {
  title: "Главная",
  description:
    "RTS Game — браузерная стратегия в реальном времени. 4 игрока, замки, бараки, башни, герои, нейтральные точки. Параметры юнитов и зданий. Как играть.",
};

function Section({
  id,
  title,
  children,
  className = "",
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`py-12 sm:py-16 scroll-mt-20 ${className}`}
      aria-labelledby={`${id}-heading`}
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <h2
          id={`${id}-heading`}
          className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8"
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function ParamCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string | number }[];
}) {
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800/80 p-4 sm:p-5">
      <h3 className="font-semibold text-amber-400 mb-3">{title}</h3>
      <dl className="space-y-2 text-sm sm:text-base">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-400">{label}</dt>
            <dd className="text-slate-200 font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function HomePage() {
  const { warriorTypes, heroTypes, buildings, neutralPoints } = gameParams;
  const hasSupportUrl = Boolean(supportConfig.url);

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero */}
      <section className="relative py-16 sm:py-24 lg:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-6">
            RTS Game
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 mb-8 sm:mb-10 max-w-2xl mx-auto">
            Стратегия в реальном времени в браузере. Управляйте армией,
            захватывайте нейтральные точки, призывайте героев и побеждайте
            противников.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/game"
              className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-lg transition-colors min-h-[48px]"
            >
              Играть
            </Link>
            <a
              href="#kak-igrat"
              className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 font-medium transition-colors min-h-[48px]"
            >
              Как играть
            </a>
            <Link
              href="/plans"
              className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-200 font-medium transition-colors min-h-[48px]"
            >
              Планы развития
            </Link>
          </div>
        </div>
      </section>

      {/* О игре */}
      <Section id="o-igre" title="О игре">
        <div className="prose prose-invert prose-slate max-w-none">
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            RTS Game — это браузерная стратегия в реальном времени. В игре
            участвуют <strong className="text-white">4 игрока</strong>, каждый
            управляет своей базой с замком, бараками и башнями. Бараки
            автоматически создают воинов (пехотинцев и лучников), которые
            следуют заданным маршрутам. Захватывайте{" "}
            <strong className="text-white">нейтральные точки</strong> для
            получения золота, призывайте{" "}
            <strong className="text-white">героев</strong> и улучшайте здания.
            Побеждает тот, кто уничтожит замки противников.
          </p>
          <ul className="text-slate-300 space-y-2 mt-4 list-disc list-inside">
            <li>
              Карта {gameParams.mapSize}×{gameParams.mapSize} пикселей
            </li>
            <li>4 игрока с уникальными цветами</li>
            <li>Замки, бараки и башни с атакой по области</li>
            <li>3 типа героев с регенерацией и наградой за убийство</li>
            <li>8 нейтральных точек для добычи золота</li>
            <li>Туман войны</li>
          </ul>
        </div>
      </Section>

      {/* Параметры */}
      <Section id="parametry" title="Параметры" className="bg-slate-800/30">
        <p className="text-slate-400 mb-6">
          Базовые характеристики юнитов, героев и зданий.
        </p>

        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">Юниты</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {Object.entries(warriorTypes).map(([id, w]) => (
              <ParamCard
                key={id}
                title={w.name}
                items={[
                  { label: "HP", value: w.maxHp },
                  { label: "Скорость", value: w.speed },
                  { label: "Урон", value: w.attackDamage },
                  { label: "Дальность атаки", value: w.attackRange },
                  { label: "Радиус обзора", value: w.detectionRadius },
                  { label: "Интервал атаки (мс)", value: w.attackIntervalMs },
                ]}
              />
            ))}
          </div>

          <h3 className="text-lg font-semibold text-white mt-8">Герои</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(heroTypes).map(([id, h]) => (
              <ParamCard
                key={id}
                title={h.name}
                items={[
                  { label: "HP", value: h.maxHp },
                  { label: "Скорость", value: h.speed },
                  { label: "Урон", value: h.attackDamage },
                  { label: "Дальность атаки", value: h.attackRange },
                  { label: "Регенерация HP/с", value: h.hpRegenPerSec },
                  { label: "Награда за убийство", value: h.goldBounty },
                ]}
              />
            ))}
          </div>

          <h3 className="text-lg font-semibold text-white mt-8">Здания</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ParamCard
              title={buildings.castle.name}
              items={[
                { label: "HP", value: buildings.castle.maxHp },
                { label: "Радиус", value: buildings.castle.radius },
                {
                  label: "Дальность атаки",
                  value: buildings.castle.attackRange,
                },
                { label: "Урон", value: buildings.castle.attackDamage },
              ]}
            />
            <ParamCard
              title={buildings.barrack.name}
              items={[
                { label: "HP", value: buildings.barrack.maxHp },
                {
                  label: "Интервал спавна (с)",
                  value: buildings.barrack.spawnIntervalMs / 1000,
                },
                {
                  label: "Дальность атаки",
                  value: buildings.barrack.attackRange,
                },
                { label: "Урон", value: buildings.barrack.attackDamage },
              ]}
            />
            <ParamCard
              title={buildings.tower.name}
              items={[
                { label: "HP", value: buildings.tower.maxHp },
                { label: "Радиус", value: buildings.tower.radius },
                {
                  label: "Дальность атаки",
                  value: buildings.tower.attackRange,
                },
                { label: "Урон", value: buildings.tower.attackDamage },
              ]}
            />
          </div>

          <h3 className="text-lg font-semibold text-white mt-8">
            Нейтральные точки
          </h3>
          <ParamCard
            title={`${neutralPoints.count} точек на карте`}
            items={[
              {
                label: "Золото за интервал",
                value: neutralPoints.goldPerInterval,
              },
              {
                label: "Интервал (с)",
                value: neutralPoints.goldIntervalMs / 1000,
              },
              { label: "Радиус захвата", value: neutralPoints.captureRadius },
            ]}
          />
        </div>
      </Section>

      {/* Как играть */}
      <Section id="kak-igrat" title="Как играть">
        <div className="space-y-6 text-slate-300">
          <h3 className="text-lg font-semibold text-white">Управление</h3>
          <ul className="space-y-2">
            <li>
              <strong className="text-slate-200">Перемещение камеры:</strong>{" "}
              перетаскивание мышью или пальцем на мобильных
            </li>
            <li>
              <strong className="text-slate-200">Масштаб:</strong> колёсико мыши
              или pinch-жест двумя пальцами
            </li>
            <li>
              <strong className="text-slate-200">Улучшения:</strong> клик по
              замку или бараку — открыть панель улучшений
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-white mt-6">Советы</h3>
          <ul className="space-y-2">
            <li>
              Включите <strong className="text-slate-200">Авторазвитие</strong>{" "}
              — игра сама покупает улучшения за золото
            </li>
            <li>
              Золото получают за захват нейтральных точек и убийство врагов
            </li>
            <li>
              Герои дают награду за убийство — используйте их для давления
            </li>
            <li>Башни и бараки атакуют врагов в радиусе автоматически</li>
          </ul>
        </div>
      </Section>

      {/* Режимы */}
      <Section id="rezhimy" title="Режимы игры" className="bg-slate-800/30">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded-lg border border-slate-600 bg-slate-800/80 p-6">
            <h3 className="text-lg font-semibold text-sky-400 mb-2">
              Локальная игра
            </h3>
            <p className="text-slate-400 text-sm sm:text-base mb-4">
              Симуляция на одном устройстве. Управляйте развитием своей базы
              самостоятельно или наблюдайте за автономной битвой.
            </p>
            <Link
              href="/game"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium transition-colors min-h-[44px]"
            >
              Играть
            </Link>
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-800/50 p-6 opacity-75">
            <h3 className="text-lg font-semibold text-slate-400 mb-2">
              Мультиплеер
            </h3>
            <p className="text-slate-500 text-sm sm:text-base mb-4">
              Игра онлайн с другими игроками. Сейчас в разработке.
            </p>
            <span
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-600 text-slate-500 font-medium cursor-not-allowed min-h-[44px]"
              aria-disabled="true"
            >
              Скоро
            </span>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Начните игру
          </h2>
          <p className="text-slate-400 mb-6">
            Выберите режим и погрузитесь в стратегию.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/game"
              className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-lg transition-colors min-h-[48px]"
            >
              Локальная игра
            </Link>
            <span
              className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg bg-slate-600 text-slate-500 font-medium cursor-not-allowed min-h-[48px]"
              aria-disabled="true"
              title="Временно недоступно"
            >
              Мультиплеер
            </span>
          </div>
        </div>
      </section>

      {/* Поддержать проект */}
      <section className="py-12 sm:py-16 bg-slate-800/30">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Поддержать проект
          </h2>
          <p className="text-slate-400 mb-6">
            {hasSupportUrl
              ? "Если игра понравилась, можно поддержать разработку."
              : "Скоро здесь появится возможность поддержать проект."}
          </p>
          {hasSupportUrl ? (
            <a
              href={supportConfig.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-lg transition-colors min-h-[48px]"
            >
              <span aria-hidden>☕</span>
              {supportConfig.label}
            </a>
          ) : (
            <span
              className="inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 rounded-lg border border-slate-600 bg-slate-800/50 text-slate-500 font-medium cursor-not-allowed min-h-[48px]"
              aria-disabled="true"
              title="Скоро"
            >
              Скоро
            </span>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-6">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="font-semibold text-slate-300 hover:text-white transition-colors"
          >
            RTS Game
          </Link>
          <nav className="flex flex-wrap gap-4 sm:gap-6 justify-center" aria-label="Ссылки в подвале">
            <Link
              href="/"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Главная
            </Link>
            <Link
              href="/game"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Игра
            </Link>
            <Link
              href="/plans"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Планы
            </Link>
            {hasSupportUrl ? (
              <a
                href={supportConfig.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white transition-colors"
              >
                Поддержать
              </a>
            ) : (
              <span className="text-slate-500 cursor-default" title="Скоро">
                Поддержать
              </span>
            )}
          </nav>
        </div>
        <p className="mx-auto max-w-4xl px-4 sm:px-6 mt-4 text-center text-slate-500 text-sm">
          © {new Date().getFullYear()} RTS Game. Браузерная стратегия в реальном
          времени.
        </p>
      </footer>
    </main>
  );
}
