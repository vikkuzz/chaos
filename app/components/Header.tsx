"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Главная" },
  { href: "/game", label: "Игра" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`font-medium transition-colors ${
                pathname === href
                  ? "text-sky-400"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="sm:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px]"
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
        </div>
      </div>
    </header>
  );
}
