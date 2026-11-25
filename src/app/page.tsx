import Link from "next/link";
import Image from "next/image";
import { LogoMark } from "@/components/Logo";
import { SiteDock } from "@/components/site/SiteDock";
import { Contours, Reveal, Tilt } from "@/components/site/Motion";

function Shot({ src, alt, w, h, className = "", priority = false }: { src: string; alt: string; w: number; h: number; className?: string; priority?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-[20px] border border-linea/90 bg-white p-1.5 shadow-[0_30px_70px_-30px_oklch(0.2_0.02_155/0.45)] ${className}`}>
      <Image src={src} alt={alt} width={w} height={h} priority={priority} sizes="(min-width: 1024px) 760px, 100vw" className="h-auto w-full rounded-[15px]" />
    </div>
  );
}

const STEPS = [
  { n: "01", t: "Marca tus recintos", d: "Buscas tu municipio, te acercas y haces clic en cada recinto SIGPAC. Superficie, uso, pendiente y altitud se rellenan solos." },
  { n: "02", t: "Dile qué tienes", d: "Cultivo, suelo y sistema de riego. Si tienes análisis de suelo, mejor: el abonado se ajusta a él." },
  { n: "03", t: "Deja que haga las cuentas", d: "Calcula el riego del año con el clima histórico de tu parcela, el abonado con tu análisis y el relieve con el LiDAR del IGN. Y te lleva el cuaderno." },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-clip bg-rastrojo text-tinta">
      <SiteDock />

      {/* Portada */}
      <section className="relative">
        <Contours className="pointer-events-none absolute -top-24 right-[-10%] h-[760px] w-[900px] text-olivo/20" />
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-12 px-5 pt-32 pb-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pt-40 lg:pb-28">
          <div className="flex flex-col gap-7">
            <p className="animate-rise text-[14px] font-semibold tracking-[0.04em] text-barro">Para quien vive del campo, no de la pantalla</p>
            <h1 className="animate-rise font-display text-[clamp(44px,6.2vw,86px)] leading-[0.98] font-semibold tracking-[-0.03em] [animation-delay:80ms]">
              Marca tu finca en el mapa. <span className="text-olivo italic">Tempero</span> hace las cuentas.
            </h1>
            <p className="max-w-[34rem] animate-rise text-[19px] leading-relaxed text-tinta-2 [animation-delay:160ms]">
              El agua de riego de cada parcela, el diseño del goteo, el plan de abonado, el relieve en 3D y el cuaderno de campo. Todo sobre la ortofoto de tu explotación.
            </p>
            <div className="flex animate-rise flex-wrap items-center gap-x-6 gap-y-3 [animation-delay:240ms]">
              <Link href="/app/mapa" className="btn btn-primary h-13 rounded-[14px] px-6 text-[16px]">Empezar con mis parcelas</Link>
              <a href="#como" className="group inline-flex items-center gap-2 font-semibold text-olivo">
                Ver cómo funciona <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-y-0.5">↓</span>
              </a>
            </div>
            <p className="animate-rise text-[13.5px] text-tinta-3 [animation-delay:320ms]">Gratis mientras está en pruebas. Sin registro: tus datos se quedan en tu ordenador.</p>
          </div>
          <div className="relative animate-[unveil_1.1s_var(--ease-out-expo)_200ms_both]">
            <Tilt max={4}>
              <Shot src="/shots/mapa.webp" alt="Pantalla del mapa de Tempero con cinco parcelas marcadas sobre la ortofoto y la ficha de una de ellas" w={1600} h={1000} priority />
            </Tilt>
            <div className="absolute -bottom-6 left-4 hidden animate-[rise_0.8s_var(--ease-out-expo)_900ms_both] rounded-2xl bg-noche px-4 py-3 text-white shadow-[var(--shadow-float)] sm:block">
              <span className="block text-[11px] font-semibold tracking-[0.06em] text-olivo-vivo">RECINTO SIGPAC</span>
              <span className="code text-[15px]">25:57:0:0:1:26:1</span>
            </div>
          </div>
        </div>
      </section>

      {/* Fuentes de datos */}
      <div className="border-y border-linea">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-10 gap-y-3 px-5 py-5 text-[14px] text-tinta-2 sm:px-8">
          <span className="font-semibold text-tinta">Con datos oficiales y abiertos</span>
          <span>Ortofoto PNOA · IGN</span>
          <span>Recintos SIGPAC · FEGA</span>
          <span>10 años de clima diario · Open-Meteo</span>
          <span>Relieve LiDAR · IGN</span>
          <span>Cultivos · FAO-56</span>
        </div>
      </div>

      {/* Cómo funciona */}
      <section id="como" className="mx-auto max-w-[1280px] scroll-mt-24 px-5 py-24 sm:px-8 lg:py-32">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-[clamp(34px,4vw,54px)] leading-[1.04] font-semibold tracking-[-0.02em]">Tres pasos y la finca trabaja para ti.</h2>
        </Reveal>
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} as="li" delay={i * 120} className="relative flex flex-col gap-3 border-t border-tinta/15 pt-6">
              <span className="font-display text-[64px] leading-none font-light text-olivo/35 italic">{s.n}</span>
              <h3 className="font-display text-[24px] font-semibold">{s.t}</h3>
              <p className="max-w-[30ch] text-[16px] leading-relaxed text-tinta-2">{s.d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Riego */}
      <section id="riego" className="scroll-mt-24 bg-white">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:py-28">
          <Reveal className="flex flex-col gap-5">
            <span className="text-[13px] font-bold tracking-[0.08em] text-acequia">RIEGO</span>
            <h2 className="font-display text-[clamp(32px,3.6vw,48px)] leading-[1.05] font-semibold tracking-[-0.02em]">El agua que necesita tu riego, calculada de verdad.</h2>
            <p className="text-[17px] leading-relaxed text-tinta-2">Con 10 años de clima diario de tu parcela, Tempero calcula mes a mes las necesidades del cultivo (FAO-56) y las del riego que pongas: en goteo, los goteros por planta, el tiempo de riego, los sectores y el caudal; en aspersión o pívot, la dosis y cada cuántos días.</p>
            <ul className="mt-1 flex flex-col gap-2.5 text-[15.5px]">
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-4 flex-none rounded-full bg-acequia" />Plan anual en mm y m³ por parcela, con el año mediano y los extremos</li>
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-4 flex-none rounded-full bg-acequia" />Diseño agronómico del goteo: lavado de sales, uniformidad y superficie mojada</li>
              <li className="flex gap-3"><span className="mt-2 h-1.5 w-4 flex-none rounded-full bg-acequia" />Balance de esta semana con la previsión, y cada riego al cuaderno</li>
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <Shot src="/shots/riego.webp" alt="Plan anual de riego con las necesidades del cultivo mes a mes" w={1600} h={1000} />
          </Reveal>
        </div>
      </section>

      {/* Abonado */}
      <section id="abonado" className="mx-auto grid max-w-[1280px] scroll-mt-24 items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:py-32">
        <Reveal className="order-2 lg:order-1">
          <Shot src="/shots/abonado.webp" alt="Plan de abonado con el balance de nitrógeno por parcela y el reparto entre fondo y cobertera" w={1600} h={1000} />
        </Reveal>
        <Reveal delay={120} className="order-1 flex flex-col gap-5 lg:order-2">
          <span className="text-[13px] font-bold tracking-[0.08em] text-barro">PLAN DE ABONADO</span>
          <h2 className="font-display text-[clamp(32px,3.6vw,48px)] leading-[1.05] font-semibold tracking-[-0.02em]">El plan que te piden, hecho en una tarde.</h2>
          <p className="text-[17px] leading-relaxed text-tinta-2">Balance de nitrógeno por parcela descontando lo que ya aportan el suelo, el agua de riego y el cultivo anterior. Fósforo y potasio según tu análisis. Reparto en fondo y coberteras, y en PDF para tu técnico.</p>
          <p className="border-l-0 text-[14px] leading-relaxed text-tinta-3">Desde septiembre de 2026 las explotaciones obligadas deben tener plan de abonado (RD 1051/2022). Tempero te da el borrador; tu técnico lo revisa y firma.</p>
        </Reveal>
      </section>

      {/* Cuaderno */}
      <section id="cuaderno" className="scroll-mt-24 bg-noche text-rastrojo">
        <div className="relative mx-auto max-w-[1280px] px-5 py-24 sm:px-8 lg:py-28">
          <Contours className="pointer-events-none absolute top-0 left-[-20%] h-full w-[70%] text-olivo-vivo/10" count={7} />
          <div className="relative grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-end">
            <Reveal className="flex flex-col gap-5">
              <span className="text-[13px] font-bold tracking-[0.08em] text-trigo">CUADERNO DE CAMPO</span>
              <h2 className="font-display text-[clamp(32px,3.6vw,52px)] leading-[1.04] font-semibold tracking-[-0.02em]">Anotar un tratamiento cuesta lo que tardas en elegir las parcelas.</h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-[17px] leading-relaxed text-[oklch(0.82_0.015_150)]">Copias los datos de la última vez, cambias la fecha y guardas. Te marca lo que falta antes de que te lo pida nadie. Lo planificado en el abonado aparece como pendiente, y al final de campaña lo descargas en Excel o PDF, ordenado como el modelo oficial.</p>
            </Reveal>
          </div>
          <Reveal delay={160} className="relative mt-14">
            <Shot src="/shots/cuaderno.webp" alt="Cuaderno de campo con la lista de tratamientos y el formulario para anotar uno nuevo" w={1600} h={1000} className="border-noche-3 bg-noche-2" />
          </Reveal>
          <p className="relative mt-6 text-[13.5px] text-[oklch(0.7_0.02_150)]">Es un cuaderno de apoyo: el registro oficial se presenta en el cuaderno digital (CUE) de tu comunidad autónoma.</p>
        </div>
      </section>

      {/* Terreno 3D */}
      <section id="terreno" className="relative scroll-mt-24 overflow-hidden bg-[radial-gradient(ellipse_at_70%_45%,#ffffff_0%,#f3f1ec_55%,#e9e5dc_100%)]">
        <div className="mx-auto grid max-w-[1280px] items-center gap-10 px-5 py-24 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:py-28">
          <Reveal className="flex flex-col gap-5">
            <span className="text-[13px] font-bold tracking-[0.08em] text-olivo">TERRENO 3D</span>
            <h2 className="font-display text-[clamp(34px,4vw,56px)] leading-[1.02] font-semibold tracking-[-0.02em]">Tu finca en maqueta. Y por dónde se va el agua.</h2>
            <p className="text-[17px] leading-relaxed text-tinta-2">Solo tu terreno, recortado y en relieve con el LiDAR del IGN o tu plano de AutoCAD (DXF o LandXML). Curvas de nivel, el agua animada bajando por la pendiente, por dónde sale y dónde se encharca. Y la imagen lista para tu presentación.</p>
            <Link href="/app/terreno" className="btn btn-primary mt-2 self-start">Ver mi finca en 3D</Link>
          </Reveal>
          <Reveal delay={120}>
            <Image src="/shots/terreno.webp" alt="Maqueta 3D de una finca con la ortofoto, curvas de nivel y la escorrentía" width={1600} height={1000} sizes="(min-width: 1024px) 60vw, 100vw" className="h-auto w-full" />
          </Reveal>
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-[1280px] px-5 py-24 sm:px-8 lg:py-28">
        <Reveal className="relative overflow-hidden rounded-[28px] bg-olivo px-7 py-14 text-white sm:px-12 lg:px-16">
          <Contours className="pointer-events-none absolute -right-20 -bottom-40 h-[520px] w-[700px] text-white/12" count={8} />
          <div className="relative flex flex-wrap items-end justify-between gap-8">
            <div className="flex max-w-2xl flex-col gap-4">
              <LogoMark size={48} fill="oklch(0.965 0.008 100)" line="oklch(0.43 0.075 150)" />
              <h2 className="font-display text-[clamp(32px,3.8vw,52px)] leading-[1.04] font-semibold tracking-[-0.02em]">Pruébalo con tu propia finca esta misma tarde.</h2>
              <p className="text-[17px] text-[oklch(0.9_0.02_145)]">Sin registro y sin instalar nada. Abre el mapa y marca tu primer recinto.</p>
            </div>
            <Link href="/app/mapa" className="btn h-13 rounded-[14px] bg-white px-7 text-[16px] font-bold text-olivo-oscuro shadow-[0_3px_0_oklch(0.34_0.06_150)] hover:bg-olivo-claro">Marcar mis parcelas</Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-linea">
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4 px-5 py-8 text-[13.5px] text-tinta-3 sm:px-8">
          <span>Tempero · un producto de GarzaDigital</span>
          <span>PNOA cedido por © Instituto Geográfico Nacional · SIGPAC © FEGA (CC BY 4.0)</span>
        </div>
      </footer>
    </div>
  );
}
