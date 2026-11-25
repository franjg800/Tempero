export function LogoMark({ size = 32, fill = "#2E5B3B", line = "#F3F2EC" }: { size?: number; fill?: string; line?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 4C32 4 10 27 10 41a22 22 0 0 0 44 0C54 27 32 4 32 4z" fill={fill} />
      <path d="M17 42c5-3 9-3 15 0s10 3 15 0" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 50c4-2.5 8-2.5 12 0s8 2.5 12 0" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".75" />
      <path d="M23 34c3-2 6-2 9 0s6 2 9 0" stroke={line} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={32} fill={dark ? "#7FB08A" : "#2E5B3B"} line={dark ? "#14201A" : "#F3F2EC"} />
      <span className={`font-display text-[24px] font-extrabold tracking-tight ${dark ? "text-white" : "text-tinta"}`}>Tempero</span>
    </span>
  );
}
