"use client";

import { useEffect, useRef, useState } from "react";

/** Aparece al entrar en pantalla (una sola vez). */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "figure" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const El = Tag as "div";
  return (
    <El ref={ref as React.RefObject<HTMLDivElement>} data-in={inView} className={`reveal ${className}`} style={{ ["--d" as string]: `${delay}ms` }}>
      {children}
    </El>
  );
}

/** Inclinación suave siguiendo el puntero (solo en el elemento principal de la portada). */
export function Tilt({ children, className = "", max = 5 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1400px) rotateY(${x * max}deg) rotateX(${-y * max}deg)`;
      });
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = "";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return (
    <div ref={ref} className={`transition-transform duration-500 ease-[var(--ease-out-quart)] will-change-transform ${className}`}>
      {children}
    </div>
  );
}

/** Curvas de nivel que se dibujan al cargar: el motivo de la marca. */
export function Contours({ className = "", stroke = "currentColor", count = 9 }: { className?: string; stroke?: string; count?: number }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 800 600" fill="none" className={className} preserveAspectRatio="xMidYMid slice">
      {Array.from({ length: count }).map((_, i) => {
        const r = 60 + i * 42;
        const d = `M ${400 - r * 1.5} ${330 + i * 4} C ${400 - r * 1.3} ${330 - r * 0.9}, ${400 + r * 0.6} ${310 - r * 1.05}, ${400 + r * 1.45} ${300 - r * 0.2} S ${400 + r * 0.9} ${350 + r * 0.95}, ${400 - r * 0.2} ${360 + r * 0.7} S ${400 - r * 1.6} ${350 + r * 0.3}, ${400 - r * 1.5} ${330 + i * 4}`;
        return (
          <path key={i} d={d} stroke={stroke} strokeWidth={1.1} pathLength={1} strokeDasharray="1" style={{ ["--len" as string]: 1, animation: `draw 2.4s var(--ease-out-quart) ${i * 90}ms both` }} />
        );
      })}
    </svg>
  );
}
