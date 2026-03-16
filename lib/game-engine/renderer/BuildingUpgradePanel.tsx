"use client";

import { Game, type PlayerState, type BarrackBuyCapacity, type EntitySnapshot } from "../core/Game";
import type { GameConfig } from "../config/defaultConfig";
import {
  UPGRADE_DEFINITIONS,
  BUILDING_UPGRADE_DEFINITIONS,
  BARACK_UPGRADE_DEFINITIONS,
  CASTLE_BUILDING_UPGRADE_IDS,
  type UpgradeDefinition,
  type BuildingUpgradeDefinition,
  type BarrackUpgradeDefinition,
} from "../upgrades/definitions";

export interface BuildingUpgradePanelProps {
  entity: EntitySnapshot;
  config: GameConfig;
  playerState: PlayerState | undefined;
  barrackUpgradeIds: string[];
  barrackBuyCapacity?: BarrackBuyCapacity;
  barrackRepairCooldownMs?: number;
  position: { left: number; top: number };
  /** Границы области карты (viewport) для ограничения панели. */
  bounds?: { left: number; top: number; right: number; bottom: number };
  onBuyUpgrade: (playerId: string, upgradeId: string) => boolean;
  onBuyBarrackUpgrade: (playerId: string, barrackId: string, upgradeId: string) => boolean;
  onBuyBarrackWarrior?: (playerId: string, barrackId: string) => boolean;
  onRepairBarrack?: (playerId: string, barrackId: string) => boolean;
  onClose: () => void;
  gameOver?: boolean;
}

interface UpgradeCardProps {
  id: string;
  name: string;
  description: string;
  cost: number;
  owned: boolean;
  canBuy: boolean;
  reason?: string;
  onBuy: () => void;
  disabled?: boolean;
}

