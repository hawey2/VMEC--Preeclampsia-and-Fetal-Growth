import { analysers, markerName, t, type Key, type Lang } from "./i18n";
import type { AssessmentOut, Risk, ScreeningSummary } from "./types";
import { compactWarnings, msg } from "./messages";
import { fmtDateTime } from "./Records";

const analyserName: Record<string, string> = Object.fromEntries(analysers);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** "1 in 12" as on the FMF calculator (Vietnamese reports read "1/12"). */
const oneIn = (r: Risk | undefined, lang: Lang = "en") =>
  r ? t(lang, "oneInFmt").replace("{n}", r.one_in.toLocaleString("en")) : "—";

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
            <td className="num">{oneIn(mf, lang)}</td>
            <td className="num">{r.combined ? oneIn(r.combined[i], lang) : <span className="muted">{L("notAvailable")}</span>}</td>
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

const phraseKey: Record<string, Key> = { map: "phraseMap", utpi: "phraseUtpi", plgf: "phrasePlgf" };

/** FMF wording: what the risk was based on, then the classification and the ASPRE advice. */
export function RiskInterp(r: AssessmentOut, lang: Lang) {
  const used = ["map", "utpi", "plgf"].filter((m) => r.markers_used.includes(m)).map((m) => t(lang, phraseKey[m]));
  const list = used.length > 1 ? `${used.slice(0, -1).join(", ")}${t(lang, "interpAnd")}${used[used.length - 1]}` : used.join("");
  const basis = t(lang, "interpBasis").replace("{markers}", used.length ? `${t(lang, "interpWith")}${list}` : "");
  return `${basis} ${t(lang, r.screen.high_risk ? "interpHigh" : "interpLow")}`;
}

const comboLabel = (lang: Lang, ms: string[]) => [t(lang, "histLine"), ...ms.map((m) => markerName[m])].join(", ");

/** The headline FMF line: history plus every marker entered (or history alone). */
export function headlineCombo(r: AssessmentOut) {
  return r.combinations.reduce((best, c) => (c.markers.length > best.markers.length ? c : best), r.combinations[0]);
}

/** FMF-style result: headline line, interpretation, then history alone and each marker on its own. */
export function RiskLines({ r, lang }: { r: AssessmentOut; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const head = headlineCombo(r);
  const others = r.combinations.filter((c) => c !== head);
  const cell = (x: Risk | null) => (x ? oneIn(x, lang) : <span className="muted small">{L("pendingParams")}</span>);
  return (
    <div className="risklines">
      <h3>{L("riskBefore37")}</h3>
      <p className={`headline ${r.screen.high_risk ? "headline--high" : ""}`}>
        <span>{comboLabel(lang, head.markers)}:</span> <strong>{cell(head.risk37)}</strong>
        {head.risk32 && <span className="muted small"> · {L("riskBefore32")}: {oneIn(head.risk32, lang)}</span>}
      </p>
      <p className="interp">{RiskInterp(r, lang)}</p>
      {others.length > 0 && (
        <table>
          <caption className="muted small">{L("otherCombos")}</caption>
          <tbody>
            {others.map((c) => (
              <tr key={c.markers.join("+") || "history"}>
                <td>{comboLabel(lang, c.markers)}</td>
                <td className="num">{cell(c.risk37)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type Facts = { label: Key; value: string }[];

/** One-page A4 report in a single language (the one chosen when printing). */
export function PrintReport({ r, facts, lang, record }: { r: AssessmentOut; facts: Facts; lang: Lang; record: ScreeningSummary | null }) {
  const L = (k: Key) => t(lang, k);
  const head = headlineCombo(r);
  return (
    <article className="print-report" aria-hidden="true" lang={lang}>
      <header className="pr__head">
        <div>
          <div className="pr__org">{L("orgName")}</div>
          <h1>{L("appTitle")}</h1>
        </div>
        <div className="pr__meta">
          <div>{L("examDate")}: {fmtDate(r.exam_date)}</div>
          <div>{L("printed")}: {r.generated_at.replace("T", " ").slice(0, 16)}</div>
          <div>
            {record
              ? `${L("recordNo")} ${record.id} · ${L("versionWord")} ${record.version} · ${L(`status_${record.status}` as Key)}`
              : L(__STANDALONE__ ? "notSavedStandalone" : "notSaved")}
          </div>
        </div>
      </header>

      <section className="pr__patient">
        <div><span>{L("name")}</span><strong>{r.patient.name || "—"}</strong></div>
        <div><span>PID</span><strong>{r.patient.pid || "—"}</strong></div>
        <div><span>{L("age")}</span><strong>{r.age_years.toFixed(1)}</strong></div>
        <div>
          <span>{L("ga")}</span>
          <strong>{r.ga_label}</strong> <small>({r.dating_method.toUpperCase()})</small>
        </div>
        <div><span>{L("edd")}</span><strong>{fmtDate(r.edd)}</strong></div>
      </section>

      <section className="pr__result">
        <h2>{L("results")}</h2>
        <p className="pr__headline">
          {L("riskBefore37")}: <strong>{comboLabel(lang, head.markers)}: {oneIn(head.risk37 ?? undefined, lang)}</strong>
        </p>
        <p className="pr__interp">{RiskInterp(r, lang)}</p>
        <ScreenBadge r={r} lang={lang} />
        <RiskTable r={r} lang={lang} />
      </section>

      <div className="pr__cols">
        <section>
          <h2>{L("maternal")}</h2>
          <dl>
            {facts.map((f) => (
              <div key={f.label}>
                <dt>{L(f.label)}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h2>{L("moms")}</h2>
          <MomTable r={r} lang={lang} />
          {!Object.keys(r.moms).length && <p className="muted">—</p>}
          <ul className="pr__extra">
            {r.bpd && <li>BPD {r.bpd.measured_mm} mm ({L("median")}: {r.bpd.median_mm.toFixed(1)} mm)</li>}
            {r.oa_psv_ratio !== null && <li>{L("oa")}: {r.oa_psv_ratio.toFixed(2)}</li>}
            {r.map_operator && <li>MAP · {L("operator")}: {r.map_operator}</li>}
            {r.utpi_operator && <li>UtA-PI · {L("operator")}: {r.utpi_operator}</li>}
          </ul>
        </section>
      </div>

      {r.warnings.length > 0 && (
        <section className="pr__notes">
          <h2>{L("notes")}</h2>
          <ul>{compactWarnings(r.warnings).map((w) => <li key={w}>{msg(w, lang)}</li>)}</ul>
        </section>
      )}

      <section className="pr__sign">
        <div><span>{L("measuredBy")}</span></div>
        <div>
          <span>{L("doctor")}</span>
          {record?.signed_by && <strong className="pr__signed">{record.signed_by} · {fmtDateTime(record.signed_at!, lang)}</strong>}
        </div>
      </section>

      <footer className="pr__foot">
        <p>{L("disclaimer")}</p>
        <p className="pr__model">
          {L("model")}: {r.model_label} · SHA-256 {r.model_checksum.slice(0, 16)}
        </p>
      </footer>
    </article>
  );
}
