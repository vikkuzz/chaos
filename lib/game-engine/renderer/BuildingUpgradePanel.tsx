"use client";

import { useMemo } from "react";
import { Game, type PlayerState, type BarrackBuyCapacity, type EntitySnapshot, type CastleUpgradeTrack } from "../core/Game";
import { CASTLE_SPELL, CASTLE_SPELL_1, CASTLE_SPELL_2 } from "../entities/base/Castle";
import type { GameConfig } from "../config/defaultConfig";
import {
  BARACK_UPGRADE_DEFINITIONS,
  getCastleUpgradeCost,
  getTrackUpgradeCost,
  getMaxTrackLevel,
  getMaxMagicLevel,
  type UpgradeDefinition,
  type BuildingUpgradeDefinition,
  type BarrackUpgradeDefinition,
} from "../upgrades/definitions";

const CASTLE_TRACKS: { id: CastleUpgradeTrack; name: string }[] = [
  { id: "castle", name: "Улучшение замка" },
  { id: "ranged", name: "Дальние атаки" },
  { id: "melee", name: "Ближние атаки" },
  { id: "buildingHp", name: "Прочность зданий" },
  { id: "unitHp", name: "HP юнитов" },
  { id: "unitDefense", name: "Защита юнитов" },
  { id: "magic", name: "Прокачка магии" },
];

export interface BuildingUpgradePanelProps {
  entity: EntitySnapshot;
  config: GameConfig;
  currentPlayerId: string | null;
  playerState: PlayerState | undefined;
  barrackUpgradeIds: string[];
  barrackBuyCapacity?: BarrackBuyCapacity;
  barrackRepairCooldownMs?: number;
  position: { left: number; top: number };
  bounds?: { left: number; top: number; right: number; bottom: number };
  isMobile?: boolean;
  onBuyCastleUpgrade: (playerId: string, trackId: CastleUpgradeTrack) => boolean;
  onBuyBarrackUpgrade: (playerId: string, barrackId: string, upgradeId: string) => boolean;
  onBuyBarrackWarrior?: (playerId: string, barrackId: string) => boolean;
  onRepairBarrack?: (playerId: string, barrackId: string) => boolean;
  onCastCastleSpell?: (playerId: string, castleId: string, spellIndex: 0 | 1) => boolean;
  onSummonHero?: (playerId: string, barrackId: string, heroTypeId: string) => boolean;
  aliveHeroTypeIds?: Set<string>;
  barrackHeroCooldowns?: Record<string, number>;
  onClose: () => void;
  gameOver?: boolean;
}

function getDefName(defs: BarrackUpgradeDefinition[], id: string): string | undefined {
  return defs.find((d) => d.id === id)?.name;
}

function getUpgradeLevel(
  def: { prerequisiteId?: string },
  allDefs: { id: string; prerequisiteId?: string }[],
): number {
  if (!def.prerequisiteId) return 0;
  const prereq = allDefs.find((d) => d.id === def.prerequisiteId);
  if (!prereq) return 0;
  return 1 + getUpgradeLevel(prereq, allDefs);
}

function groupByLevel<T extends { id: string; prerequisiteId?: string }>(
  defs: T[],
  allDefs: T[],
): { level: number; items: T[] }[] {
  const byLevel = new Map<number, T[]>();
  const defsForLevel = allDefs as unknown as { id: string; prerequisiteId?: string }[];
  for (const def of defs) {
    const level = getUpgradeLevel(def, defsForLevel);
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level)!.push(def);
  }
  return Array.from(byLevel.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([level, items]) => ({ level, items }));
}

interface CastleTrackRowProps {
  name: string;
  level: number;
  maxLevel: number;
  cost: number | null;
  canBuy: boolean;
  onBuy: () => void;
  disabled?: boolean;
  touchFriendly?: boolean;
}

