# RTS Game Engine — документация (русский)

Этот проект — прототип клиентского игрового движка для мультиплеерной RTS (Next.js + TypeScript + Tailwind + Canvas).

Ниже описано, как запустить проект, где лежит движок и как его настраивать.

---

## 1. Запуск проекта

### Установка зависимостей

В терминале из корня проекта (`game-03`):

```bash
npm install
```

Если npm ругается на уязвимости, можно дополнительно запустить:

```bash
npm audit fix
# или (с учётом возможных breaking changes):
# npm audit fix --force
```

### Старт dev-сервера

```bash
npm run dev
```

По умолчанию Next.js поднимет сервер на `http://localhost:3000`.

- Главная страница: `http://localhost:3000/`
- Страница игры: `http://localhost:3000/game`

На странице `/game` вы увидите канвас с полем, базами и спавнящимися юнитами.

---

## 2. Структура проекта

Важные директории:

- `app/`
  - `layout.tsx` — корневой layout Next.js (серверный компонент, подключает Tailwind и задаёт `<html>/<body>`).
  - `page.tsx` — главная страница с кнопкой перехода к игре.
  - `game/page.tsx` — страница игры, которая рендерит `GameCanvas`.
- `lib/game-engine/`
  - `core/` — центральные классы движка (`Game`, `GameLoop`, `EventBus`).
  - `entities/` — сущности (замок, бараки, башни, воины и т.д.).
  - `pathfinding/` — маршруты и система движения.
  - `spawn/` — логика спавна (заготовка под расширение).
  - `combat/` — заготовка системы боя.
  - `upgrades/` — заготовка системы апгрейдов.
  - `config/` — конфиг игры (`defaultGameConfig`) и его валидация.
  - `renderer/` — абстракция рендера и реализация через Canvas (`CanvasRenderer`, `GameCanvas`).
  - `hooks/` — React-хук `useGameEngine`.
  - `context/` — контекст `GameContext` (если нужно пробрасывать движок глубже в UI).
  - `inputs/` — заготовка обработки мыши (`MouseInput`).
  - `utils/` — вспомогательные утилиты (`Point`, `math`).

Публичное API движка экспортируется из:

- `lib/game-engine/index.ts`

---

## 3. Как устроен игровой движок

### 3.1. Центральный класс `Game`

Файл: `lib/game-engine/core/Game.ts`

Класс `Game`:

- Принимает `GameConfig` в конструкторе.
- Создаёт сущности (замки, бараки, башни, воинов) на основе конфига.
- Хранит все сущности в `Map<EntityId, Entity>`.
- На каждом шаге обновления (`update(deltaTimeMs)`):
  - вызывает `entity.update(deltaTimeMs)` для каждой сущности;
  - передаёт юнитов в `MovementSystem` для движения по маршрутам;
  - удаляет мёртвые сущности;
  - рассылает снимок состояния всем подписчикам (для React/рендера).

Снимок состояния:

```ts
interface GameStateSnapshot {
  timeMs: number;
  entities: readonly Entity[];
}
```

Подписка:

```ts
const unsubscribe = game.subscribe((snapshot) => {
  // обновляем UI или что-то логируем
});
```

### 3.2. Игровой цикл `GameLoop`

Файл: `lib/game-engine/core/GameLoop.ts`

- Использует `requestAnimationFrame`.
- Работает с фиксированным шагом (60 FPS, ~16.67 ms).
- Внутри вызывает колбэк с `deltaTimeMs` (обычно фиксированное значение).

Используется в хуке `useGameEngine` для постоянного обновления игры и рендера.

### 3.3. Сущности

Базовый абстрактный класс:

- Файл: `lib/game-engine/entities/Entity.ts`

Общие поля:

- `id`, `ownerId`, `kind`, `position`, `hp`, `maxHp`, `radius`.
- Геттеры `isAlive` и методы `takeDamage`, `heal`.
- Абстрактный метод `update(deltaTimeMs)`.

Конкретные сущности:

- `base/Base.ts` — `Base` (логическая база игрока, пока практически пустая).
- `base/Castle.ts` — `Castle` (главный замок).
- `base/Barrack.ts` — `Barrack` (спавнит воинов).
- `base/Tower.ts` — `Tower` (оборонительная башня — боевая логика будет в `CombatSystem`).
- `units/Warrior.ts` — `Warrior` (воин, ходит по маршруту).
- `units/WarriorTypes.ts` — описание характеристик типов воинов (`WarriorStats`, `WarriorTypeMap`).

### 3.4. Маршруты и движение

- `pathfinding/Waypoint.ts` — описывает точку маршрута (waypoint).
- `pathfinding/RouteManager.ts` — хранит массив waypoints для барака и методы:
  - `setWaypoints`, `addWaypoint`, `removeWaypoint`, `getNextWaypoint`.
- `pathfinding/MovementSystem.ts` — двигает воинов по маршрутам:
  - вычисляет вектор движения к текущему waypoint;
  - двигает юнита с учётом скорости и `deltaTime`;
  - при достижении точки переключает на следующий waypoint или убирает юнита (по умолчанию — `despawn`).

