/**
 * Checks every field as it is typed, so a wrong value turns its box red at once with the values
 * that would be accepted, instead of the result silently disappearing.
 *
 * The limits are the ones the engine and the API enforce (schemas.py, dating.py, risk.py), so a
 * form with no errors here is always accepted. Warnings (amber) flag unusual but allowed values.
 */
import { t, type Key, type Lang } from "./i18n";
import type { FormState } from "./types";

export type Issue = { level: "error" | "warn"; text: string };
export type Issues = Partial<Record<string, Issue>>;

/** Accepts a decimal comma as well as a point ("2,5" = 2.5). "" = not entered, NaN = not a number. */
export function parseNum(s: string): number | null {
  const v = s.trim().replace(",", ".");
  if (v === "") return null;
  return /^[-+]?\d*\.?\d+$/.test(v) ? Number(v) : NaN;
}

const DAY = 86_400_000;
const toTime = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
};
const days = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);
const shift = (s: string, n: number) => new Date(toTime(s) + n * DAY).toISOString().slice(0, 10);
export const dmy = (s: string) => s.split("-").reverse().join("/");

/** Screening window: 11+0 (day 77) to 13+6 (any time on day 97). */
const GA_MIN = 77;
const GA_END = 98;

/** Gestational age (days) from the dating fields, or null when it cannot be worked out yet. */
export function formGaDays(f: FormState): number | null {
  const exam = f.exam_date;
  if (Number.isNaN(toTime(exam))) return null;
  switch (f.dating_method) {
    case "crl": {
      const c = parseNum(f.crl_mm);
      return c != null && c >= 45 && c <= 84 ? 8.052 * Math.sqrt(c) + 23.73 : null;
    }
    case "bpd": {
      const b = parseNum(f.bpd_mm);
      return b != null && b >= 15 && b <= 28 ? (b + 16.33798) / 0.4299 : null;
    }
    case "lmp":
      return f.lmp ? days(f.lmp, exam) : null;
    case "edd":
      return f.edd ? 280 - days(exam, f.edd) : null;
    case "ivf":
      return f.transfer_date ? days(f.transfer_date, exam) + Number(f.embryo_age_days) + 14 : null;
    case "manual": {
      const w = parseNum(f.weeks);
      const d = parseNum(f.days || "0");
      return w != null && d != null && !Number.isNaN(w) && !Number.isNaN(d) ? w * 7 + d : null;
    }
    default:
      return null;
  }
}

