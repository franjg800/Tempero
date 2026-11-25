import Link from "next/link";
import Image from "next/image";
import { Logo, LogoMark } from "@/components/Logo";
import { Icon } from "@/components/Icon";

const MODULES = [
  { icon: "map", bg: "bg-olivo-claro", fg: "text-olivo", t: "Mapa de la explotación", d: "Eliges tus recintos SIGPAC con un clic sobre la ortofoto del PNOA, o dibujas la parcela." },
  { icon: "drop", bg: "bg-acequia-claro", fg: "text-acequia", t: "Lluvia y riego", d: "Balance hídrico diario por parcela con lluvia y ETo. Cuánto regar, cuándo y cuántas horas." },
  { icon: "sack", bg: "bg-barro-claro", fg: "text-barro", t: "Plan de abonado", d: "Balance de N, P y K por parcela y reparto en fondo y coberteras, listo para imprimir." },
  { icon: "book", bg: "bg-trigo-claro", fg: "text-[#8A6508]", t: "Cuaderno de campo", d: "Anotas en segundos con plantillas y lo exportas a Excel o PDF ordenado como el modelo oficial." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-rastrojo text-tinta">
      <header className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 px-8 py-5">
        <Link href="/"><Logo /></Link>
        <nav aria-label="Principal" className="flex flex-wrap gap-7 text-[15px] font-medium">
          <a href="#que-hace">Qué hace</a>
          <a href="#terreno">Terreno 3D</a>
          <a href="#cuaderno">Cuaderno</a>
        </nav>
        <Link href="/app/mapa" className="btn btn-primary">Abrir la aplicación</Link>
      </header>

      <section className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-12 px-8 pt-10 pb-20">
        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
          <span className="font-mono text-[13px] font-semibold tracking-wider text-barro">PARA EXPLOTACIONES DE VERDAD</span>
          <h1 className="font-display text-[44px] leading-[1.03] font-extrabold tracking-tight sm:text-[62px]">Marca tu finca en el mapa. Tempero hace las cuentas.</h1>
          <p className="max-w-xl text-[19px] leading-relaxed text-tinta-2">Lluvia de cada parcela, riego, plan de abonado y cuaderno de campo en un solo sitio. Y tu terreno en 3D.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/app/mapa" className="btn btn-primary h-13 px-6 text-base">Empezar con mis parcelas SIGPAC</Link>
            <a href="#que-hace" className="btn btn-outline h-13 px-6 text-base">Ver cómo funciona</a>
          </div>
          <span className="text-sm text-tinta-3">Pensada para ordenador. Gratis mientras está en pruebas, sin registro.</span>
        </div>
        <div className="relative min-w-0 flex-[1_1_560px]">
          <div className="relative h-[480px] overflow-hidden rounded-[20px]">
            <Image src="/hero-pnoa.jpg" alt="Ortofoto de parcelas de regadío en Lleida" fill priority sizes="(min-width: 1024px) 640px, 100vw" className="object-cover" />
            <span className="absolute bottom-3 left-3 rounded-md bg-noche/65 px-2 py-1 text-xs text-white">PNOA cedido por © Instituto Geográfico Nacional</span>
          </div>
          <div className="absolute bottom-10 -left-4 flex w-[250px] flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-[0_16px_40px_rgba(20,32,26,.22)] sm:-left-6">
            <span className="text-xs font-semibold text-tinta-3">PARCELA DE MAÍZ · EJEMPLO</span>
            <span className="font-display text-lg font-bold">Riega el viernes</span>
            <span className="num text-sm text-acequia">12 mm · 2 h 40 min</span>
          </div>
          <div className="absolute top-6 right-5 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_40px_rgba(20,32,26,.22)]">
            <Icon name="cloud" size={28} className="text-acequia" />
            <div className="flex flex-col"><span className="text-xs font-semibold text-tinta-3">LLUVIA 7 DÍAS</span><span className="num text-lg font-semibold">18,4 mm</span></div>
          </div>
        </div>
      </section>

      <section id="que-hace" className="border-y border-linea bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-10 px-8 py-20">
          <div className="flex max-w-3xl flex-col gap-3">
            <h2 className="font-display text-[40px] font-extrabold tracking-tight">Todo empieza en el mapa</h2>
            <p className="text-lg leading-relaxed text-tinta-2">Seleccionas tus recintos y cada parcela ya sabe su superficie, su uso SIGPAC, su pendiente y su altitud. Le dices el cultivo y el riego, y Tempero se encarga del resto.</p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            {MODULES.map((m) => (
              <article key={m.t} className="flex flex-col gap-3 rounded-2xl border border-linea bg-rastrojo p-6">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.bg} ${m.fg}`}><Icon name={m.icon} size={24} /></span>
                <h3 className="font-display text-xl font-bold">{m.t}</h3>
                <p className="text-[15px] leading-relaxed text-tinta-2">{m.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="terreno" className="relative overflow-hidden bg-noche text-rastrojo">
        <Image src="/olivar-pnoa.jpg" alt="" fill sizes="100vw" className="object-cover opacity-25" />
        <div className="relative mx-auto flex max-w-[1280px] flex-col gap-5 px-8 py-24">
          <span className="font-mono text-[13px] font-semibold tracking-wider text-[#9CC3E0]">TERRENO 3D</span>
          <h2 className="max-w-3xl font-display text-[40px] leading-tight font-extrabold tracking-tight">Mira tu finca en relieve y por dónde corre el agua.</h2>
          <p className="max-w-2xl text-lg leading-relaxed text-[#C9D2CB]">Ya puedes ver tus parcelas en 3D sobre la ortofoto. Muy pronto: curvas de nivel, el agua animada bajando por el terreno y tu plano de AutoCAD (DXF o LandXML).</p>
          <Link href="/app/terreno" className="btn self-start bg-white text-olivo hover:bg-olivo-claro">Ver mi terreno en 3D</Link>
        </div>
      </section>

      <section id="cuaderno" className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-12 px-8 py-20">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <h2 className="font-display text-[40px] font-extrabold tracking-tight">El cuaderno se rellena casi solo</h2>
          <p className="text-lg leading-relaxed text-tinta-2">Eliges las parcelas, copias los datos de la última vez y guardas. Lo que planificas en el abonado aparece como pendiente. Al final lo descargas en Excel o PDF.</p>
          <p className="text-sm text-tinta-3">Tempero es un cuaderno de apoyo: el registro oficial se presenta en el cuaderno digital (CUE) de tu comunidad autónoma.</p>
        </div>
        <div className="card flex min-w-0 flex-[1_1_480px] flex-col gap-3 p-6">
          <div className="flex items-center justify-between"><b className="font-display text-lg">Anotar tratamiento</b><span className="chip chip-ok">3 parcelas · 28,6 ha</span></div>
          <div className="grid grid-cols-2 gap-2.5 text-sm">
            {[["Fecha", "25/11/2026"], ["Empezar desde", "La última anotación"], ["Producto", "Nombre comercial"], ["Nº de registro", "Obligatorio"]].map(([k, v]) => (
              <div key={k} className="rounded-[10px] border border-linea px-3 py-2.5"><span className="text-xs text-tinta-3">{k}</span><div className="font-semibold">{v}</div></div>
            ))}
          </div>
          <div className="flex justify-end gap-2.5"><span className="btn btn-sm btn-outline">Excel</span><span className="btn btn-sm btn-primary">Guardar</span></div>
        </div>
      </section>

      <section className="bg-olivo text-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-8 px-8 py-16">
          <div className="flex items-center gap-5">
            <LogoMark size={56} fill="#F3F2EC" line="#2E5B3B" />
            <div>
              <h2 className="font-display text-[34px] font-extrabold tracking-tight">Pruébalo con tu propia finca</h2>
              <p className="text-[#D9E6DA]">Sin registro. Tus datos se quedan en tu ordenador.</p>
            </div>
          </div>
          <Link href="/app/mapa" className="btn h-13 bg-white px-6 text-base font-bold text-olivo hover:bg-olivo-claro">Marcar mis parcelas</Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-4 px-8 py-8 text-sm text-tinta-3">
        <span>Tempero · un producto de GarzaDigital</span>
        <span>Datos: IGN (PNOA), FEGA (SIGPAC), Open-Meteo</span>
      </footer>
    </div>
  );
}
