const P: Record<string, React.ReactNode> = {
  map: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  sack: <><path d="M6 20h12l-1-11H7z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  book: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 10h6M9 14h6M9 18h4" /></>,
  mountain: <><path d="M2 18l6-9 4 5 3-4 7 8z" /><path d="M2 18h20" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  pencil: <path d="M4 20l3-1 11-11-2-2L5 17z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  warn: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  cloud: <><path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 15" /><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" /></>,
  locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V4h12" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  back: <path d="M15 5l-7 7 7 7" />,
  cube: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 22V12M21 7l-9 5-9-5" /></>,
};

export function Icon({ name, size = 20, className = "", stroke = 1.75 }: { name: keyof typeof P | string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {P[name]}
    </svg>
  );
}
