export function LogoMark({ size = 32, fill = "oklch(0.43 0.075 150)", line = "oklch(0.965 0.008 100)" }: { size?: number; fill?: string; line?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4C32 4 10 27 10 41a22 22 0 0 0 44 0C54 27 32 4 32 4z" fill={fill} />
      <path d="M17 42c5-3 9-3 15 0s10 3 15 0" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 50c4-2.5 8-2.5 12 0s8 2.5 12 0" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".75" />
      <path d="M23 34c3-2 6-2 9 0s6 2 9 0" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function Logo({ dark = false, size = 30 }: { dark?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} fill={dark ? "oklch(0.72 0.09 150)" : "oklch(0.43 0.075 150)"} line={dark ? "oklch(0.22 0.022 155)" : "oklch(0.965 0.008 100)"} />
      <span className={`font-display text-[25px] leading-none font-semibold tracking-[-0.02em] ${dark ? "text-white" : "text-tinta"}`}>Tempero</span>
    </span>
  );
}
