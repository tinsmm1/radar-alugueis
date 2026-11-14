/** Minimal accessible SVG step/line chart (no chart library): values over time. */
export type LinePoint = { at: Date; value: number };

const W = 640;
const H = 200;
const PAD = { l: 64, r: 16, t: 14, b: 28 };

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

export function LineChart({ points, format, label }: { points: LinePoint[]; format: (v: number) => string; label: string }) {
  if (points.length === 0) return null;
  const pts = points.length === 1 ? [points[0], { at: new Date(), value: points[0].value }] : points;
  const xs = pts.map((p) => p.at.getTime());
  const ys = pts.map((p) => p.value);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs, x0 + 86_400_000);
  const pad = (Math.max(...ys) - Math.min(...ys)) * 0.15 || Math.max(...ys) * 0.05 || 1;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  const sx = (t: number) => PAD.l + ((t - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  // Step line: a price holds until it changes.
  let d = `M${sx(xs[0])},${sy(ys[0])}`;
  for (let i = 1; i < pts.length; i++) d += ` H${sx(xs[i])} V${sy(ys[i])}`;
  const area = `${d} V${H - PAD.b} H${sx(xs[0])} Z`;
  const fmtDate = (t: number) => new Date(t).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      <title>{label}</title>
      {niceTicks(y0, y1).map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className="stroke-border" strokeDasharray="3 3" />
          <text x={PAD.l - 8} y={sy(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
            {format(v)}
          </text>
        </g>
      ))}
      <path d={area} className="fill-primary/10" />
      <path d={d} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.at.getTime())} cy={sy(p.value)} r={4} className="fill-card stroke-primary" strokeWidth={2}>
          <title>{`${p.at.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}: ${format(p.value)}`}</title>
        </circle>
      ))}
      <text x={PAD.l} y={H - 8} className="fill-muted-foreground text-[11px]">
        {fmtDate(x0)}
      </text>
      <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[11px]">
        {fmtDate(x1)}
      </text>
    </svg>
  );
}
