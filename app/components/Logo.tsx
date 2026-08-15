export function CastleMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="6" fill="#0f172a" />
      <rect x="5" y="16" width="22" height="12" fill="#d97706" />
      <rect x="5" y="12" width="6" height="8" fill="#f59e0b" />
      <rect x="13" y="8" width="6" height="12" fill="#fbbf24" />
      <rect x="21" y="12" width="6" height="8" fill="#f59e0b" />
      <rect x="14" y="22" width="4" height="6" fill="#0f172a" />
    </svg>
  );
}

export function Logo({
  className = "",
  markClassName,
  textClassName = "font-bold text-white",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <CastleMark className={markClassName ?? "h-8 w-8 shrink-0"} />
      <span className={textClassName}>RTS Game</span>
    </span>
  );
}
