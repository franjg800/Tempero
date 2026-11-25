"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { Icon } from "./Icon";
import { useHydrated, useStore } from "@/lib/store";
import { nf } from "@/lib/format";

const NAV = [
  { href: "/app/mapa", label: "Mapa", icon: "map" },
  { href: "/app/riego", label: "Lluvia y riego", icon: "drop" },
  { href: "/app/abonado", label: "Plan de abonado", icon: "sack" },
  { href: "/app/cuaderno", label: "Cuaderno de campo", icon: "book" },
  { href: "/app/terreno", label: "Terreno 3D", icon: "mountain" },
];

export function Sidebar() {
  const path = usePathname();
  const hyd = useHydrated();
  const farm = useStore((s) => s.farm);
  const parcels = useStore((s) => s.parcels);
  const [open, setOpen] = useState(false);
  const total = parcels.reduce((s, p) => s + p.areaHa, 0);

  return (
    <>
      <div className="no-print flex items-center justify-between bg-noche px-4 py-3 lg:hidden">
        <Link href="/app/mapa"><Logo dark /></Link>
        <button className="btn btn-sm text-white" aria-label="Menú" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
      </div>
      <aside className={`no-print flex-col gap-1.5 bg-noche px-3.5 py-5 text-[#C9D2CB] lg:flex lg:w-[232px] lg:flex-none ${open ? "flex" : "hidden"}`}>
        <Link href="/" className="hidden px-2 pb-4 lg:block"><Logo dark /></Link>
        <Link href="/app/ajustes" className="mb-3 flex flex-col items-start gap-0.5 rounded-xl border border-noche-3 bg-noche-2 px-3 py-2.5 text-left hover:border-[#4a6252]">
          <span className="text-[11px] font-semibold tracking-wide text-[#9DAAA1]">EXPLOTACIÓN</span>
          <span className="text-[15px] font-semibold text-white">{hyd ? farm.name : "…"}</span>
          <span className="font-mono text-xs text-[#9DAAA1]">{hyd ? `${nf(total, 1)} ha · ${parcels.length} parcela${parcels.length === 1 ? "" : "s"}` : " "}</span>
        </Link>
        {NAV.map((n) => {
          const on = path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] ${on ? "bg-olivo font-semibold text-white" : "font-medium hover:bg-noche-2"}`}>
              <Icon name={n.icon} />{n.label}
            </Link>
          );
        })}
        <div className="flex-1" />
        <Link href="/app/ajustes" onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] ${path.startsWith("/app/ajustes") ? "bg-olivo font-semibold text-white" : "hover:bg-noche-2"}`}>
          <Icon name="gear" />Ajustes
        </Link>
      </aside>
    </>
  );
}

export function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="no-print flex flex-wrap items-center gap-3 border-b border-linea bg-white px-6 py-3.5">
      <h1 className="h1 mr-2">{title}</h1>
      {children}
    </div>
  );
}
