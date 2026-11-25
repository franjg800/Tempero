import type { WaterResult } from "@/lib/water";
import { shortDate } from "@/lib/format";

export function WaterChart({ wb, from, to }: { wb: WaterResult; from: number; to: number }) {
  const days = wb.days.slice(Math.max(0, from), Math.min(wb.days.length, to));
  const W = 760, H = 300, L = 40, R = 50, T = 16, B = 40;
  const n = days.length;
  const step = (W - L - R) / Math.max(1, n);
  const maxMm = Math.ceil((Math.max(8, ...days.map((d) => Math.max(d.rain, d.irrigation, d.etc))) * 1.12) / 4) * 4;
  const y = (mm: number) => T + (H - T - B) * (1 - mm / maxMm);
  const yPct = (p: number) => T + (H - T - B) * (1 - p / 100);
  const todayLocal = wb.todayIndex - Math.max(0, from);
  const xC = (i: number) => L + step * i + step / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxMm * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Lluvia, riego, consumo del cultivo y agua útil del suelo por día" className="block h-auto w-full">
      {todayLocal + 1 < n && (
        <>
          <rect x={L + step * (todayLocal + 1)} y={T} width={step * (n - todayLocal - 1)} height={H - T - B} fill="#F3F2EC" />
          <text x={L + step * (todayLocal + 1) + 8} y={T + 14} fontSize="12" fontWeight="600" fill="#5E6A62">Previsión</text>
        </>
      )}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={i === 0 ? "#B8B5A8" : "#ECEAE2"} />
          <text x={L - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#5E6A62" fontFamily="var(--font-jetbrains)">{t}</text>
        </g>
      ))}
      {[0, 50, 100].map((p) => (
        <text key={p} x={W - R + 8} y={yPct(p) + 4} fontSize="11" fill="#2E5B3B" fontFamily="var(--font-jetbrains)">{p}%</text>
      ))}
      {days.map((d, i) => {
        const bw = Math.min(22, step * 0.38);
        return (
          <g key={d.date}>
            {d.rain > 0 && <rect x={xC(i) - bw - 1} y={y(d.rain)} width={bw} height={y(0) - y(d.rain)} rx="3" fill="#1E6AA0" opacity={d.forecast ? 0.55 : 1} />}
            {d.irrigation > 0 && (
              <rect x={xC(i) + 1} y={y(d.irrigation)} width={bw} height={y(0) - y(d.irrigation)} rx="3" fill={d.irrigationKind === "supuesto" ? "#BFD8EC" : "#7FB0D6"} />
            )}
            <text x={xC(i)} y={H - B + 18} fontSize="11" textAnchor="middle" fill={i === todayLocal ? "#17241C" : "#5E6A62"} fontWeight={i === todayLocal ? 700 : 400}>{i === todayLocal ? "hoy" : shortDate(d.date)}</text>
          </g>
        );
      })}
      <polyline points={days.map((d, i) => `${xC(i)},${y(d.etc)}`).join(" ")} fill="none" stroke="#A85A24" strokeWidth="2.5" />
      <polyline points={days.map((d, i) => `${xC(i)},${yPct(d.awPct)}`).join(" ")} fill="none" stroke="#2E5B3B" strokeWidth="2.5" />
      <line x1={L} x2={W - R} y1={yPct(wb.thresholdPct)} y2={yPct(wb.thresholdPct)} stroke="#2E5B3B" strokeDasharray="5 4" />
      <text x={L + 6} y={yPct(wb.thresholdPct) - 6} fontSize="11" fontWeight="600" fill="#2E5B3B">umbral de riego {Math.round(wb.thresholdPct)} %</text>
    </svg>
  );
}

export function WaterLegend() {
  const it = (c: string, t: string, line = false) => (
    <span className="flex items-center gap-1.5"><i className={line ? "h-[3px] w-3.5" : "h-3 w-3 rounded-[3px]"} style={{ background: c }} />{t}</span>
  );
  return (
    <div className="flex flex-wrap gap-4 text-[13px] text-tinta-2">
      {it("#1E6AA0", "Lluvia (mm)")}{it("#7FB0D6", "Riego anotado")}{it("#BFD8EC", "Riego supuesto")}{it("#A85A24", "Consumo del cultivo (mm)", true)}{it("#2E5B3B", "Agua útil del suelo (%)", true)}
    </div>
  );
}
