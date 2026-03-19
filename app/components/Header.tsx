"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { socialLinks } from "../config/social";
import { SocialIcon } from "./SocialLinks";
import { useGamePageHud } from "@/lib/GamePageHudContext";

const navItems = [
  { href: "/", label: "Главная" },
  { href: "/game", label: "Игра" },
  { href: "/plans", label: "Планы" },
];

export function Header() {
  const pathname = usePathname();
  const { hud } = useGamePageHud();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const socialRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (socialRef.current && !socialRef.current.contains(e.target as Node)) {
        setSocialOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6"
        aria-label="Основная навигация"
      >
        <Link
          href="/"
          className="text-lg font-bold text-white hover:text-sky-400 transition-colors"
        >
          RTS Game
        </Link>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-6">
          {navItems.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  isActive
                    ? "font-medium text-sky-400 transition-colors"
                    : "font-medium text-slate-300 hover:text-white transition-colors"
                }
              >
                {label}
              </Link>
            );
          })}
          {socialLinks.length > 0 ? (
            <div className="relative" ref={socialRef}>
              <button
                type="button"
                onClick={() => setSocialOpen((v) => !v)}
                className="flex items-center gap-1.5 font-medium text-slate-300 hover:text-white transition-colors"
                aria-expanded={socialOpen}
                aria-haspopup="true"
                aria-label="Соцсети"
              >
                Соцсети
                <svg
                  className={`w-4 h-4 transition-transform ${socialOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {socialOpen && (
                <div
                  className="absolute right-0 top-full mt-1 py-1 min-w-[160px] rounded-lg border border-slate-600 bg-slate-800 shadow-xl"
                  role="menu"
                >
                  {socialLinks.map(({ id, label, url }) => (
                    <a
                      key={id}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                      role="menuitem"
                      onClick={() => setSocialOpen(false)}
                    >
                      <SocialIcon id={id} size={18} />
                      {label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {pathname === "/game" && hud && (
          <div className="flex sm:hidden min-w-0 flex-1 items-center justify-end gap-1.5 pr-1">
            <div
              className="flex min-w-0 max-w-[min(100%,11rem)] items-center gap-1 rounded-full bg-slate-800/95 px-2 py-1 ring-1 ring-slate-600/60"
              style={
                hud.playerAccentColor
                  ? { borderLeft: `3px solid ${hud.playerAccentColor}` }
                  : undefined
              }
              aria-label={`Золото: ${hud.gold}, инком ${hud.goldPerSecond.toFixed(1)}/с`}
            >
              <span className="shrink-0 text-sm leading-none">🪙</span>
              <span className="truncate font-semibold tabular-nums text-amber-400 text-sm">
                {hud.gold}
              </span>
              {hud.goldPerSecond > 0 && (
                <span className="hidden min-[360px]:inline tabular-nums text-slate-400 text-[10px] shrink-0">
                  +{hud.goldPerSecond.toFixed(1)}/с
                </span>
              )}
            </div>
            <label
              className="flex shrink-0 cursor-pointer items-center gap-1 text-slate-200"
              title="Авторазвитие"
            >
              <input
                type="checkbox"
                checked={hud.autoDevelopmentEnabled}
                onChange={hud.onToggleAuto}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-[10px] font-medium leading-tight max-w-[2.75rem]">
                Авто
              </span>
            </label>
          </div>
        )}

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="sm:hidden inline-flex shrink-0 items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px]"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          <span className="sr-only">Меню</span>
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={`sm:hidden border-t border-slate-700 ${mobileOpen ? "block" : "hidden"}`}
      >
        <div className="px-4 py-3 space-y-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] ${
                pathname === href
                  ? "bg-slate-800 text-sky-400"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
          {socialLinks.length > 0 && (
            <div className="border-t border-slate-700 mt-2 pt-2">
              <p className="px-4 py-2 text-xs font-medium text-slate-500 uppercase">
                Соцсети
              </p>
              {socialLinks.map(({ id, label, url }) => (
                <a
                  key={id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors min-h-[44px]"
                >
                  <SocialIcon id={id} size={18} />
                  {label}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