Каждый `Barrack` содержит `RouteManager`. Воины получают ссылку на этот маршрут в конструкторе.

### 3.5. Спавн юнитов

- `entities/base/Barrack.ts`

Важные поля:

- `spawnIntervalMs` — интервал спавна в миллисекундах.
- `warriorStats` — характеристики спавнимых юнитов.

Логика:

- в `update(deltaTimeMs)` барак увеличивает локальный таймер;
- когда время превышает `spawnIntervalMs`, создаётся новый `Warrior` через `spawnUnit()`;
- новый юнит регистрируется в `Game` через колбэк `onSpawnWarrior`.

Настройка интервала идёт через `GameConfig` (см. ниже).

---

## 4. Конфигурация игры

Файл: `lib/game-engine/config/defaultConfig.ts`

Тип `GameConfig`:

- Размер карты: `mapWidth`, `mapHeight`.
- Типы воинов: `warriorTypes: WarriorTypeMap`.
- Игроки: `players: PlayerBaseConfig[]`.

Игрок:

```ts
interface PlayerBaseConfig {
  id: string;
  color: string;
  castle: CastleConfig;
  barracks: BarrackConfig[];
  towers: TowerConfig[];
}
```

Пример изменения параметров:

- изменить ХП замка или башен;
- добавить новые бараки и указать им `spawnIntervalMs` и `position`;
- добавить новые типы воинов в `warriorTypes` (своими скоростями, уроном и т.д.).

Валидация:

- `ConfigValidator.ts` проверяет базовые вещи (например, что `warriorTypeId` существует в `warriorTypes`).

---

## 5. Интеграция с React / Next.js

### 5.1. Хук `useGameEngine`

Файл: `lib/game-engine/hooks/useGameEngine.ts`

Использование:

```ts
const canvasRef = useRef<HTMLCanvasElement | null>(null);
const { game, state, setBarrackRoute } = useGameEngine(canvasRef, config);
```

Хук:

- создаёт экземпляр `Game`;
- создаёт `CanvasRenderer` и `GameLoop`;
- подписывается на обновления состояния `Game` и хранит `state` в React;
- возвращает метод `setBarrackRoute(barrackId, waypoints)`.

### 5.2. Компонент `GameCanvas`

Файл: `lib/game-engine/renderer/GameCanvas.tsx`

Этот компонент:

- создаёт `canvas` с Tailwind-стилями;
- вызывает `useGameEngine` и передаёт `canvasRef` и конфиг;
- в `useEffect` демонстрационно задаёт маршрут для первого барака первого игрока.

Использование на странице:

```tsx
// app/game/page.tsx
"use client";

import { GameCanvas } from "@/lib/game-engine/renderer/GameCanvas";
import { defaultGameConfig } from "@/lib/game-engine";

export default function GamePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-[1024px] h-[768px] border border-slate-700 rounded-lg overflow-hidden">
        <GameCanvas config={defaultGameConfig} />
      </div>
    </main>
  );
}
```

### 5.3. Контекст `GameContext`

Файл: `lib/game-engine/context/GameContext.tsx`

Можно, при необходимости, завернуть часть интерфейса в `GameProvider` и иметь доступ к `game`, `state` и `setBarrackRoute` из глубины дерева компонентов.

---

## 6. Как программно менять маршруты из UI

У вас есть метод:

```ts
setBarrackRoute(barrackId: string, waypoints: { x: number; y: number }[])
```

Его можно вызывать:

- из `GameCanvas` (как в демо);
- из любого компонента, который получает `setBarrackRoute` через контекст или пропсы.

Пример:

```ts
setBarrackRoute("p1-barrack-1", [
  { x: 200, y: 200 },
  { x: 260, y: 220 },
  { x: 240, y: 280 },
]);
```

В дальнейшем можно использовать `MouseInput` для создания редактора маршрутов (кликаем по карте, добавляем точки и обновляем маршрут для выбранного барака).

---

## 7. Куда смотреть в коде

- Для логики игры:
  - `lib/game-engine/core/Game.ts`
  - `lib/game-engine/pathfinding/MovementSystem.ts`
  - `lib/game-engine/entities/base/Barrack.ts`
- Для конфигурации баланса и карт:
  - `lib/game-engine/config/defaultConfig.ts`
- Для интеграции с React:
  - `lib/game-engine/hooks/useGameEngine.ts`
  - `lib/game-engine/renderer/GameCanvas.tsx`
  - `app/game/page.tsx`

---

## 8. Расширение движка

Идеи, как развивать систему дальше:

- Реализовать логику боя в `CombatSystem` (поиск целей, урон, радиусы атаки).
- Добавить реальные апгрейды через `upgrades/` (эффекты, изменение статов).
- Визуализировать маршруты (линии на Canvas) на основе данных `RouteManager`.
- Сделать редактор карт/маршрутов на React (используя `MouseInput`).

Код старается следовать принципам SOLID и модульной архитектуре: большинство частей можно менять и подменять без трогания всего движка.

