import { analysers, markerName, t, type Key, type Lang } from "./i18n";
import type { AssessmentOut, Risk } from "./types";

const analyserName: Record<string, string> = Object.fromEntries(analysers);

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** "1 in 12" as on the FMF calculator (Vietnamese reports read "1/12"). */
const oneIn = (r: Risk | undefined, lang: Lang = "en") =>
  r ? (lang === "vi" ? `1/${r.one_in.toLocaleString("en")}` : `1 in ${r.one_in.toLocaleString("en")}`) : "—";

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

const both = (k: Key) => (
  <>
    {t("vi", k)} <span className="en">/ {t("en", k)}</span>
  </>
);

/** One line for all "coefficients not verified" notes so the report stays on one page. */
function compactWarnings(ws: string[]): string[] {
  const coef = ws.map((w) => /^Coefficients for '(\w+)' are '(\w+)'/.exec(w)).filter((m): m is RegExpExecArray => !!m);
  const rest = ws.filter((w) => !/^Coefficients for '/.test(w));
  if (!coef.length) return rest;
  return [`Coefficients not verified, not for clinical use: ${coef.map((m) => `${m[1]} (${m[2]})`).join(", ")}.`, ...rest];
}

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
          <ul className="pr__extra">
            {r.bpd && <li>BPD {r.bpd.measured_mm} mm ({t("vi", "median")}: {r.bpd.median_mm.toFixed(1)} mm)</li>}
            {r.oa_psv_ratio !== null && <li>{t("vi", "oa")}: {r.oa_psv_ratio.toFixed(2)}</li>}
            {r.map_operator && <li>MAP · {t("vi", "operator")}: {r.map_operator}</li>}
            {r.utpi_operator && <li>UtA-PI · {t("vi", "operator")}: {r.utpi_operator}</li>}
          </ul>
        </section>
      </div>

      <section className="pr__result">
        <h2>{both("results")}</h2>
        <p className="pr__headline">
          {t("vi", "riskBefore37")} <span className="en">/ {t("en", "riskBefore37")}</span>:{" "}
          <strong>{comboLabel("en", headlineCombo(r).markers)}: {oneIn(headlineCombo(r).risk37 ?? undefined)}</strong>
        </p>
        <p className="pr__interp">{RiskInterp(r, "vi")}<br /><span className="en">{RiskInterp(r, "en")}</span></p>
        <ScreenBadge r={r} lang="vi" />
        <RiskTable r={r} lang="vi" />
      </section>

      {r.warnings.length > 0 && (
        <section className="pr__notes">
          <h2>{both("notes")}</h2>
          <ul>{compactWarnings(r.warnings).map((w) => <li key={w}>{w}</li>)}</ul>
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
