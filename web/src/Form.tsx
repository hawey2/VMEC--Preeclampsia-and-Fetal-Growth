import type { ReactNode } from "react";
import { analysers, conceptions, datingMethods, diabetesTypes, ethnicities, t, type Key, type Lang } from "./i18n";
import type { FormState } from "./types";

function FieldBox({ label, bad, hint, children }: { label: string; bad: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className={`field${bad ? " field--bad" : ""}`}>
      <span className="field__label">
        {label}
        {hint && <span className="field__hint"> · {hint}</span>}
      </span>
      <span className="field__control">{children}</span>
    </label>
  );
}

type Props = {
  lang: Lang;
  f: FormState;
  set: (patch: Partial<FormState>) => void;
  missing: string[];
};

export function AssessmentForm({ lang, f, set, missing }: Props) {
  const L = (k: Key) => t(lang, k);
  const bad = (k: string) => missing.includes(k);

  const unit = (u: string) => <span className="unit">{u}</span>;

  const yesNo = (name: keyof FormState, k: Key) => (
    <div className={`field${bad(k) ? " field--bad" : ""}`} role="radiogroup" aria-label={L(k)}>
      <span className="field__label">{L(k)}</span>
      <span className="field__control seg">
        {(["yes", "no"] as const).map((v) => (
          <button
            type="button"
            key={v}
            className={f[name] === v ? "seg__on" : ""}
            aria-pressed={f[name] === v}
            onClick={() => set({ [name]: v } as Partial<FormState>)}
          >
            {L(v)}
          </button>
        ))}
      </span>
    </div>
  );

  const check = (name: "chronic_hypertension" | "sle_or_aps" | "family_history_pe", k: Key) => (
    <label className="check">
      <input type="checkbox" checked={f[name]} onChange={(e) => set({ [name]: e.target.checked })} />
      <span>{L(k)}</span>
    </label>
  );

  const mode = <M extends string>(value: M, options: [M, Key][], onPick: (m: M) => void) => (
    <span className="seg seg--small">
      {options.map(([m, k]) => (
        <button type="button" key={m} className={value === m ? "seg__on" : ""} aria-pressed={value === m} onClick={() => onPick(m)}>
          {L(k)}
        </button>
      ))}
    </span>
  );

  return (
    <div className="form">
      <section className="card">
        <h2>{L("patient")}</h2>
        <div className="grid">
          <FieldBox label={L("name")} bad={bad("name")}>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="off" />
          </FieldBox>
          <FieldBox label={L("pid")} bad={bad("pid")}>
            <input value={f.pid} onChange={(e) => set({ pid: e.target.value })} autoComplete="off" />
          </FieldBox>
        </div>
      </section>

      <div className="two">
        <section className="card">
          <h2>{L("maternal")}</h2>
          <FieldBox label={L("dob")} bad={bad("dob")}>
            <input type="date" value={f.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
          </FieldBox>
          <FieldBox label={L("height")} bad={bad("height")}>
            <input inputMode="decimal" value={f.height_cm} onChange={(e) => set({ height_cm: e.target.value })} />
            {unit("cm")}
          </FieldBox>
          <FieldBox label={L("weight")} bad={bad("weight")}>
            <input inputMode="decimal" value={f.weight_kg} onChange={(e) => set({ weight_kg: e.target.value })} />
            {unit("kg")}
          </FieldBox>
          <FieldBox label={L("ethnicity")} bad={bad("ethnicity")}>
            <select value={f.ethnicity} onChange={(e) => set({ ethnicity: e.target.value })}>
              <option value="" />
              {ethnicities.map(([v, vi, en]) => (
                <option key={v} value={v}>{lang === "vi" ? vi : en}</option>
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
              {datingMethods.map(([v, vi, en, ok]) => (
                <option key={v} value={v} disabled={!ok}>{lang === "vi" ? vi : en}</option>
              ))}
            </select>
          </FieldBox>
          {f.dating_method === "crl" && (
            <FieldBox label={L("crl")} bad={bad("crl")} hint="45–84 mm">
              <input inputMode="decimal" value={f.crl_mm} onChange={(e) => set({ crl_mm: e.target.value })} />
              {unit("mm")}
            </FieldBox>
          )}
          {f.dating_method === "lmp" && (
            <FieldBox label={L("lmp")} bad={bad("lmp")}><input type="date" value={f.lmp} onChange={(e) => set({ lmp: e.target.value })} /></FieldBox>
          )}
          {f.dating_method === "edd" && (
            <FieldBox label={L("edd")} bad={bad("edd")}><input type="date" value={f.edd} onChange={(e) => set({ edd: e.target.value })} /></FieldBox>
          )}
          {f.dating_method === "ivf" && (
            <>
              <FieldBox label={L("transfer")} bad={bad("transfer")}>
                <input type="date" value={f.transfer_date} onChange={(e) => set({ transfer_date: e.target.value })} />
              </FieldBox>
              <FieldBox label={L("embryoAge")} bad={bad("embryoAge")}>
                <select value={f.embryo_age_days} onChange={(e) => set({ embryo_age_days: e.target.value })}>
                  <option value="3">3 {L("days")}</option>
                  <option value="5">5 {L("days")}</option>
                  <option value="6">6 {L("days")}</option>
                </select>
              </FieldBox>
            </>
          )}
          {f.dating_method === "manual" && (
            <FieldBox label={L("gaManual")} bad={bad("gaManual")}>
              <input className="short" inputMode="numeric" value={f.weeks} onChange={(e) => set({ weeks: e.target.value })} />
              {unit(L("weeks"))}
              <input className="short" inputMode="numeric" value={f.days} onChange={(e) => set({ days: e.target.value })} />
              {unit(L("days"))}
            </FieldBox>
          )}
          {yesNo("vanishing_twin", "vanishingTwin")}
          <FieldBox label={L("conception")} bad={bad("conception")}>
            <select value={f.conception} onChange={(e) => set({ conception: e.target.value })}>
              {conceptions.map(([v, vi, en]) => (
                <option key={v} value={v}>{lang === "vi" ? vi : en}</option>
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
          <h2>{L("history")}</h2>
          <FieldBox label={L("parity")} bad={bad("parity")}>
            <select value={f.parity} onChange={(e) => set({ parity: e.target.value as FormState["parity"] })}>
              <option value="" />
              <option value="nulliparous">{L("nulliparous")}</option>
              <option value="parous">{L("parous")}</option>
            </select>
          </FieldBox>
          {f.parity === "parous" && (
            <>
              {yesNo("prev_pe", "prevPe")}
              <FieldBox label={L("prevGa")} bad={bad("prevGa")} hint="24–44">
                <input inputMode="decimal" value={f.prev_ga_weeks} onChange={(e) => set({ prev_ga_weeks: e.target.value })} />
                {unit(L("weeks"))}
              </FieldBox>
              <FieldBox label={L("prevDate")} bad={bad("prevDate")}>
                <input type="date" value={f.prev_delivery_date} onChange={(e) => set({ prev_delivery_date: e.target.value })} />
              </FieldBox>
            </>
          )}
        </section>

        <section className="card">
          <h2>{L("medical")}</h2>
          {check("chronic_hypertension", "chronicHtn")}
          {check("sle_or_aps", "sle")}
          {check("family_history_pe", "famPe")}
          <FieldBox label={L("diabetes")} bad={bad("diabetes")}>
            <select value={f.diabetes} onChange={(e) => set({ diabetes: e.target.value })}>
              {diabetesTypes.map(([v, vi, en]) => (
                <option key={v} value={v}>{lang === "vi" ? vi : en}</option>
              ))}
            </select>
          </FieldBox>
        </section>
      </div>

      <section className="card">
        <h2>
          {L("biomarkers")} <span className="muted">({L("optional")})</span>
        </h2>
        <div className="marker">
          <div className="marker__head">
            <h3>{L("map")}</h3>
            {mode(f.map_mode, [["readings", "mapReadings"], ["value", "mapValue"], ["mom", "momValue"]], (m) => set({ map_mode: m }))}
          </div>
          {f.map_mode === "readings" && (
            <div className="bp">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bp__row">
                  <span className="muted">{i < 2 ? L("rightArm") : L("leftArm")} {(i % 2) + 1}</span>
                  <input
                    aria-label={`systolic ${i + 1}`}
                    inputMode="numeric"
                    value={f.bp[2 * i]}
                    onChange={(e) => set({ bp: f.bp.map((v, j) => (j === 2 * i ? e.target.value : v)) })}
                  />
                  <span>/</span>
                  <input
                    aria-label={`diastolic ${i + 1}`}
                    inputMode="numeric"
                    value={f.bp[2 * i + 1]}
                    onChange={(e) => set({ bp: f.bp.map((v, j) => (j === 2 * i + 1 ? e.target.value : v)) })}
                  />
                  {unit("mmHg")}
                </div>
              ))}
            </div>
          )}
          {f.map_mode === "value" && (
            <div className="inline">
              <input inputMode="decimal" value={f.map_mmhg} onChange={(e) => set({ map_mmhg: e.target.value })} />
              {unit("mmHg")}
            </div>
          )}
          {f.map_mode === "mom" && (
            <div className="inline">
              <input inputMode="decimal" value={f.map_mom} onChange={(e) => set({ map_mom: e.target.value })} />
              {unit("MoM")}
            </div>
          )}
        </div>

        <div className="marker">
          <div className="marker__head">
            <h3>{L("utpi")}</h3>
            {mode(f.utpi_mode, [["raw", "raw"], ["mom", "momValue"]], (m) => set({ utpi_mode: m }))}
          </div>
          {f.utpi_mode === "raw" ? (
            <div className="inline">
              <span className="muted">{L("left")}</span>
              <input inputMode="decimal" value={f.utpi_left} onChange={(e) => set({ utpi_left: e.target.value })} />
              <span className="muted">{L("right")}</span>
              <input inputMode="decimal" value={f.utpi_right} onChange={(e) => set({ utpi_right: e.target.value })} />
            </div>
          ) : (
            <div className="inline">
              <input inputMode="decimal" value={f.utpi_mom} onChange={(e) => set({ utpi_mom: e.target.value })} />
              {unit("MoM")}
            </div>
          )}
        </div>

        <div className="marker">
          <div className="marker__head">
            <h3>{L("plgf")}</h3>
            {mode(f.plgf_mode, [["raw", "raw"], ["mom", "momValue"]], (m) => set({ plgf_mode: m }))}
          </div>
          {f.plgf_mode === "raw" ? (
            <div className="inline">
              <input inputMode="decimal" value={f.plgf_pg_ml} onChange={(e) => set({ plgf_pg_ml: e.target.value })} />
              {unit("pg/mL")}
              <select aria-label={L("analyser")} value={f.plgf_analyser} onChange={(e) => set({ plgf_analyser: e.target.value })}>
                {analysers.map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="inline">
              <input inputMode="decimal" value={f.plgf_mom} onChange={(e) => set({ plgf_mom: e.target.value })} />
              {unit("MoM")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
