/**
 * Logo RunOS — ikon "route" (jalur GPS + titik finish) inline SVG + wordmark.
 * Sumber master: logo/render_icon.py (palet resmi index.css).
 */
export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="RunOS">
      <rect width="64" height="64" rx="14" fill="#18181b" />
      <path
        d="M14 50 V30 H30 V16 H46 V40 L50 44"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="44" r="6" fill="#FC4C02" />
    </svg>
  );
}

export function Logo({ markClass = 'w-7 h-7', textClass = 'text-xl font-bold tracking-tight' }: {
  markClass?: string;
  textClass?: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className={markClass} />
      <span className={`text-zinc-900 dark:text-white ${textClass}`}>RunOS</span>
    </span>
  );
}