export function validateForm(f: FormState, lang: Lang): Issues {
  const L = (k: Key) => t(lang, k);
  const fill = (k: Key, v: Record<string, string | number>) =>
    Object.entries(v).reduce((s, [a, b]) => s.replace(`{${a}}`, String(b)), L(k));
  const out: Issues = {};
  const err = (field: string, text: string) => {
    if (out[field]?.level !== "error") out[field] = { level: "error", text }; // an error replaces a warning
  };
  const warn = (field: string, text: string) => (out[field] ??= { level: "warn", text });

  /** A number field: error outside [min, max], warning outside the usual range. */
  const number = (field: string, raw: string, min: number, max: number, unit: string, usual?: [number, number]) => {
    const v = parseNum(raw);
    if (v === null) return null;
    if (Number.isNaN(v)) return void err(field, L("vNotNumber"));
    if (v < min || v > max) return void err(field, fill("vRange", { min, max, unit }));
    if (usual && (v < usual[0] || v > usual[1])) warn(field, fill("vUnusual", { min: usual[0], max: usual[1], unit }));
    return v;
  };
  const dateRange = (field: string, value: string, from: string, to: string, why: Key) => {
    if (!value || Number.isNaN(toTime(from)) || Number.isNaN(toTime(to))) return;
    if (value < from || value > to) err(field, fill("vDateRange", { from: dmy(from), to: dmy(to), why: L(why) }));
  };

  const exam = f.exam_date;
  const examOk = !Number.isNaN(toTime(exam));

  // Mother
  if (f.date_of_birth && examOk) {
    dateRange("date_of_birth", f.date_of_birth, shift(exam, -Math.ceil(60 * 365.25)), shift(exam, -Math.floor(12 * 365.25)), "whyAge");
  }
  number("height_cm", f.height_cm, 120, 210, "cm", [140, 185]);
  number("weight_kg", f.weight_kg, 30, 200, "kg", [38, 120]);

  // Dating: each method has the range that gives 11+0 to 13+6 weeks.
  number("crl_mm", f.crl_mm, 45, 84, "mm");
  if (f.bpd_mm.trim()) {
    if (f.dating_method === "bpd") {
      // BPD dating must give a GA inside the window: 0.4299 × GA − 16.338.
      number("bpd_mm", f.bpd_mm, 16.8, 25.7, "mm");
    } else {
      number("bpd_mm", f.bpd_mm, 15, 28, "mm");
    }
  }
  if (examOk) {
    if (f.dating_method === "lmp") dateRange("lmp", f.lmp, shift(exam, -(GA_END - 1)), shift(exam, -GA_MIN), "whyGa");
    if (f.dating_method === "edd") dateRange("edd", f.edd, shift(exam, 280 - (GA_END - 1)), shift(exam, 280 - GA_MIN), "whyGa");
    if (f.dating_method === "ivf") {
      const age = Number(f.embryo_age_days);
      dateRange("transfer_date", f.transfer_date, shift(exam, -(GA_END - 1 - age - 14)), shift(exam, -(GA_MIN - age - 14)), "whyGa");
    }
  }
  if (f.dating_method === "manual") {
    number("weeks", f.weeks, 11, 13, L("weeks"));
    number("days", f.days, 0, 6, L("days"));
  }

  // Previous pregnancy
  if (f.parity === "parous") {
    number("prev_ga_weeks", f.prev_ga_weeks, 24, 44, L("weeks"));
    const ga = formGaDays(f);
    if (f.prev_delivery_date && examOk && ga != null) {
      const conception = shift(exam, -(Math.round(ga) - 14));
      if (f.prev_delivery_date >= conception) {
        err("prev_delivery_date", fill("vBefore", { to: dmy(shift(conception, -1)), why: L("whyConception") }));
      }
      if (f.date_of_birth && f.prev_delivery_date <= f.date_of_birth) err("prev_delivery_date", L("vAfterBirth"));
    }
  }

  // Blood pressure: each reading is a pair; systolic above diastolic.
  for (let i = 0; i < 4; i++) {
    const [si, di] = [2 * i, 2 * i + 1];
    const s = number(`bp${si}`, f.bp[si], 60, 250, "mmHg", [80, 180]);
    const d = number(`bp${di}`, f.bp[di], 30, 150, "mmHg", [40, 115]);
    const sIn = f.bp[si].trim() !== "";
    const dIn = f.bp[di].trim() !== "";
    if (sIn !== dIn) err(sIn ? `bp${di}` : `bp${si}`, L("vPair"));
    if (s != null && d != null && !Number.isNaN(s) && !Number.isNaN(d) && s <= d) err(`bp${si}`, L("vSbpDbp"));
  }
  if (!f.bp.some((v) => v.trim())) number("map_mmhg", f.map_mmhg, 41, 159, "mmHg", [60, 120]);

  // Uterine artery PI: both sides, 0 < PI < 6.
  number("utpi_right", f.utpi_right, 0.1, 5.9, "", [0.4, 4]);
  number("utpi_left", f.utpi_left, 0.1, 5.9, "", [0.4, 4]);
  if (f.utpi_right.trim() && !f.utpi_left.trim()) err("utpi_left", L("vBothSides"));
  if (f.utpi_left.trim() && !f.utpi_right.trim()) err("utpi_right", L("vBothSides"));

  // Ophthalmic artery PSVs
  f.oa.forEach((v, i) => number(`oa${i}`, v, 1, 200, "cm/s", [5, 100]));

  // PlGF
  number("plgf_pg_ml", f.plgf_pg_ml, 1, 1999, "pg/mL", [5, 500]);
  number("plgf_mom", f.plgf_mom, 0.05, 10, "MoM", [0.2, 4]);
  const ga = formGaDays(f);
  if (f.plgf_date && examOk && ga != null && ga >= GA_MIN && ga < GA_END) {
    // The blood must be taken at 11+0 to 13+6 weeks: GA on that day = GA today − days since the sample.
    dateRange("plgf_date", f.plgf_date, shift(exam, -Math.floor(ga - GA_MIN)), shift(exam, Math.ceil(GA_END - ga) - 1), "whySample");
  }
  if (f.plgf_date && !f.plgf_pg_ml.trim() && !f.plgf_mom.trim()) warn("plgf_pg_ml", L("vPlgfMissing"));

  // The dating gives a GA outside the window (e.g. a manual 13+7).
  if (ga != null && (ga < GA_MIN || ga >= GA_END)) {
    const field = { crl: "crl_mm", bpd: "bpd_mm", lmp: "lmp", edd: "edd", ivf: "transfer_date", manual: "weeks" }[f.dating_method];
    if (field) err(field, fill("vGaWindow", { ga: `${Math.floor(ga / 7)}+${Math.floor(ga) % 7}` }));
  }
  return out;
}

/** Accepted date ranges for the date fields that depend on the exam date and GA, shown next to them. */
export function dateHints(f: FormState): Record<string, string> {
  const exam = f.exam_date;
  if (Number.isNaN(toTime(exam))) return {};
  const r = (a: number, b: number) => `${dmy(shift(exam, a))} – ${dmy(shift(exam, b))}`;
  const age = Number(f.embryo_age_days);
  const out: Record<string, string> = {
    lmp: r(-(GA_END - 1), -GA_MIN),
    edd: r(280 - (GA_END - 1), 280 - GA_MIN),
    transfer_date: r(-(GA_END - 1 - age - 14), -(GA_MIN - age - 14)),
  };
  const ga = formGaDays(f);
  if (ga != null && ga >= GA_MIN && ga < GA_END) out.plgf_date = r(-Math.floor(ga - GA_MIN), Math.ceil(GA_END - ga) - 1);
  return out;
}

/** Errors only (warnings do not block the calculation). */
export const hasErrors = (issues: Issues) => Object.values(issues).some((i) => i?.level === "error");