function UpgradeCard({ id, name, description, cost, owned, canBuy, reason, onBuy, disabled }: UpgradeCardProps) {
  return (
    <li
      key={id}
      className={`rounded border px-2 py-1.5 ${
        owned
          ? "border-emerald-600/50 bg-emerald-900/20"
          : "border-slate-600 bg-slate-700/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-200 text-xs">{name}</div>
          {!owned && <div className="truncate text-[10px] text-slate-500" title={description}>{description}</div>}
        </div>
        {owned ? (
          <span className="shrink-0 text-emerald-400 text-xs">✓</span>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-amber-400 text-xs">🪙{cost}</span>
            <button
              type="button"
              disabled={!canBuy || disabled}
              onClick={onBuy}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                canBuy && !disabled
                  ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                  : "cursor-not-allowed bg-slate-600 text-slate-500"
              }`}
              title={reason}
            >
              Купить
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

const castleBuildingDefs = BUILDING_UPGRADE_DEFINITIONS.filter((d) =>
  (CASTLE_BUILDING_UPGRADE_IDS as readonly string[]).includes(d.id),
);

function canBuyGlobal(def: UpgradeDefinition | BuildingUpgradeDefinition, ps: PlayerState | undefined, ids: string[]): { can: boolean; reason?: string } {
  if (!ps) return { can: false, reason: "Нет данных" };
  if (ids.includes(def.id)) return { can: false, reason: "Уже куплено" };
  if (def.prerequisiteId && !ids.includes(def.prerequisiteId)) return { can: false, reason: "Нужен prerequisite" };
  if (ps.gold < def.cost) return { can: false, reason: `Нужно ${def.cost} золота` };
  return { can: true };
}

function canBuyBarrack(def: BarrackUpgradeDefinition, ps: PlayerState | undefined, barrackIds: string[]): { can: boolean; reason?: string } {
  if (!ps) return { can: false, reason: "Нет данных" };
  if (barrackIds.includes(def.id)) return { can: false, reason: "Уже куплено" };
  if (def.prerequisiteId && !barrackIds.includes(def.prerequisiteId)) return { can: false, reason: "Нужен prerequisite" };
  if (ps.gold < def.cost) return { can: false, reason: `Нужно ${def.cost} золота` };
  return { can: true };
}

export function BuildingUpgradePanel({
  entity,
  config,
  playerState,
  barrackUpgradeIds,
  barrackBuyCapacity,
  barrackRepairCooldownMs = 0,
  position,
  bounds,
  onBuyUpgrade,
  onBuyBarrackUpgrade,
  onBuyBarrackWarrior,
  onRepairBarrack,
  onClose,
  gameOver,
}: BuildingUpgradePanelProps) {
  const player = config.players.find((p) => p.id === entity.ownerId);
  const isCastle = entity.kind === "castle";
  const isBarrack = entity.kind === "barrack";

  if (!isCastle && !isBarrack) return null;

  const panelWidth = 240;
  const offset = 12;
  const pad = 8;
  const maxPanelHeight = 320;

  const boundsLeft = bounds?.left ?? pad;
  const boundsTop = bounds?.top ?? pad;
  const boundsRight = bounds?.right ?? (typeof window !== "undefined" ? window.innerWidth - pad : Infinity);
  const boundsBottom = bounds?.bottom ?? (typeof window !== "undefined" ? window.innerHeight - pad : Infinity);

  let left = position.left + offset;
  if (left + panelWidth > boundsRight) left = boundsRight - panelWidth - pad;
  if (left < boundsLeft) left = boundsLeft + pad;

  let top = position.top;
  const availableBelow = boundsBottom - top - pad;
  const availableAbove = top - boundsTop - pad;
  const placeAbove = availableBelow < 150 && availableAbove > availableBelow;
  const useMaxHeight = Math.min(maxPanelHeight, Math.max(180, placeAbove ? availableAbove - pad : availableBelow - pad));
  if (placeAbove) {
    top = position.top - useMaxHeight - pad;
  }
  top = Math.max(boundsTop + pad, Math.min(boundsBottom - useMaxHeight - pad, top));

  const panelClass = "fixed z-20 flex min-w-[200px] max-w-[260px] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800/98 p-2.5 text-sm shadow-xl";

  return (
    <div className={panelClass} style={{ left, top, maxHeight: useMaxHeight }}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-amber-400">
          {isCastle ? "Замок" : "Барак"}
          {player && (
            <span
              className="ml-1.5 rounded px-1 py-0.5 text-[10px]"
              style={{ backgroundColor: player.color, color: "#1e293b" }}
            >
              {player.id.replace("player-", "П")}
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 text-sm leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      {isCastle && entity.kind === "castle" && (
        <>
          <div className="text-[10px] text-slate-500">
            HP {entity.hp}/{entity.maxHp} · урон {(entity as { attackDamage?: number }).attackDamage ?? "—"}
          </div>
          <UpgradeSection title="Воины">
            {UPGRADE_DEFINITIONS.map((def) => {
              const owned = playerState?.upgradeIds?.includes(def.id) ?? false;
              const { can, reason } = canBuyGlobal(def, playerState, playerState?.upgradeIds ?? []);
              return (
                <UpgradeCard
                  key={def.id}
                  id={def.id}
                  name={def.name}
                  description={def.description}
                  cost={def.cost}
                  owned={owned}
                  canBuy={can}
                  reason={reason}
                  onBuy={() => onBuyUpgrade(entity.ownerId, def.id)}
                  disabled={gameOver}
                />
              );
            })}
          </UpgradeSection>
          <UpgradeSection title="Здания">
            {castleBuildingDefs.map((def) => {
              const owned = playerState?.buildingUpgradeIds?.includes(def.id) ?? false;
              const { can, reason } = canBuyGlobal(def, playerState, playerState?.buildingUpgradeIds ?? []);
              return (
                <UpgradeCard
                  key={def.id}
                  id={def.id}
                  name={def.name}
                  description={def.description}
                  cost={def.cost}
                  owned={owned}
                  canBuy={can}
                  reason={reason}
                  onBuy={() => onBuyUpgrade(entity.ownerId, def.id)}
                  disabled={gameOver}
                />
              );
            })}
          </UpgradeSection>
        </>
      )}

      {isBarrack && entity.kind === "barrack" && (
        <>
          <div className="text-[10px] text-slate-500">
            HP {entity.hp}/{entity.maxHp} · спавн {(entity as { spawnIntervalMs?: number }).spawnIntervalMs ?? "—"} мс · за цикл {(entity as { spawnCount?: number }).spawnCount ?? 1}
          </div>
          {onRepairBarrack && (
            <div className="flex items-center justify-between gap-2 rounded border border-slate-600 bg-slate-700/40 px-2 py-1.5">
              <div className="text-xs">
                <span className="text-slate-400">Ремонт:</span>{" "}
                <span className="text-slate-200">+20% HP</span>
                {barrackRepairCooldownMs > 0 && (
                  <span className="ml-1 text-slate-500">
                    (откат {Math.ceil(barrackRepairCooldownMs / 1000)} сек)
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={gameOver || barrackRepairCooldownMs > 0 || entity.hp >= entity.maxHp}
                onClick={() => onRepairBarrack(entity.ownerId, entity.id)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  barrackRepairCooldownMs <= 0 && entity.hp < entity.maxHp && !gameOver
                    ? "bg-emerald-600 text-white hover:bg-emerald-500"
                    : "cursor-not-allowed bg-slate-600 text-slate-500"
                }`}
                title={
                  entity.hp >= entity.maxHp
                    ? "Барак на полном HP"
                    : barrackRepairCooldownMs > 0
                      ? `Откат ${Math.ceil(barrackRepairCooldownMs / 1000)} сек`
                      : "Бесплатный ремонт на 20% HP (откат 2 мин)"
                }
              >
                🔧 Ремонт
              </button>
            </div>
          )}
          {onBuyBarrackWarrior && barrackBuyCapacity && (
            <div className="flex items-center justify-between gap-2 rounded border border-slate-600 bg-slate-700/40 px-2 py-1.5">
              <div className="text-xs">
                <span className="text-slate-400">Докупка воина:</span>{" "}
                <span className="font-medium text-slate-200">
                  {barrackBuyCapacity.current}/{barrackBuyCapacity.max}
                </span>
                <span className="ml-1 text-slate-500">(восст. 20 сек)</span>
              </div>
              <button
                type="button"
                disabled={
                  gameOver ||
                  barrackBuyCapacity.current <= 0 ||
                  (playerState?.gold ?? 0) < Game.BUY_WARRIOR_COST
                }
                onClick={() => onBuyBarrackWarrior(entity.ownerId, entity.id)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  barrackBuyCapacity.current > 0 &&
                  (playerState?.gold ?? 0) >= Game.BUY_WARRIOR_COST &&
                  !gameOver
                    ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                    : "cursor-not-allowed bg-slate-600 text-slate-500"
                }`}
                title={
                  barrackBuyCapacity.current <= 0
                    ? "Лимит исчерпан, ждите восстановления"
                    : (playerState?.gold ?? 0) < Game.BUY_WARRIOR_COST
                      ? `Нужно ${Game.BUY_WARRIOR_COST} золота`
                      : `Купить воина за ${Game.BUY_WARRIOR_COST} золота`
                }
              >
                🪙{Game.BUY_WARRIOR_COST}
              </button>
            </div>
          )}
          <UpgradeSection title="Улучшения барака">
            {BARACK_UPGRADE_DEFINITIONS.map((def) => {
              const owned = barrackUpgradeIds.includes(def.id);
              const { can, reason } = canBuyBarrack(def, playerState, barrackUpgradeIds);
              return (
                <UpgradeCard
                  key={def.id}
                  id={def.id}
                  name={def.name}
                  description={def.description}
                  cost={def.cost}
                  owned={owned}
                  canBuy={can}
                  reason={reason}
                  onBuy={() => onBuyBarrackUpgrade(entity.ownerId, entity.id, def.id)}
                  disabled={gameOver}
                />
              );
            })}
          </UpgradeSection>
        </>
      )}
    </div>
  );
}

function UpgradeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}
