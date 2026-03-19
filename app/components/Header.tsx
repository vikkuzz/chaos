"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { socialLinks } from "../config/social";
import { SocialIcon } from "./SocialLinks";

const navItems = [
  { href: "/", label: "Главная" },
  { href: "/game", label: "Игра" },
  { href: "/plans", label: "Планы" },
];

export function Header() {
  const pathname = usePathname();
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
