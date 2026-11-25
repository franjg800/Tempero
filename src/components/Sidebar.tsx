"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { useHydrated, useStore } from "@/lib/store";
import { nf } from "@/lib/format";

const NAV = [
  { href: "/app/mapa", label: "Mapa", icon: "map", hint: "Parcelas y recintos" },
  { href: "/app/riego", label: "Lluvia y riego", icon: "drop", hint: "Balance hídrico" },
  { href: "/app/abonado", label: "Plan de abonado", icon: "sack", hint: "N, P y K" },
  { href: "/app/cuaderno", label: "Cuaderno de campo", icon: "book", hint: "Anotaciones" },
  { href: "/app/terreno", label: "Terreno 3D", icon: "mountain", hint: "Relieve" },
];

export function Sidebar() {
  const path = usePathname();
  const hyd = useHydrated();
  const farm = useStore((s) => s.farm);
  const parcels = useStore((s) => s.parcels);
  const pending = useStore((s) => s.entries.filter((e) => e.status === "pendiente").length);
  const [open, setOpen] = useState(false);
  const total = parcels.reduce((s, p) => s + p.areaHa, 0);

  return (
    <>
      <a href="#contenido" className="sr-only z-50 rounded-lg bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
      <div className="no-print flex items-center justify-between bg-noche px-4 py-3 lg:hidden">
        <Link href="/app/mapa"><Logo dark /></Link>
        <button className="btn btn-sm text-white" aria-label="Menú" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="menu" /></button>
      </div>
      <aside className={`no-print relative flex-col gap-1 overflow-hidden bg-noche px-3 py-5 text-[oklch(0.84_0.015_150)] lg:flex lg:w-[244px] lg:flex-none ${open ? "flex" : "hidden"}`}>
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-10 -left-16 h-80 w-80 opacity-[0.07]" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2">
          {[20, 34, 48, 62, 76, 90].map((r) => <ellipse key={r} cx="100" cy="110" rx={r * 1.25} ry={r} transform="rotate(-18 100 110)" />)}
        </svg>
        <Link href="/" className="hidden px-2.5 pb-5 lg:block"><Logo dark /></Link>
        <Link href="/app/ajustes" className="group mb-4 flex flex-col items-start gap-0.5 rounded-2xl border border-noche-3 bg-noche-2/80 px-3.5 py-3 text-left transition-colors hover:border-olivo-vivo/40">
          <span className="text-[10.5px] font-bold tracking-[0.08em] text-[oklch(0.7_0.02_150)]">EXPLOTACIÓN</span>
          <span className="font-display text-[17px] leading-tight font-semibold text-white">{hyd ? farm.name : "…"}</span>
          <span className="num text-xs text-[oklch(0.7_0.02_150)]">{hyd ? `${nf(total, 1)} ha · ${parcels.length} parcela${parcels.length === 1 ? "" : "s"} · ${farm.campaign}` : " "}</span>
        </Link>
        <nav aria-label="Secciones" className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const on = path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors duration-200 ${on ? "bg-olivo font-semibold text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_6px_18px_-8px_oklch(0.43_0.075_150/0.9)]" : "font-medium hover:bg-noche-2 hover:text-white"}`}>
                <Icon name={n.icon} className={`transition-transform duration-200 ${on ? "" : "group-hover:-translate-y-px"}`} />
                <span className="flex-1">{n.label}</span>
                {n.href === "/app/cuaderno" && hyd && pending > 0 && <span className="num rounded-full bg-trigo px-1.5 text-[11px] font-bold text-noche">{pending}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <Link href="/app/ajustes" onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${path.startsWith("/app/ajustes") ? "bg-olivo font-semibold text-white" : "hover:bg-noche-2 hover:text-white"}`}>
          <Icon name="gear" />Ajustes
        </Link>
        <p className="px-3 pt-2 text-[11px] leading-snug text-[oklch(0.62_0.02_150)]">Tus datos se guardan en este navegador.</p>
      </aside>
    </>
  );
}

const TITLES: Record<string, { sec: string; icon: string }> = {
  "/app/mapa": { sec: "Mapa", icon: "map" },
  "/app/riego": { sec: "Lluvia y riego", icon: "drop" },
  "/app/abonado": { sec: "Plan de abonado", icon: "sack" },
  "/app/cuaderno": { sec: "Cuaderno de campo", icon: "book" },
  "/app/terreno": { sec: "Terreno 3D", icon: "mountain" },
  "/app/ajustes": { sec: "Ajustes", icon: "gear" },
};

/** Barra superior flotante (dock): título de la sección y sus acciones. */
export function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  const path = usePathname();
  const farm = useStore((s) => s.farm);
  const hyd = useHydrated();
  const t = Object.entries(TITLES).find(([k]) => path.startsWith(k))?.[1];
  return (
    <div className="no-print sticky top-0 z-30 px-3 pt-3 pb-2 sm:px-4">
      <div className="dock flex flex-wrap items-center gap-2.5 rounded-[20px] py-2 pr-2 pl-3">
        {t && <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-olivo-claro text-olivo"><Icon name={t.icon} size={19} /></span>}
        <div className="mr-2 flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[11px] font-semibold text-tinta-3">{hyd ? farm.name : " "}</span>
          <h1 className="font-display text-[19px] font-semibold tracking-[-0.01em]">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
