"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Logo } from "../Logo";
import { Icon } from "../Icon";

const LINKS = [
  { id: "como", label: "Cómo funciona" },
  { id: "riego", label: "Riego" },
  { id: "abonado", label: "Abonado" },
  { id: "cuaderno", label: "Cuaderno" },
  { id: "terreno", label: "3D" },
];

/** Dock superior: barra ancha y transparente arriba del todo; al bajar se recoge en una píldora flotante
 *  con desenfoque, y un indicador se desliza bajo la sección que estás leyendo. */
export function SiteDock() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (ents) => {
        const vis = ents.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (vis) setActive(vis.target.id);
        else if (window.scrollY < 300) setActive(null);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.2, 0.5] },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!nav.current || !active) return setInd(null);
    const a = nav.current.querySelector<HTMLAnchorElement>(`a[data-id="${active}"]`);
    if (a) setInd({ x: a.offsetLeft, w: a.offsetWidth });
  }, [active, scrolled]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <div
        className={`flex w-full items-center justify-between gap-4 rounded-[22px] border py-2 pr-2 pl-4 transition-[max-width,background-color,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)] ${
          scrolled ? "dock max-w-[920px]" : "max-w-[1280px] border-transparent bg-transparent"
        }`}
      >
        <Link href="/" aria-label="Tempero, inicio" className="flex-none"><Logo size={28} /></Link>
        <nav aria-label="Principal" ref={nav} className="relative hidden items-center gap-1 md:flex">
          {ind && (
            <span aria-hidden="true" className="absolute top-0 h-full rounded-full bg-olivo-claro transition-[transform,width] duration-500 ease-[var(--ease-out-expo)]" style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />
          )}
          {LINKS.map((l) => (
            <a key={l.id} data-id={l.id} href={`#${l.id}`} aria-current={active === l.id ? "true" : undefined}
              className={`relative rounded-full px-3.5 py-2 text-[14.5px] font-medium transition-colors ${active === l.id ? "text-olivo-oscuro" : "text-tinta-2 hover:text-tinta"}`}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/app/mapa" className="btn btn-sm btn-primary h-10 px-4">Abrir Tempero</Link>
          <button className="btn btn-sm btn-ghost md:hidden" aria-label="Menú" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? "x" : "menu"} /></button>
        </div>
      </div>
      {open && (
        <div className="dock absolute top-[70px] right-3 left-3 animate-rise rounded-[20px] p-2 md:hidden">
          {LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 font-medium hover:bg-rastrojo">{l.label}</a>
          ))}
        </div>
      )}
    </header>
  );
}
