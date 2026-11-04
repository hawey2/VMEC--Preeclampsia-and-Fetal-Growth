import type { ReactNode } from "react";
import { liveMap, liveOa, liveUtpi } from "./api";
import { analysers, loc, t, type Key, type Lang } from "./i18n";
import type { AssessmentOut, FormState, YN } from "./types";
import { dateHints, type Issue, type Issues } from "./validate";

function FieldBox({ label, bad, hint, issue, children }: {
  label: string; bad: boolean; hint?: string; issue?: Issue; children: ReactNode;
}) {
  const cls = bad || issue?.level === "error" ? " field--bad" : issue ? " field--warn" : "";
  return (
    <label className={`field${cls}`}>
      <span className="field__label">
        {label}
        {hint && <span className="field__hint"> · {hint}</span>}
      </span>
      <span className="field__body">
        <span className="field__control">{children}</span>
        {issue && <span className={`field__msg field__msg--${issue.level}`} role={issue.level === "error" ? "alert" : undefined}>{issue.text}</span>}
      </span>
    </label>
  );
}

type Props = {
  lang: Lang;
  f: FormState;
  set: (patch: Partial<FormState>) => void;
  missing: string[];
  result: AssessmentOut | null;
  issues: Issues;
  /** GA worked out in the browser as the dating fields are typed (before any result). */
  gaDays: number | null;
};

const fmt = (x: number | null | undefined, d = 1) => (x === null || x === undefined || Number.isNaN(x) ? "" : x.toFixed(d));

