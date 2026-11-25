"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/Sidebar";
import { Icon } from "@/components/Icon";
import { EmptyParcels, Notice } from "@/components/ui";
import { useHydrated, useStore } from "@/lib/store";
import { SECTIONS, missingFields, sectionOf, type FieldDef } from "@/lib/notebook";
import { cropById } from "@/lib/agro";
import { fmtDate, ha, parcelNames, parcelsArea, todayIso } from "@/lib/format";
import { exportNotebookXlsx } from "@/lib/exportXlsx";
import type { Entry, EntryType } from "@/lib/types";

type Draft = { id: string | null; type: EntryType; date: string; parcelIds: string[]; status: Entry["status"]; data: Record<string, string> };

export default function CuadernoPage() {
  return (
    <Suspense fallback={<TopBar title="Cuaderno de campo" />}>
      <Cuaderno />
    </Suspense>
  );
}

function Cuaderno() {
  const hyd = useHydrated();
  const params = useSearchParams();
  const { parcels, entries, farm, addEntry, updateEntry, removeEntry } = useStore();
  const [tab, setTab] = useState<EntryType>((params.get("seccion") as EntryType) || "tratamiento");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const pid = params.get("parcela");
    if (hyd && pid && parcels.some((p) => p.id === pid)) setDraft(blank(tab, [pid]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hyd]);

  const list = useMemo(
    () => entries.filter((e) => e.type === tab && (!filter || e.parcelIds.includes(filter))).sort((a, b) => (a.status === b.status ? b.date.localeCompare(a.date) : a.status === "pendiente" ? -1 : 1)),
    [entries, tab, filter],
  );
  const counts = useMemo(() => Object.fromEntries(SECTIONS.map((s) => [s.type, entries.filter((e) => e.type === s.type).length])), [entries]);
  const pending = entries.filter((e) => e.status === "pendiente").length;
  const incomplete = entries.filter((e) => e.status === "hecho" && missingFields(e.type, e.data).length > 0).length;

  if (!hyd) return <TopBar title="Cuaderno de campo" />;
  if (!parcels.length) return (<><TopBar title="Cuaderno de campo" /><EmptyParcels what="el cuaderno de campo" /></>);

  const sec = sectionOf(tab);

  function blank(type: EntryType, parcelIds: string[] = []): Draft {
    return { id: null, type, date: todayIso(), parcelIds, status: "hecho", data: {} };
  }
  function lastOf(type: EntryType) {
    return [...entries].filter((e) => e.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }
  function save(asTemplate = false) {
    if (!draft || !draft.parcelIds.length) return;
    if (draft.id && !asTemplate) updateEntry(draft.id, { date: draft.date, parcelIds: draft.parcelIds, status: draft.status, data: draft.data, type: draft.type });
    else addEntry({ type: draft.type, date: draft.date, parcelIds: draft.parcelIds, status: draft.status, data: draft.data });
    setDraft(null);
  }
  async function doExport() {
    setExporting(true);
    try {
      await exportNotebookXlsx(farm, parcels, entries);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <TopBar title="Cuaderno de campo">
        <span className="chip chip-mute">Cuaderno de apoyo</span>
        <div className="flex-1" />
        <button className="btn btn-sm btn-outline" onClick={doExport} disabled={exporting}><Icon name="download" size={18} />{exporting ? "Preparando…" : "Excel"}</button>
        <Link className="btn btn-sm btn-outline" href="/app/cuaderno/imprimir"><Icon name="print" size={18} />PDF</Link>
        <button className="btn btn-sm btn-primary" onClick={() => setDraft(blank(tab))}><Icon name="plus" size={18} />Nueva anotación</button>
      </TopBar>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="enter flex min-w-0 flex-1 flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
          <nav aria-label="Secciones del cuaderno" className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button key={s.type} onClick={() => setTab(s.type)} aria-current={tab === s.type ? "true" : undefined}
                className={`h-9 rounded-full px-3.5 text-sm font-semibold ${tab === s.type ? "bg-tinta text-white" : "border border-linea bg-white"}`}>
                {s.short} · {counts[s.type] ?? 0}
              </button>
            ))}
            <div className="flex-1" />
            <select className="input h-9 w-auto text-sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por parcela">
              <option value="">Todas las parcelas</option>
              {parcels.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </nav>

          {(pending > 0 || incomplete > 0) && (
            <Notice>
              {pending > 0 && <>{pending} anotación{pending > 1 ? "es" : ""} pendiente{pending > 1 ? "s" : ""} de confirmar (del plan de abonado). </>}
              {incomplete > 0 && <>{incomplete} anotación{incomplete > 1 ? "es" : ""} con datos obligatorios sin rellenar.</>}
            </Notice>
          )}

          <section className="card overflow-x-auto px-5 py-1">
            {list.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-tinta-2">Todavía no hay {sec.name.toLowerCase()} anotados.</p>
                <button className="btn btn-primary" onClick={() => setDraft(blank(tab))}><Icon name="plus" size={18} />Anotar el primero</button>
              </div>
            ) : (
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-linea text-left text-xs font-bold text-tinta-3">
                    <th className="py-3 pr-3">FECHA</th><th className="py-3 pr-3">PARCELAS</th>
                    {sec.fields.filter((f) => f.type !== "textarea").slice(0, 3).map((f) => <th key={f.key} className="py-3 pr-3 uppercase">{f.label.split(" (")[0]}</th>)}
                    <th className="py-3 pr-3">SUPERFICIE</th><th className="py-3 pr-3">ESTADO</th><th className="py-3" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => {
                    const miss = missingFields(e.type, e.data);
                    return (
                      <tr key={e.id} className="cursor-pointer border-b border-linea-2 last:border-0 hover:bg-rastrojo" onClick={() => setDraft({ id: e.id, type: e.type, date: e.date, parcelIds: e.parcelIds, status: e.status, data: { ...e.data } })}>
                        <td className="num py-3 pr-3">{fmtDate(e.date)}</td>
                        <td className="py-3 pr-3">{parcelNames(e.parcelIds, parcels)}</td>
                        {sec.fields.filter((f) => f.type !== "textarea").slice(0, 3).map((f) => <td key={f.key} className="py-3 pr-3">{e.data[f.key] ? `${e.data[f.key]}${f.unit ? " " + f.unit : ""}` : <span className="text-tinta-3">—</span>}</td>)}
                        <td className="num py-3 pr-3">{ha(parcelsArea(e.parcelIds, parcels))}</td>
                        <td className="py-3 pr-3">{e.status === "pendiente" ? <span className="chip chip-water">Pendiente</span> : miss.length ? <span className="chip chip-warn">Faltan {miss.length} datos</span> : <span className="chip chip-ok">Completo</span>}</td>
                        <td className="py-3 text-right">
                          <button className="btn btn-sm btn-ghost" title="Duplicar con fecha de hoy" aria-label="Duplicar" onClick={(ev) => { ev.stopPropagation(); setDraft({ id: null, type: e.type, date: todayIso(), parcelIds: e.parcelIds, status: "hecho", data: { ...e.data } }); }}><Icon name="copy" size={16} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
          <p className="text-xs text-tinta-3">Tempero ordena los datos como el modelo del cuaderno de explotación. El registro oficial se presenta en el cuaderno digital (CUE) de tu comunidad autónoma.</p>
        </div>

        {draft && (
          <EntryForm
            draft={draft}
            setDraft={setDraft}
            onSave={save}
            onDelete={draft.id ? () => { if (confirm("¿Borrar esta anotación?")) { removeEntry(draft.id!); setDraft(null); } } : undefined}
            onTemplate={() => {
              const last = lastOf(draft.type);
              if (last) setDraft({ ...draft, data: { ...last.data } });
            }}
            hasTemplate={!!lastOf(draft.type)}
          />
        )}
      </div>
    </>
  );
}

function EntryForm({ draft, setDraft, onSave, onDelete, onTemplate, hasTemplate }: {
  draft: Draft; setDraft: (d: Draft | null) => void; onSave: (asTemplate?: boolean) => void; onDelete?: () => void; onTemplate: () => void; hasTemplate: boolean;
}) {
  const { parcels, entries } = useStore();
  const sec = sectionOf(draft.type);
  const miss = missingFields(draft.type, draft.data);
  const set = (k: string, v: string) => setDraft({ ...draft, data: { ...draft.data, [k]: v } });
  const suggestions = (key: string) => [...new Set(entries.filter((e) => e.type === draft.type).map((e) => e.data[key]).filter(Boolean))].slice(0, 30);
  const togglePid = (id: string) => setDraft({ ...draft, parcelIds: draft.parcelIds.includes(id) ? draft.parcelIds.filter((x) => x !== id) : [...draft.parcelIds, id] });
  const nApplied = draft.type === "fertilizacion" && draft.data.n && draft.data.dosis ? (Number(draft.data.n) * Number(draft.data.dosis)) / 100 : null;

  return (
    <section aria-label="Anotación" className="m-4 flex animate-rise flex-col gap-4 overflow-y-auto rounded-[22px] border border-linea/80 bg-white p-5 shadow-[var(--shadow-float)] lg:mt-2 lg:ml-0 lg:w-[440px] lg:flex-none">
      <div className="flex items-center justify-between">
        <h2 className="h2">{draft.id ? "Editar" : "Anotar"} · {sec.short.toLowerCase()}</h2>
        <button className="btn btn-sm btn-ghost" aria-label="Cerrar" onClick={() => setDraft(null)}><Icon name="x" size={18} /></button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button key={s.type} className={`h-8 rounded-full px-3 text-xs font-semibold ${draft.type === s.type ? "bg-tinta text-white" : "border border-linea"}`} onClick={() => setDraft({ ...draft, type: s.type })}>{s.short}</button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-tinta-2">Parcelas · {ha(parcelsArea(draft.parcelIds, parcels))}</span>
        <div className="flex max-h-40 flex-col overflow-y-auto rounded-xl border border-linea">
          {parcels.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 border-b border-linea-2 px-3 py-2 text-sm last:border-0">
              <input type="checkbox" className="h-4 w-4 accent-olivo" checked={draft.parcelIds.includes(p.id)} onChange={() => togglePid(p.id)} />
              <span className="flex-1">{p.name}</span><span className="text-xs text-tinta-3">{cropById(p.cropId).name}</span>
            </label>
          ))}
        </div>
      </div>

      {hasTemplate && !draft.id && (
        <button className="btn btn-sm btn-outline self-start" onClick={onTemplate}><Icon name="copy" size={16} />Copiar datos de la última anotación</button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="label">Fecha<input type="date" className="input num" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
        <label className="label">Estado
          <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Entry["status"] })}>
            <option value="hecho">Hecho</option><option value="pendiente">Pendiente</option>
          </select>
        </label>
        {sec.fields.map((f) => <FieldInput key={f.key} f={f} value={draft.data[f.key] ?? ""} onChange={(v) => set(f.key, v)} suggestions={suggestions(f.key)} missing={draft.status === "hecho" && miss.includes(f.label)} />)}
      </div>
      {nApplied != null && <Notice tone="earth">Aporta {nApplied.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg N/ha.</Notice>}
      {draft.status === "hecho" && miss.length > 0 && <Notice>Faltan datos obligatorios: {miss.join(", ")}. Puedes guardar igualmente y completarlo luego.</Notice>}

      <div className="flex-1" />
      <div className="flex gap-2.5">
        {onDelete && <button className="btn btn-danger" onClick={onDelete} aria-label="Borrar"><Icon name="trash" size={18} /></button>}
        {draft.id && <button className="btn btn-outline flex-1" onClick={() => onSave(true)}>Guardar como nueva</button>}
        <button className="btn btn-primary flex-1" onClick={() => onSave()} disabled={!draft.parcelIds.length}>Guardar</button>
      </div>
    </section>
  );
}

function FieldInput({ f, value, onChange, suggestions, missing }: { f: FieldDef; value: string; onChange: (v: string) => void; suggestions: string[]; missing: boolean }) {
  const id = "f-" + f.key;
  const cls = `input ${missing ? "border-trigo bg-[#FFFBF0]" : ""}`;
  const label = <>{f.label}{f.unit ? ` (${f.unit})` : ""}{f.required ? " *" : ""}</>;
  if (f.type === "select")
    return (
      <label className={`label ${f.wide ? "col-span-2" : ""}`}>{label}
        <select className={cls} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="" />
          {f.options!.filter(Boolean).map((o) => <option key={o}>{o}</option>)}
        </select>
      </label>
    );
  if (f.type === "textarea")
    return <label className="label col-span-2">{label}<textarea className={cls} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
  return (
    <label className={`label ${f.wide ? "col-span-2" : ""}`}>{label}
      <input className={`${cls} ${f.type === "number" ? "num" : ""}`} inputMode={f.type === "number" ? "decimal" : undefined} list={suggestions.length ? id : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
      {suggestions.length > 0 && <datalist id={id}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </label>
  );
}
