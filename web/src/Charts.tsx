import { t, type Key, type Lang } from "./i18n";
import type { AssessmentOut } from "./types";

const W = 360;
const H = 250;
const M = { l: 46, r: 14, t: 14, b: 38 };
const IW = W - M.l - M.r;
const IH = H - M.t - M.b;

type CurveProps = {
  id: string;
  title: string;
  unit: string;
  curve: [number, number][];
  point: [number, number] | null;
  log: boolean;
  yTicks: number[];
  lang: Lang;
  note?: string;
};

/** Expected median for this woman across 11+0 to 14+0 weeks, with her value. */
function CurveChart({ id, title, unit, curve, point, log, yTicks, lang, note }: CurveProps) {
  const L = (k: Key) => t(lang, k);
  const x0 = 77;
  const x1 = 98;
  const tf = (v: number) => (log ? Math.log10(v) : v);
  const ys = [...curve.map((c) => c[1]), ...(point ? [point[1]] : []), ...yTicks];
  const y0 = tf(Math.min(...ys));
  const y1 = tf(Math.max(...ys));
  const pad = (y1 - y0) * 0.08 || 0.1;
  const X = (d: number) => M.l + ((d - x0) / (x1 - x0)) * IW;
  const Y = (v: number) => M.t + IH - ((tf(v) - (y0 - pad)) / (y1 - y0 + 2 * pad)) * IH;
  const path = curve.map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join("");
  const weeks = [77, 84, 91, 98];
  const titleId = `${id}-title`;

  return (
    <figure className="chart">
      <figcaption id={titleId}>
        <strong>{title}</strong> <span className="muted">({unit})</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId}>
        <g className="chart__grid">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} />
              <text x={M.l - 6} y={Y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {weeks.map((d) => (
            <g key={d}>
              <line x1={X(d)} x2={X(d)} y1={M.t} y2={M.t + IH} />
              <text x={X(d)} y={H - M.b + 16} textAnchor="middle">{d / 7}</text>
            </g>
          ))}
          <text x={M.l + IW} y={H - 4} textAnchor="end">{lang === "vi" ? "Tuổi thai (tuần)" : "Gestational age (w)"}</text>
        </g>
        <path d={path} className="chart__median" />
        {point && <circle cx={X(point[0])} cy={Y(point[1])} r={5} className="chart__point" />}
      </svg>
      <div className="chart__legend">
        <span><i className="sw sw--median" /> {L("median")}</span>
        {point && <span><i className="sw sw--point" /> {L("patientValue")}: {point[1].toFixed(point[1] < 10 ? 2 : 1)}</span>}
      </div>
      {note && <p className="muted small">{note}</p>}
    </figure>
  );
}