function CastleTrackRow({ name, level, maxLevel, cost, canBuy, onBuy, disabled, touchFriendly }: CastleTrackRowProps) {
  const atMax = level >= maxLevel;
  return (
    <li
      className={`flex items-center justify-between gap-2 rounded border px-3 py-2 ${
        touchFriendly ? "py-3" : "py-2"
      } border-slate-600 bg-slate-700/40`}
    >
      <div className="min-w-0 flex-1">
        <div className={`font-medium text-slate-200 ${touchFriendly ? "text-sm" : "text-xs"}`}>{name}</div>
        <div className={`text-slate-500 ${touchFriendly ? "text-xs" : "text-[10px]"}`}>
          {level}/{maxLevel}
        </div>
      </div>
      {atMax ? (
        <span className="shrink-0 text-emerald-400 text-sm">✓</span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-amber-400 ${touchFriendly ? "text-sm" : "text-xs"}`}>🪙{cost}</span>
          <button
            type="button"
            disabled={!canBuy || disabled}
            onClick={onBuy}
            className={`rounded font-medium transition min-h-[44px] min-w-[80px] ${
              touchFriendly ? "px-4 py-2 text-sm" : "px-2 py-1 text-xs"
            } ${canBuy && !disabled ? "bg-amber-500 text-slate-900 hover:bg-amber-400" : "cursor-not-allowed bg-slate-600 text-slate-500"}`}
          >
            Купить
          </button>
        </div>
      )}
    </li>
  );
}

interface UpgradeCardProps {
  id: string;
  name: string;
  description: string;
  cost: number;
  owned: boolean;
  canBuy: boolean;
  reason?: string;
  prerequisiteName?: string;
  onBuy: () => void;
  disabled?: boolean;
  /** Увеличенные touch targets для мобильных */
  touchFriendly?: boolean;
}

function UpgradeCard({
  id,
  name,
  description,
  cost,
  owned,
  canBuy,
  reason,
  prerequisiteName,
  onBuy,
  disabled,
  touchFriendly,
}: UpgradeCardProps) {
  const isLocked = !owned && prerequisiteName && !canBuy;
  return (
    <li
      key={id}
      className={`rounded border px-3 py-2 ${
        touchFriendly ? "py-3" : "py-2"
      } ${
        owned
          ? "border-l-4 border-l-amber-500 border-emerald-600/50 bg-emerald-900/20"
          : isLocked
            ? "border-slate-600 bg-slate-800/40 opacity-75"
            : "border-slate-600 bg-slate-700/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`font-medium text-slate-200 ${touchFriendly ? "text-sm" : "text-xs"} truncate`}>
            {name}
          </div>
          {!owned && (
            <div className={`text-slate-500 truncate ${touchFriendly ? "text-xs" : "text-[10px]"}`} title={description}>
              {description}
            </div>
          )}
          {isLocked && prerequisiteName && (
            <div className="mt-0.5 text-amber-600/90 text-[10px]">
              Требуется: {prerequisiteName}
            </div>
          )}
        </div>
        {owned ? (
          <span className="shrink-0 text-emerald-400 text-sm">✓</span>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <span className={`text-amber-400 ${touchFriendly ? "text-sm" : "text-xs"}`}>🪙{cost}</span>
            <button
              type="button"
              disabled={!canBuy || disabled}
              onClick={onBuy}
              className={`rounded font-medium transition min-h-[44px] min-w-[80px] ${
                touchFriendly ? "px-4 py-2 text-sm" : "px-2 py-1 text-xs"
              } ${
                canBuy && !disabled
                  ? "bg-amber-500 text-slate-900 hover:bg-amber-400 active:bg-amber-600"
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

function UpgradeTreeView<T extends UpgradeDefinition | BuildingUpgradeDefinition | BarrackUpgradeDefinition>({
  defs,
  ownedIds,
  canBuy,
  onBuy,
  disabled,
  touchFriendly,
  getPrereqName,
}: {
  defs: T[];
  ownedIds: string[];
  canBuy: (def: T) => { can: boolean; reason?: string };
  onBuy: (def: T) => void;
  disabled?: boolean;
  touchFriendly?: boolean;
  getPrereqName: (id: string) => string | undefined;
}) {
  const groups = useMemo(() => groupByLevel(defs, defs), [defs]);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ level, items }) => (
        <div key={level}>
          {groups.length > 1 && (
            <h5 className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Уровень {level + 1}
            </h5>
          )}
          <ul className={`flex flex-wrap gap-2 ${touchFriendly ? "gap-3" : ""}`}>
            {items.map((def) => {
              const owned = ownedIds.includes(def.id);
              const { can, reason } = canBuy(def);
              const prereqName = def.prerequisiteId ? getPrereqName(def.prerequisiteId) : undefined;
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
                  prerequisiteName={prereqName}
                  onBuy={() => onBuy(def)}
                  disabled={disabled}
                  touchFriendly={touchFriendly}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function canBuyBarrack(
  def: BarrackUpgradeDefinition,
  ps: PlayerState | undefined,
  barrackIds: string[],
): { can: boolean; reason?: string } {
  if (!ps) return { can: false, reason: "Нет данных" };
  if (barrackIds.includes(def.id)) return { can: false, reason: "Уже куплено" };
  if (def.prerequisiteId && !barrackIds.includes(def.prerequisiteId))
    return { can: false, reason: "Нужен prerequisite" };
  if (ps.gold < def.cost) return { can: false, reason: `Нужно ${def.cost} золота` };
  return { can: true };
}

export function BuildingUpgradePanel({
  entity,
  config,
  currentPlayerId,
  playerState,
  barrackUpgradeIds,
  barrackBuyCapacity,
  barrackRepairCooldownMs = 0,
  position,
  bounds,
  isMobile = false,
  onBuyCastleUpgrade,
  onBuyBarrackUpgrade,
  onBuyBarrackWarrior,
  onRepairBarrack,
  onCastCastleSpell,
  onSummonHero,
  aliveHeroTypeIds = new Set(),
  barrackHeroCooldowns = {},
  onClose,
  gameOver,
}: BuildingUpgradePanelProps) {
  const player = config.players.find((p) => p.id === entity.ownerId);
  const isCastle = entity.kind === "castle";
  const isBarrack = entity.kind === "barrack";
  const isOwnBuilding = currentPlayerId != null && entity.ownerId === currentPlayerId;

  if (!isCastle && !isBarrack) return null;

  const touchFriendly = isMobile;
  const panelWidth = isMobile ? "100%" : 260;
  const maxPanelHeight = isMobile ? "70vh" : 400;

  const panelStyles: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: "auto",
        maxHeight: maxPanelHeight,
        width: panelWidth,
        borderRadius: "12px 12px 0 0",
        animation: "slideUp 0.25s ease-out",
      }
    : {
        position: "fixed",
        left: position.left + 12,
        top: position.top,
        maxHeight: maxPanelHeight,
        width: panelWidth,
      };

  if (!isMobile && bounds) {
    const pad = 8;
    let left = position.left + 12;
    const boundsRight = bounds.right ?? (typeof window !== "undefined" ? window.innerWidth - pad : Infinity);
    const boundsLeft = bounds.left ?? pad;
    const boundsBottom = bounds.bottom ?? (typeof window !== "undefined" ? window.innerHeight - pad : Infinity);
    const boundsTop = bounds.top ?? pad;
    if (left + 260 > boundsRight) left = boundsRight - 260 - pad;
    if (left < boundsLeft) left = boundsLeft + pad;
    let top = position.top;
    const availableBelow = boundsBottom - top - pad;
    const availableAbove = top - boundsTop - pad;
    const placeAbove = availableBelow < 150 && availableAbove > availableBelow;
    const useMaxHeight = Math.min(400, Math.max(180, placeAbove ? availableAbove - pad : availableBelow - pad));
    if (placeAbove) top = position.top - useMaxHeight - pad;
    top = Math.max(boundsTop + pad, Math.min(boundsBottom - useMaxHeight - pad, top));
    panelStyles.left = left;
    panelStyles.top = top;
    panelStyles.maxHeight = useMaxHeight;
  }

  const panelClass =
    "fixed z-20 flex flex-col overflow-y-auto border border-slate-600 bg-slate-800/98 shadow-xl touch-pan-y " +
    (isMobile
      ? "min-h-[200px] p-4 gap-4 rounded-t-xl"
      : "min-w-[200px] max-w-[300px] p-3 gap-3 rounded-lg");

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-10 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div className={panelClass} style={panelStyles}>
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h3 className={`font-semibold text-amber-400 ${touchFriendly ? "text-base" : "text-xs"}`}>
            {isCastle ? "Замок" : "Барак"}
            {player && (
              <span
                className="ml-1.5 rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: player.color, color: "#1e293b" }}
              >
                {player.id.replace("player-", "П")}
              </span>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-slate-300 leading-none ${
              touchFriendly ? "min-h-[44px] min-w-[44px] text-lg" : "text-sm"
            }`}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        {!isOwnBuilding && (
          <div className="text-[10px] text-slate-500 italic">Только просмотр</div>
        )}

        {isCastle && entity.kind === "castle" && (() => {
          const ps = playerState;
          const manaRaw = (entity as { mana?: number }).mana ?? 0;
          const spell1Cd = (entity as { spell1CooldownMs?: number }).spell1CooldownMs ?? 0;
          const spell2Cd = (entity as { spell2CooldownMs?: number }).spell2CooldownMs ?? 0;
          const castleLevel = ps?.castleLevel ?? 0;
          const maxTrack = getMaxTrackLevel(castleLevel);
          const maxMagic = getMaxMagicLevel(castleLevel);

          return (
            <>
              <div className={`text-slate-500 ${touchFriendly ? "text-sm" : "text-[10px]"}`}>
                HP {entity.hp}/{entity.maxHp} · урон {(entity as { attackDamage?: number }).attackDamage ?? "—"} · мана {Math.floor(manaRaw)}/{entity.maxMana ?? CASTLE_SPELL.MANA_MAX}
              </div>
              {isOwnBuilding && onCastCastleSpell && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={gameOver || manaRaw < CASTLE_SPELL_1.MANA_COST || spell1Cd > 0}
                    onClick={() => onCastCastleSpell(entity.ownerId, entity.id, 0)}
                    className={`rounded font-medium transition ${touchFriendly ? "min-h-[44px] px-4 py-2 text-sm" : "px-2 py-1 text-xs"} ${
                      manaRaw >= CASTLE_SPELL_1.MANA_COST && spell1Cd <= 0 && !gameOver
                        ? "bg-violet-600 text-white hover:bg-violet-500"
                        : "cursor-not-allowed bg-slate-600 text-slate-500"
                    }`}
                    title={`Урон 100×100 вокруг угрожаемого здания (${CASTLE_SPELL_1.MANA_COST} маны)`}
                  >
                    ✨ Закл.1 {spell1Cd > 0 ? `(${Math.ceil(spell1Cd / 1000)})` : ""}
                  </button>
                  {castleLevel >= 2 && (
                    <button
                      type="button"
                      disabled={gameOver || manaRaw < CASTLE_SPELL_2.MANA_COST || spell2Cd > 0}
                      onClick={() => onCastCastleSpell(entity.ownerId, entity.id, 1)}
                      className={`rounded font-medium transition ${touchFriendly ? "min-h-[44px] px-4 py-2 text-sm" : "px-2 py-1 text-xs"} ${
                        manaRaw >= CASTLE_SPELL_2.MANA_COST && spell2Cd <= 0 && !gameOver
                          ? "bg-violet-700 text-white hover:bg-violet-600"
                          : "cursor-not-allowed bg-slate-600 text-slate-500"
                      }`}
                      title={`Убить в радиусе ${CASTLE_SPELL_2.RADIUS} (${CASTLE_SPELL_2.MANA_COST} маны)`}
                    >
                      ✨ Закл.2 {spell2Cd > 0 ? `(${Math.ceil(spell2Cd / 1000)})` : ""}
                    </button>
                  )}
                </div>
              )}
              {isOwnBuilding && ps && (
                <ul className="flex flex-col gap-2">
                  {CASTLE_TRACKS.map(({ id, name }) => {
                    const level =
                      id === "castle"
                        ? ps.castleLevel
                        : id === "ranged"
                          ? ps.rangedLevel
                          : id === "melee"
                            ? ps.meleeLevel
                            : id === "buildingHp"
                              ? ps.buildingHpLevel
                              : id === "unitHp"
                                ? ps.unitHpLevel
                                : id === "unitDefense"
                                  ? ps.unitDefenseLevel
                                  : ps.magicLevel;
                    const maxLevel = id === "castle" ? 3 : id === "magic" ? maxMagic : maxTrack;
                    const cost = id === "castle" ? getCastleUpgradeCost(level) : getTrackUpgradeCost(level);
                    const canBuy = cost != null && ps.gold >= cost && level < maxLevel;
                    return (
                      <CastleTrackRow
                        key={id}
                        name={name}
                        level={level}
                        maxLevel={maxLevel}
                        cost={cost ?? 0}
                        canBuy={canBuy}
                        onBuy={() => onBuyCastleUpgrade(entity.ownerId, id)}
                        disabled={gameOver}
                        touchFriendly={touchFriendly}
                      />
                    );
                  })}
                </ul>
              )}
            </>
          );
        })()}

        {isBarrack && entity.kind === "barrack" && (
          <>
            <div className={`text-slate-500 ${touchFriendly ? "text-sm" : "text-[10px]"}`}>
              HP {entity.hp}/{entity.maxHp} · спавн {(entity as { spawnIntervalMs?: number }).spawnIntervalMs ?? "—"} мс
            </div>
            {isOwnBuilding && onRepairBarrack && (
              <div
                className={`flex items-center justify-between gap-2 rounded border border-slate-600 bg-slate-700/40 px-3 ${
                  touchFriendly ? "py-3 min-h-[44px]" : "py-2"
                }`}
              >
                <div className={touchFriendly ? "text-sm" : "text-xs"}>
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
                  className={`rounded font-medium transition ${
                    touchFriendly ? "min-h-[44px] px-4 py-2 text-sm" : "px-2 py-1 text-xs"
                  } ${
                    barrackRepairCooldownMs <= 0 && entity.hp < entity.maxHp && !gameOver
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "cursor-not-allowed bg-slate-600 text-slate-500"
                  }`}
                >
                  🔧 Ремонт
                </button>
              </div>
            )}
            {isOwnBuilding && onBuyBarrackWarrior && barrackBuyCapacity && (
              <div
                className={`flex items-center justify-between gap-2 rounded border border-slate-600 bg-slate-700/40 px-3 ${
                  touchFriendly ? "py-3 min-h-[44px]" : "py-2"
                }`}
              >
                <div className={touchFriendly ? "text-sm" : "text-xs"}>
                  <span className="text-slate-400">Докупка:</span>{" "}
                  <span className="font-medium text-slate-200">
                    {barrackBuyCapacity.current}/{barrackBuyCapacity.max}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={
                    gameOver ||
                    barrackBuyCapacity.current <= 0 ||
                    (playerState?.gold ?? 0) < Game.BUY_WARRIOR_COST
                  }
                  onClick={() => onBuyBarrackWarrior(entity.ownerId, entity.id)}
                  className={`rounded font-medium transition ${
                    touchFriendly ? "min-h-[44px] min-w-[80px] px-4 py-2 text-sm" : "px-2 py-1 text-xs"
                  } ${
                    barrackBuyCapacity.current > 0 &&
                    (playerState?.gold ?? 0) >= Game.BUY_WARRIOR_COST &&
                    !gameOver
                      ? "bg-amber-500 text-slate-900 hover:bg-amber-400"
                      : "cursor-not-allowed bg-slate-600 text-slate-500"
                  }`}
                >
                  🪙{Game.BUY_WARRIOR_COST}
                </button>
              </div>
            )}
            {isOwnBuilding && onSummonHero && config.heroTypes && Object.keys(config.heroTypes).length > 0 && (
              <div>
                <h4
                  className={`mb-2 font-medium uppercase tracking-wide text-slate-500 ${
                    touchFriendly ? "text-xs" : "text-[10px]"
                  }`}
                >
                  Герои
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(["hero-1", "hero-2", "hero-3"] as const).map((heroTypeId) => {
                    const baseStats = config.heroTypes![heroTypeId];
                    if (!baseStats) return null;
                    const heroAlive = aliveHeroTypeIds.has(heroTypeId);
                    const cooldownMs = barrackHeroCooldowns[heroTypeId] ?? 0;
                    const canSummon =
                      !gameOver &&
                      !heroAlive &&
                      cooldownMs <= 0 &&
                      (playerState?.gold ?? 0) >= Game.HERO_SUMMON_COST;
                    const reason = heroAlive
                        ? "Герой уже на поле"
                        : cooldownMs > 0
                          ? `Кулдаун ${Math.ceil(cooldownMs / 1000)} сек`
                          : (playerState?.gold ?? 0) < Game.HERO_SUMMON_COST
                            ? `Нужно 🪙${Game.HERO_SUMMON_COST}`
                            : `Вызвать за 🪙${Game.HERO_SUMMON_COST}`;
                    const names: Record<string, string> = {
                      "hero-1": "Герой 1",
                      "hero-2": "Герой 2",
                      "hero-3": "Герой 3",
                    };
                    return (
                      <button
                        key={heroTypeId}
                        type="button"
                        disabled={!canSummon}
                        onClick={() => onSummonHero(entity.ownerId, entity.id, heroTypeId)}
                        className={`rounded border px-3 py-2 font-medium transition ${
                          touchFriendly ? "min-h-[44px] py-2" : "py-1.5"
                        } ${
                          canSummon
                            ? "border-amber-600 bg-amber-500/80 text-slate-900 hover:bg-amber-400/90"
                            : "cursor-not-allowed border-slate-600 bg-slate-700/60 text-slate-500"
                        }`}
                        title={reason}
                      >
                        {names[heroTypeId] ?? heroTypeId} 🪙{Game.HERO_SUMMON_COST}
                        {cooldownMs > 0 && ` (${Math.ceil(cooldownMs / 1000)})`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {isOwnBuilding && (
            <div>
              <h4
                className={`mb-2 font-medium uppercase tracking-wide text-slate-500 ${
                  touchFriendly ? "text-xs" : "text-[10px]"
                }`}
              >
                Улучшения барака
              </h4>
              <UpgradeTreeView
                defs={BARACK_UPGRADE_DEFINITIONS}
                ownedIds={barrackUpgradeIds}
                canBuy={(def) => canBuyBarrack(def, playerState, barrackUpgradeIds)}
                onBuy={(def) => onBuyBarrackUpgrade(entity.ownerId, entity.id, def.id)}
                disabled={gameOver}
                touchFriendly={touchFriendly}
                getPrereqName={(id) => getDefName(BARACK_UPGRADE_DEFINITIONS, id)}
              />
            </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
