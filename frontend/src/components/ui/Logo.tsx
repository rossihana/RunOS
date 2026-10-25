/**
 * Logo RunOS — mark "Open Track": lintasan stadium terbuka monoline di tile oranye.
 * Master: logo-redesign/logo-open-track/ (palet resmi index.css: #FC4C02).
 */
export function LogoMark({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="RunOS">
      <rect width="64" height="64" rx="14" fill="#FC4C02" />
      <path
        d="M 11.75 36 A 10.25 10.25 0 0 0 22 46.25 L 42 46.25 A 10.25 10.25 0 0 0 52.25 36 L 52.25 28 A 10.25 10.25 0 0 0 42 17.75 L 22 17.75 A 10.25 10.25 0 0 0 11.75 28 L 11.75 29"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
      />
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
