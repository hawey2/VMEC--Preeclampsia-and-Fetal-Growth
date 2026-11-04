import { analysers, markerName, t, type Key, type Lang } from "./i18n";
import type { AssessmentOut, Risk } from "./types";

const analyserName: Record<string, string> = Object.fromEntries(analysers);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const oneIn = (r: Risk | undefined) => (r ? `1 / ${r.one_in.toLocaleString("en")}` : "—");

function rawValue(r: AssessmentOut, m: string): string {
  if (m === "map" && r.map_mmhg !== null) return `${r.map_mmhg} mmHg`;
  if (m === "utpi" && r.utpi_mean !== null) return r.utpi_mean.toFixed(2);
  if (m === "plgf" && r.plgf_pg_ml !== null) return `${r.plgf_pg_ml} pg/mL`;
  return "—";
}

/** Shared by the on-screen result and the printed A4 report. */
export function RiskTable({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  return (
    <table className="risk">
      <thead>
        <tr>
          <th>{L("riskOf")}</th>
          <th>{L("mfOnly")}</th>
          <th>{L("combined")}</th>
        </tr>
      </thead>
      <tbody>
        {r.maternal_factors_only.map((mf, i) => (
          <tr key={mf.cutoff_weeks}>
            <td>
              {L("before")} {mf.cutoff_weeks} {L("wk")}
            </td>
            <td className="num">{oneIn(mf)}</td>
            <td className="num">{r.combined ? oneIn(r.combined[i]) : <span className="muted">{L("notAvailable")}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScreenBadge({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  return (
    <div className={`screen ${r.screen.high_risk ? "screen--high" : "screen--low"}`}>
      <strong>{r.screen.high_risk ? L("highRisk") : L("lowRisk")}</strong>
      <span>
        {L("screenBasis")}: 1 / {r.screen.cutoff_one_in}
        {r.screen.basis === "maternal_factors_only" && ` (${L("mfBasisNote")})`}
      </span>
    </div>
  );
}

export function MomTable({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const markers = Object.keys(r.moms);
  if (!markers.length) return null;
  return (
    <table className="moms">
      <thead>
        <tr>
          <th>{L("marker")}</th>
          <th>{L("value")}</th>
          <th>MoM</th>
        </tr>
      </thead>
      <tbody>
        {markers.map((m) => (
          <tr key={m}>
            <td>
              {markerName[m]}
              {m === "plgf" && r.plgf_analyser && <span className="muted small"> · {analyserName[r.plgf_analyser] ?? r.plgf_analyser}</span>}
            </td>
            <td className="num">{rawValue(r, m)}</td>
            <td className="num">{r.moms[m].toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const both = (k: Key) => (
  <>
    {t("vi", k)} <span className="en">/ {t("en", k)}</span>
  </>
);

type Facts = { label: Key; value: string }[];

export function PrintReport({ r, facts }: { r: AssessmentOut; facts: Facts }) {
  return (
    <article className="print-report" aria-hidden="true">
      <header className="pr__head">
        <div>
          <div className="pr__org">Vinmec Ocean Park 2 · Khoa Sản / Department of Obstetrics</div>
          <h1>{both("appTitle")}</h1>
        </div>
        <div className="pr__meta">
          <div>{both("examDate")}: {fmtDate(r.exam_date)}</div>
          <div>{both("printed")}: {r.generated_at.replace("T", " ").slice(0, 16)}</div>
        </div>
      </header>

      <section className="pr__patient">
        <div><span>{both("name")}</span><strong>{r.patient.name || "—"}</strong></div>
        <div><span>PID</span><strong>{r.patient.pid || "—"}</strong></div>
        <div><span>{both("age")}</span><strong>{r.age_years.toFixed(1)}</strong></div>
        <div>
          <span>{both("ga")}</span>
          <strong>{r.ga_label}</strong> <small>({r.dating_method.toUpperCase()})</small>
        </div>
        <div><span>EDD</span><strong>{fmtDate(r.edd)}</strong></div>
      </section>

      <div className="pr__cols">
        <section>
          <h2>{both("maternal")}</h2>
          <dl>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{t("vi", f.label)}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2>{both("moms")}</h2>
          <MomTable r={r} lang="vi" />
          {!Object.keys(r.moms).length && <p className="muted">—</p>}
        </section>
      </div>

      <section className="pr__result">
        <h2>{both("results")}</h2>
        <RiskTable r={r} lang="vi" />
        <ScreenBadge r={r} lang="vi" />
        <p className="pr__action">
          <strong>{both("action")}:</strong> {r.screen.high_risk ? t("vi", "actionHigh") : t("vi", "actionLow")}
          <br />
          <span className="en">{r.screen.high_risk ? t("en", "actionHigh") : t("en", "actionLow")}</span>
        </p>
      </section>

      {r.warnings.length > 0 && (
        <section className="pr__notes">
          <h2>{both("notes")}</h2>
          <ul>{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}

      <section className="pr__sign">
        <div><span>{both("measuredBy")}</span></div>
        <div><span>{both("doctor")}</span></div>
      </section>

      <footer className="pr__foot">
        <p>{t("vi", "disclaimer")}</p>
        <p className="en">{t("en", "disclaimer")}</p>
        <p className="pr__model">
          {both("model")}: {r.model_label} · SHA-256 {r.model_checksum.slice(0, 16)}
        </p>
      </footer>
    </article>
  );
}
