"use client";

import type { CSSProperties } from "react";
import type { EntitySnapshot } from "../core/Game";
import { heroCumulativeXpForLevel } from "../entities/units/Hero";

export interface HeroStatsPanelProps {
  entity: EntitySnapshot;
  displayName: string;
  ownerColor?: string;
  ownerShortLabel: string;
  position: { left: number; top: number };
  bounds: { left: number; top: number; right: number; bottom: number };
  isMobile?: boolean;
  onClose: () => void;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums text-slate-200 text-right">{value}</span>
    </div>
  );
}

export function HeroStatsPanel({
  entity,
  displayName,
  ownerColor,
  ownerShortLabel,
  position,
  bounds,
  isMobile = false,
  onClose,
}: HeroStatsPanelProps) {
  if (!entity.isHero || !entity.heroTypeId) return null;

  const level = entity.level ?? 1;
  const xp = entity.heroXp ?? 0;
  const xpFloor = heroCumulativeXpForLevel(level);
  const xpCeil =
    level >= 20 ? null : heroCumulativeXpForLevel(level + 1);
  const xpSpan =
    xpCeil != null && xpCeil > xpFloor ? xpCeil - xpFloor : 1;
  const xpProgress =
    xpCeil != null ? Math.min(1, Math.max(0, (xp - xpFloor) / xpSpan)) : 1;

  const hpFrac =
    entity.maxHp > 0 ? Math.min(1, Math.max(0, entity.hp / entity.maxHp)) : 0;

  const intervalMs = entity.heroAttackIntervalMs ?? 1000;
  const dps =
    entity.heroAttackDamage != null && intervalMs > 0
      ? entity.heroAttackDamage / (intervalMs / 1000)
      : null;

  const maxPanelHeight = isMobile ? "55vh" : 360;
  const panelWidth = isMobile ? "100%" : 248;

  const panelStyles: CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        top: "auto",
        maxHeight: maxPanelHeight,
        width: panelWidth,
        borderRadius: "12px 12px 0 0",
      }
    : {
        position: "fixed",
        left: position.left + 12,
        top: position.top,
        maxHeight: maxPanelHeight,
        width: panelWidth,
      };

  if (!isMobile) {
    const pad = 8;
    let left = position.left + 12;
    const w = 248;
    if (left + w > bounds.right - pad) left = bounds.right - w - pad;
    if (left < bounds.left + pad) left = bounds.left + pad;
    let top = position.top;
    const estH = 280;
    if (top + estH > bounds.bottom - pad) top = bounds.bottom - estH - pad;
    if (top < bounds.top + pad) top = bounds.top + pad;
    panelStyles.left = left;
    panelStyles.top = top;
  }

  const panelClass =
    "fixed z-[25] flex flex-col overflow-y-auto border border-slate-600 bg-slate-800 shadow-xl " +
    (isMobile ? "p-4 gap-3 rounded-t-xl" : "p-3 gap-2.5 rounded-lg");

  return (
    <>
      {isMobile && (
        <button
          type="button"
          aria-label="Закрыть"
          className="fixed inset-0 z-[24] bg-black/40"
          onClick={onClose}
        />
      )}
      <div className={panelClass} style={panelStyles}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="font-semibold text-slate-100 text-sm truncate pr-1"
              style={ownerColor ? { color: ownerColor } : undefined}
            >
              {displayName}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {ownerShortLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
              <span>Здоровье</span>
              <span className="tabular-nums">
                {Math.round(entity.hp)} / {Math.round(entity.maxHp)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width]"
                style={{ width: `${hpFrac * 100}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
              <span>
                Уровень {level}
                {level >= 20 ? " (макс.)" : ""}
              </span>
              {xpCeil != null && (
                <span className="tabular-nums">
                  {Math.floor(xp)} / {xpCeil} XP
                </span>
              )}
            </div>
            {xpCeil != null && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-sky-500 transition-[width]"
                  style={{ width: `${xpProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5 border-t border-slate-600/80 pt-2">
          {entity.heroAttackDamage != null && (
            <StatRow label="Урон" value={String(entity.heroAttackDamage)} />
          )}
          {dps != null && (
            <StatRow label="Урон/сек" value={dps.toFixed(1)} />
          )}
          {entity.heroAttackRange != null && (
            <StatRow
              label="Дальность атаки"
              value={String(entity.heroAttackRange)}
            />
          )}
          {entity.heroSpeed != null && (
            <StatRow
              label="Скорость"
              value={`${entity.heroSpeed.toFixed(1)} /сек`}
            />
          )}
          <StatRow
            label="Интервал атаки"
            value={`${(intervalMs / 1000).toFixed(2)} с`}
          />
          {entity.heroArmor != null && entity.heroArmor > 0 && (
            <StatRow
              label="Броня"
              value={`−${Math.round(entity.heroArmor * 100)}% урона`}
            />
          )}
          {entity.heroHpRegenPerSec != null && entity.heroHpRegenPerSec > 0 && (
            <StatRow
              label="Регенерация"
              value={`+${entity.heroHpRegenPerSec.toFixed(1)} HP/сек`}
            />
          )}
          {entity.goldBounty != null && (
            <StatRow label="Золото за убийство" value={String(entity.goldBounty)} />
          )}
        </div>
      </div>
    </>
  );
}