export function AssessmentForm({ lang, f, set, missing, result, issues, gaDays }: Props) {
  const hints = dateHints(f);
  const inv = (k: string) => (issues[k]?.level === "error" ? true : undefined);
  const L = (k: Key) => t(lang, k);
  const bad = (k: string) => missing.includes(k);
  const unit = (u: string) => <span className="unit">{u}</span>;
  const mom = (m: string) =>
    result?.moms[m] !== undefined ? <span className="mom-chip">{result.moms[m].toFixed(2)} MoM</span> : null;

  const choice = <V extends string>(name: keyof FormState, k: Key, options: [V, Key][]) => (
    <div className={`field${bad(k) ? " field--bad" : ""}`} role="radiogroup" aria-label={L(k)}>
      <span className="field__label">{L(k)}</span>
      <span className="field__control">
        <span className="seg">
          {options.map(([v, label]) => (
            <button
              type="button"
              key={v}
              className={f[name] === v ? "seg__on" : ""}
              aria-pressed={f[name] === v}
              onClick={() => set({ [name]: v } as Partial<FormState>)}
            >
              {L(label)}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
  const yesNo = (name: keyof FormState, k: Key) => choice<Exclude<YN, "">>(name, k, [["yes", "yes"], ["no", "no"]]);

  const bpCell = (i: number, label: string) => (
    <input
      aria-label={label}
      aria-invalid={inv(`bp${i}`)}
      className={issues[`bp${i}`] ? `cell--${issues[`bp${i}`]!.level}` : undefined}
      inputMode="numeric"
     
      value={f.bp[i]}
      onChange={(e) => set({ bp: f.bp.map((v, j) => (j === i ? e.target.value : v)) })}
    />
  );
  const oaCell = (i: number, label: string) => (
    <input
      aria-label={label}
      aria-invalid={inv(`oa${i}`)}
      inputMode="decimal"
      value={f.oa[i]}
      onChange={(e) => set({ oa: f.oa.map((v, j) => (j === i ? e.target.value : v)) })}
    />
  );

  const mapLive = liveMap(f);
  const utpiLive = liveUtpi(f);
  const oaLive = liveOa(f);
  const readingsEntered = f.bp.some((v) => v.trim() !== "");

  return (
    <div className="form">
      <section className="card">
        <h2>{L("patient")}</h2>
        <div className="grid">
          <FieldBox label={L("name")} bad={false}>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
          </FieldBox>
          <FieldBox label={L("pid")} bad={false}>
            <input value={f.pid} onChange={(e) => set({ pid: e.target.value })} autoComplete="off" />
          </FieldBox>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <h2>{L("maternal")}</h2>
          <FieldBox label={L("dob")} bad={bad("dob")} issue={issues.date_of_birth}>
            <input type="date" value={f.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
          </FieldBox>
          <FieldBox label={L("height")} hint="120–210 cm" bad={bad("height")} issue={issues.height_cm}>
            <input inputMode="decimal" aria-invalid={inv("height_cm")} value={f.height_cm} onChange={(e) => set({ height_cm: e.target.value })} />
            {unit("cm")}
          </FieldBox>
          <FieldBox label={L("weight")} hint="30–200 kg" bad={bad("weight")} issue={issues.weight_kg}>
            <input inputMode="decimal" aria-invalid={inv("weight_kg")} value={f.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })} />
            {unit("kg")}
          </FieldBox>
          <FieldBox label={L("ethnicity")} bad={bad("ethnicity")}>
            <select value={f.ethnicity} onChange={(e) => set({ ethnicity: e.target.value })}>
              <option value="" />
              {loc(lang).ethnicities.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </FieldBox>
          {yesNo("smoker", "smoker")}
        </section>

        <section className="card">
          <h2>{L("pregnancy")}</h2>
          <FieldBox label={L("datingMethod")} bad={bad("datingMethod")}>
            <select value={f.dating_method} onChange={(e) => set({ dating_method: e.target.value })}>
              <option value="" />
              {loc(lang).datingMethods.map(([v, label, ok]) => (
                <option key={v} value={v} disabled={!ok}>{label}</option>
              ))}
            </select>
          </FieldBox>
          {(f.dating_method === "crl" || f.dating_method === "bpd") && (
            <p className="hint-line">{f.dating_method === "crl" ? "GA = 8.052 × √CRL + 23.73 (Robinson 1975)" : "GA = (BPD + 16.338) / 0.4299 (de Paco Matallana 2025)"}</p>
          )}
          {f.dating_method === "lmp" && (
            <FieldBox label={L("lmp")} hint={hints.lmp && `${L("acceptedRange")} ${hints.lmp}`} bad={false} issue={issues.lmp}><input type="date" value={f.lmp} onChange={(e) => set({ lmp: e.target.value })} /></FieldBox>
          )}
          {f.dating_method === "edd" && (
            <FieldBox label={L("edd")} hint={hints.edd && `${L("acceptedRange")} ${hints.edd}`} bad={false} issue={issues.edd}><input type="date" value={f.edd} onChange={(e) => set({ edd: e.target.value })} /></FieldBox>
          )}
          {f.dating_method === "ivf" && (
            <>
              <FieldBox label={L("transfer")} hint={hints.transfer_date && `${L("acceptedRange")} ${hints.transfer_date}`} bad={false} issue={issues.transfer_date}>
                <input type="date" value={f.transfer_date} onChange={(e) => set({ transfer_date: e.target.value })} />
              </FieldBox>
              <FieldBox label={L("embryoAge")} bad={false}>
                <select value={f.embryo_age_days} onChange={(e) => set({ embryo_age_days: e.target.value })}>
                  <option value="3">3 {L("days")}</option>
                  <option value="5">5 {L("days")}</option>
                  <option value="6">6 {L("days")}</option>
                </select>
              </FieldBox>
            </>
          )}
          {f.dating_method === "manual" && (
            <FieldBox label={L("gaManual")} hint="11+0 – 13+6" bad={false} issue={issues.weeks ?? issues.days}>
              <input className="short" inputMode="numeric" aria-invalid={inv("weeks")} value={f.weeks} onChange={(e) => set({ weeks: e.target.value })} />
              {unit(L("weeks"))}
              <input className="short" inputMode="numeric" aria-invalid={inv("days")} value={f.days} onChange={(e) => set({ days: e.target.value })} />
              {unit(L("days"))}
            </FieldBox>
          )}
          {result ? (
            <p className="hint-line"><strong>{L("ga")} {result.ga_label}</strong> · EDD {result.edd.split("-").reverse().join("/")}</p>
          ) : gaDays != null && gaDays >= 0 && gaDays < 300 ? (
            <p className="hint-line"><strong>{L("ga")} {Math.floor(Math.floor(gaDays) / 7)}+{Math.floor(gaDays) % 7}</strong></p>
          ) : null}
          {yesNo("vanishing_twin", "vanishingTwin")}
          <FieldBox label={L("conception")} bad={false}>
            <select value={f.conception} onChange={(e) => set({ conception: e.target.value })}>
              {loc(lang).conceptions.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </FieldBox>
          <FieldBox label={L("examDate")} bad={bad("examDate")}>
            <input type="date" value={f.exam_date} onChange={(e) => set({ exam_date: e.target.value })} />
          </FieldBox>
        </section>
      </div>

      <div className="two">
        <section className="card">
          <h2>{L("medical")}</h2>
          {yesNo("htn", "chronicHtn")}
          {yesNo("dm1", "dm1")}
          {yesNo("dm2", "dm2")}
          {f.dm2 === "yes" && yesNo("dm2_insulin", "dm2Insulin")}
          {yesNo("fam_pe", "famPe")}
          {yesNo("sle", "sleOnly")}
          {yesNo("aps", "apsOnly")}
        </section>

        <section className="card">
          <h2>{L("history")}</h2>
          {choice("parity", "parity", [["nulliparous", "nulliparous"], ["parous", "parous"]])}
          {f.parity === "parous" && (
            <>
              {yesNo("prev_pe", "prevPe")}
              <FieldBox label={L("prevGa")} hint="24–44" bad={bad("prevGa")} issue={issues.prev_ga_weeks}>
                <input inputMode="decimal" aria-invalid={inv("prev_ga_weeks")} value={f.prev_ga_weeks} onChange={(e) => set({ prev_ga_weeks: e.target.value })} />
                {unit(L("weeks"))}
              </FieldBox>
              <FieldBox label={L("prevDate")} bad={bad("prevDate")} issue={issues.prev_delivery_date}>
                <input type="date" value={f.prev_delivery_date} onChange={(e) => set({ prev_delivery_date: e.target.value })} />
              </FieldBox>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h2>{L("ultrasound")}</h2>
        <div className="grid">
          {choice("heart", "heart", [["present", "present"], ["absent", "absent"]])}
          <span />
          <FieldBox label={L("crl")} hint="45–84 mm" bad={bad("crl")} issue={issues.crl_mm}>
            <input inputMode="decimal" aria-invalid={inv("crl_mm")} value={f.crl_mm} onChange={(e) => set({ crl_mm: e.target.value })} />
            {unit("mm")}
          </FieldBox>
          <FieldBox label={L("bpd")} hint={f.dating_method === "bpd" ? "16.8–25.7 mm" : "15–28 mm"} bad={bad("bpd")} issue={issues.bpd_mm}>
            <input inputMode="decimal" aria-invalid={inv("bpd_mm")} value={f.bpd_mm} onChange={(e) => set({ bpd_mm: e.target.value })} />
            {unit("mm")}
            {result?.bpd && <span className="mom-chip">{L("median")}: {result.bpd.median_mm.toFixed(1)} mm</span>}
          </FieldBox>
        </div>
        {f.heart === "absent" && <p className="error">{L("heartAbsentNote")}</p>}
      </section>

      <section className="card">
        <h2>{L("biophysical")}</h2>
        <h3 className="sub">{L("map")}</h3>
        <div className="bpgrid" role="group" aria-label={L("map")}>
          {[0, 1].map((m) => (
            <div key={m} className="bpgrid__block">
              <div className="bpgrid__head">
                <span>{L("measurement")} {m + 1}</span>
                <span>{L("sbp")}</span>
                <span>{L("dbp")}</span>
              </div>
              <div className="bpgrid__row">
                <span>{L("right")}</span>
                {bpCell(4 * m, `${L("measurement")} ${m + 1} ${L("right")} SBP`)}
                {bpCell(4 * m + 1, `${L("measurement")} ${m + 1} ${L("right")} DBP`)}
              </div>
              <div className="bpgrid__row">
                <span>{L("left")}</span>
                {bpCell(4 * m + 2, `${L("measurement")} ${m + 1} ${L("left")} SBP`)}
                {bpCell(4 * m + 3, `${L("measurement")} ${m + 1} ${L("left")} DBP`)}
              </div>
            </div>
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].some((i) => issues[`bp${i}`]) && (
          <ul className="bp-msgs">
            {[0, 1, 2, 3, 4, 5, 6, 7].filter((i) => issues[`bp${i}`]).map((i) => (
              <li key={i} className={`field__msg field__msg--${issues[`bp${i}`]!.level}`}>
                {L("measurement")} {Math.floor(i / 4) + 1} · {L(i % 4 < 2 ? "right" : "left")} · {i % 2 === 0 ? L("sbp") : L("dbp")}: {issues[`bp${i}`]!.text}
              </li>
            ))}
          </ul>
        )}
        <div className="grid">
          <FieldBox label="MAP" bad={false} hint="DBP + (SBP − DBP) / 3" issue={issues.map_mmhg}>
            <input
              inputMode="decimal"
              value={readingsEntered ? fmt(mapLive) : f.map_mmhg}
              readOnly={readingsEntered}
              onChange={(e) => set({ map_mmhg: e.target.value })}
            />
            {unit("mmHg")}
            {mom("map")}
          </FieldBox>
          <FieldBox label={L("operator")} bad={false}>
            <input value={f.map_operator} onChange={(e) => set({ map_operator: e.target.value })} />
          </FieldBox>
        </div>

        <details className="fold" open>
          <summary><h3 className="sub">{L("utpi")}</h3></summary>
          <div className="grid">
            <FieldBox label={L("right")} hint="0.1–5.9" bad={false} issue={issues.utpi_right}>
              <input inputMode="decimal" aria-invalid={inv("utpi_right")} value={f.utpi_right} onChange={(e) => set({ utpi_right: e.target.value })} />
            </FieldBox>
            <FieldBox label={L("left")} hint="0.1–5.9" bad={false} issue={issues.utpi_left}>
              <input inputMode="decimal" aria-invalid={inv("utpi_left")} value={f.utpi_left} onChange={(e) => set({ utpi_left: e.target.value })} />
            </FieldBox>
            <FieldBox label={L("meanUtpi")} bad={false}>
              <input value={fmt(utpiLive, 2)} readOnly aria-readonly="true" />
              {mom("utpi")}
            </FieldBox>
            <FieldBox label={L("operator")} bad={false}>
              <input value={f.utpi_operator} onChange={(e) => set({ utpi_operator: e.target.value })} />
            </FieldBox>
          </div>
        </details>

        <details className="fold">
          <summary><h3 className="sub">{L("oa")}</h3></summary>
          <div className="grid">
            <div>
              <p className="muted">{L("oaRight")}</p>
              <FieldBox label="PSV 1" bad={false} issue={issues.oa0}>{oaCell(0, "right PSV 1")}{unit("cm/s")}</FieldBox>
              <FieldBox label="PSV 2" bad={false} issue={issues.oa1}>{oaCell(1, "right PSV 2")}{unit("cm/s")}</FieldBox>
            </div>
            <div>
              <p className="muted">{L("oaLeft")}</p>
              <FieldBox label="PSV 1" bad={false} issue={issues.oa2}>{oaCell(2, "left PSV 1")}{unit("cm/s")}</FieldBox>
              <FieldBox label="PSV 2" bad={false} issue={issues.oa3}>{oaCell(3, "left PSV 2")}{unit("cm/s")}</FieldBox>
            </div>
          </div>
          <FieldBox label={L("oa")} bad={false} hint={L("oaHint")}>
            <input value={fmt(oaLive, 2)} readOnly aria-readonly="true" />
          </FieldBox>
          <p className="hint-line">{L("oaNote")}</p>
        </details>

        <details className="fold" open>
          <summary><h3 className="sub">{L("biochemical")}</h3></summary>
          <div className="grid">
            <FieldBox label={L("sampleDate")} hint={hints.plgf_date && `${L("acceptedRange")} ${hints.plgf_date}`} bad={false} issue={issues.plgf_date}>
              <input type="date" value={f.plgf_date} onChange={(e) => set({ plgf_date: e.target.value })} />
              {result?.plgf_sample_ga_days != null && (
                <span className="unit">
                  {Math.floor(Math.floor(result.plgf_sample_ga_days) / 7)}+{Math.floor(result.plgf_sample_ga_days) % 7} {L("weeks")}
                </span>
              )}
            </FieldBox>
            <span />
            <FieldBox label={L("plgf")} hint="1–1999 pg/mL" bad={false} issue={issues.plgf_pg_ml}>
              <input inputMode="decimal" aria-invalid={inv("plgf_pg_ml")} value={f.plgf_pg_ml} onChange={(e) => set({ plgf_pg_ml: e.target.value })} />
              {unit("pg/mL")}
            </FieldBox>
            <FieldBox label={L("analyser")} bad={false}>
              <select value={f.plgf_analyser} onChange={(e) => set({ plgf_analyser: e.target.value })}>
                {analysers.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </FieldBox>
            <FieldBox label={L("momOptional")} hint="0.05–10" bad={false} issue={issues.plgf_mom}>
              <input inputMode="decimal" aria-invalid={inv("plgf_mom")} value={f.plgf_mom} onChange={(e) => set({ plgf_mom: e.target.value })} />
              {mom("plgf")}
            </FieldBox>
          </div>
        </details>
      </section>
    </div>
  );
}