function BpdChart({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  if (!r.bpd) return null;
  const pts: [number, number][] = [];
  for (let d = 77; d <= 98; d++) pts.push([d, 0.4299 * d - 16.33798]);
  return (
    <CurveChart
      id="bpd"
      title="BPD"
      unit="mm"
      curve={pts}
      point={[r.ga_days, r.bpd.measured_mm]}
      log={false}
      yTicks={[15, 20, 25, 30]}
      lang={lang}
      note={lang === "vi" ? "Trung vị: BPD = 0.4299 × tuổi thai (ngày) − 16.338 (de Paco Matallana 2025)." : "Median: BPD = 0.4299 × GA (days) − 16.338 (de Paco Matallana 2025)."}
    />
  );
}

const phi = (z: number) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

/** Gaussian prior for GA at delivery with PE; shaded area before 37 w = preterm-PE risk. */
function PriorChart({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const mu = r.prior_mean_weeks;
  const sd = r.prior_sd_weeks;
  const x0 = 20;
  const x1 = 70;
  const ga = r.ga_days / 7;
  const xs: number[] = [];
  for (let x = x0; x <= x1; x += 0.25) xs.push(x);
  const dens = xs.map((x) => phi((x - mu) / sd) / sd);
  const ymax = Math.max(...dens) * 1.1;
  const X = (x: number) => M.l + ((x - x0) / (x1 - x0)) * IW;
  const Y = (y: number) => M.t + IH - (y / ymax) * IH;
  const line = xs.map((x, i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(dens[i]).toFixed(1)}`).join("");
  const shadeXs = xs.filter((x) => x >= ga && x <= 37);
  const shade =
    shadeXs.length > 1
      ? `M${X(shadeXs[0])},${Y(0)}` +
        shadeXs.map((x) => `L${X(x).toFixed(1)},${Y(phi((x - mu) / sd) / sd).toFixed(1)}`).join("") +
        `L${X(shadeXs[shadeXs.length - 1])},${Y(0)}Z`
      : "";
  const r37 = r.maternal_factors_only.find((e) => e.cutoff_weeks === 37);

  return (
    <figure className="chart">
      <figcaption id="prior-title">
        <strong>{L("priorChart")}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="prior-title">
        <g className="chart__grid">
          {[20, 30, 40, 50, 60, 70].map((x) => (
            <g key={x}>
              <line x1={X(x)} x2={X(x)} y1={M.t} y2={M.t + IH} />
              <text x={X(x)} y={H - M.b + 16} textAnchor="middle">{x}</text>
            </g>
          ))}
          <line x1={M.l} x2={W - M.r} y1={Y(0)} y2={Y(0)} />
          <text x={M.l + IW} y={H - 4} textAnchor="end">{lang === "vi" ? "Tuổi thai khi sinh do TSG (tuần)" : "GA at delivery with PE (w)"}</text>
        </g>
        {shade && <path d={shade} className="chart__shade" />}
        <path d={line} className="chart__median" />
        {[32, 37].map((c) => (
          <g key={c}>
            <line x1={X(c)} x2={X(c)} y1={M.t} y2={Y(0)} className="chart__cut" />
            <text x={X(c) - 3} y={M.t + 10} textAnchor="end" className="chart__label">{c}</text>
          </g>
        ))}
        <line x1={X(mu)} x2={X(mu)} y1={Y(phi(0) / sd)} y2={Y(0)} className="chart__mu" />
        <text x={X(mu) + 4} y={Y(phi(0) / sd) + 2} className="chart__label">μ = {mu.toFixed(1)}</text>
      </svg>
      <div className="chart__legend">
        <span><i className="sw sw--shade" /> {L("priorChartNote")}{r37 ? ` (1 / ${r37.one_in})` : ""}</span>
      </div>
      <p className="muted small">μ = {mu.toFixed(2)}, σ = {sd.toFixed(2)} {lang === "vi" ? "tuần" : "weeks"}</p>
    </figure>
  );
}

export function Charts({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const ga = r.ga_days;
  return (
    <section className="card">
      <h2>{L("assessments")}</h2>
      <div className="charts">
        <PriorChart r={r} lang={lang} />
        {r.utpi_mean !== null && (
          <CurveChart id="utpi" title="UtA-PI" unit="PI" curve={r.curves.utpi} point={[ga, r.utpi_mean]} log yTicks={[0.6, 1, 1.4, 2, 2.8, 4]} lang={lang} note={L("centileNote")} />
        )}
        {r.map_mmhg !== null && (
          <CurveChart id="map" title="MAP" unit="mmHg" curve={r.curves.map} point={[ga, r.map_mmhg]} log={false} yTicks={[70, 80, 90, 100, 110, 120]} lang={lang} note={L("centileNote")} />
        )}
        {r.plgf_pg_ml !== null && (
          <CurveChart
            id="plgf"
            title="PlGF"
            unit="pg/mL"
            curve={r.curves.plgf}
            point={[r.plgf_sample_ga_days ?? ga, r.plgf_pg_ml]}
            log
            yTicks={[10, 20, 40, 80, 160]}
            lang={lang}
            note={L("centileNote")}
          />
        )}
        <BpdChart r={r} lang={lang} />
      </div>
    </section>
  );
}
