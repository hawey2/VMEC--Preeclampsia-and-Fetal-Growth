/**
 * Browser copy of api/pe_api/assessment.py + the request checks in api/pe_api/schemas.py:
 * turns the request the form builds into the same report the server returns.
 * Used only by the standalone website, which has no server.
 */
import type { AssessmentOut, Risk } from "../types";
import {
  COEF, addDays, assess, bpdMedianMm, daysBetween, eddFromGa, expectedLog10Map, expectedLog10Plgf, expectedLog10Utpi,
  formatGa, gaDaysFromBpd, gaDaysFromCrl, gaDaysFromIvf, gaDaysManual, meanArterialPressure, priorTerms, roundHalfEven,
  roundTo, type Analyser, type Biomarkers, type MaternalFactors, type RiskEstimate,
} from "./pe";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Req = any;

export const CUTOFF_ONE_IN = 100;
const CURVE_DAYS = Array.from({ length: 22 }, (_, i) => 77 + i); // 11+0 to 14+0

/** The same limits as the pydantic models, with pydantic-style messages. */
function validate(a: Req): void {
  const errs: string[] = [];
  const range = (path: string, v: unknown, o: { gt?: number; ge?: number; lt?: number; le?: number }) => {
    if (v === null || v === undefined) return;
    if (typeof v !== "number" || Number.isNaN(v)) return void errs.push(`${path}: Input should be a valid number`);
    if (o.gt !== undefined && !(v > o.gt)) errs.push(`${path}: Input should be greater than ${o.gt}`);
    if (o.ge !== undefined && !(v >= o.ge)) errs.push(`${path}: Input should be greater than or equal to ${o.ge}`);
    if (o.lt !== undefined && !(v < o.lt)) errs.push(`${path}: Input should be less than ${o.lt}`);
    if (o.le !== undefined && !(v <= o.le)) errs.push(`${path}: Input should be less than or equal to ${o.le}`);
  };
  const required = (path: string, v: unknown) => {
    if (v === null || v === undefined || v === "") errs.push(`${path}: Field required`);
  };
  required("exam_date", a.exam_date);
  required("date_of_birth", a.date_of_birth);
  required("height_cm", a.height_cm);
  required("weight_kg", a.weight_kg);
  range("height_cm", a.height_cm, { ge: 120, le: 210 });
  range("weight_kg", a.weight_kg, { ge: 30, le: 200 });
  const d = a.dating ?? {};
  range("dating.crl_mm", d.crl_mm, { gt: 0, lt: 120 });
  range("dating.bpd_mm", d.bpd_mm, { gt: 0, lt: 60 });
  range("dating.weeks", d.weeks, { ge: 0, le: 45 });
  range("dating.days", d.days, { ge: 0, le: 6 });
  const need: Record<string, string[]> = {
    crl: ["crl_mm"], bpd: ["bpd_mm"], lmp: ["lmp"], edd: ["edd"], ivf: ["transfer_date", "embryo_age_days"], manual: ["weeks", "days"],
  };
  if (!need[d.method]) errs.push(`dating: Value error, dating by ${String(d.method).toUpperCase()} is not available yet; use CRL or BPD`);
  else {
    const missing = need[d.method].filter((f) => d[f] === null || d[f] === undefined || d[f] === "");
    if (missing.length) errs.push(`dating: Value error, dating by ${d.method} needs: ${missing.join(", ")}`);
  }
  if (a.previous) {
    range("previous.ga_at_delivery_weeks", a.previous.ga_at_delivery_weeks, { ge: 24, le: 44 });
    required("previous.ga_at_delivery_weeks", a.previous.ga_at_delivery_weeks);
    required("previous.delivery_date", a.previous.delivery_date);
  }
  const b = a.biomarkers ?? {};
  range("biomarkers.map_mmhg", b.map_mmhg, { gt: 40, lt: 160 });
  range("biomarkers.map_mom", b.map_mom, { gt: 0 });
  range("biomarkers.utpi_left", b.utpi_left, { gt: 0, lt: 6 });
  range("biomarkers.utpi_right", b.utpi_right, { gt: 0, lt: 6 });
  range("biomarkers.utpi_mom", b.utpi_mom, { gt: 0 });
  range("biomarkers.plgf_pg_ml", b.plgf_pg_ml, { gt: 0, lt: 2000 });
  range("biomarkers.plgf_mom", b.plgf_mom, { gt: 0 });
  for (const k of ["right_psv1", "right_psv2", "left_psv1", "left_psv2"]) range(`biomarkers.oa_psv.${k}`, b.oa_psv?.[k], { gt: 0 });
  if (!errs.length && a.date_of_birth >= a.exam_date) errs.push("Value error, date of birth must be before the examination date");
  if (errs.length) throw new Error(errs.join("; "));
}

function gaDays(a: Req): number {
  const d = a.dating;
  switch (d.method) {
    case "crl": return gaDaysFromCrl(d.crl_mm);
    case "bpd": return gaDaysFromBpd(d.bpd_mm);
    case "lmp": return daysBetween(d.lmp, a.exam_date);
    case "edd": return 280 - daysBetween(a.exam_date, d.edd);
    case "ivf": return gaDaysFromIvf(d.transfer_date, d.embryo_age_days, a.exam_date);
    default: return gaDaysManual(d.weeks, d.days);
  }
}

function oaRatio(a: Req): number | null {
  const o = a.biomarkers?.oa_psv;
  if (!o) return null;
  const ratios = [[o.right_psv1, o.right_psv2], [o.left_psv1, o.left_psv2]].filter(([p1, p2]) => p1 && p2).map(([p1, p2]) => p2 / p1);
  return ratios.length ? ratios.reduce((s, v) => s + v, 0) / ratios.length : null;
}

const risk = (e: RiskEstimate): Risk => ({ cutoff_weeks: e.cutoff_weeks, probability: e.probability, one_in: e.one_in });

/** ISO time in Vietnam (UTC+7), like datetime.now(VN_TZ).isoformat(timespec="seconds"). */
function nowVn(): string {
  const t = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19);
  return `${t}+07:00`;
}

export function compute(a: Req): AssessmentOut {
  validate(a);
  if (a.fetal_heart_activity === false) throw new Error("fetal heart activity is absent: risk assessment does not apply");
  const ga = gaDays(a);

  const warnings: string[] = [];
  let interval: number | null = null;
  let previous: MaternalFactors["previous"] = null;
  if (a.previous) {
    const conception = addDays(a.exam_date, -(roundHalfEven(ga) - 14));
    interval = daysBetween(a.previous.delivery_date, conception) / 365.25;
    if (interval <= 0) throw new Error("previous delivery date must be before this conception");
    previous = { had_pe: !!a.previous.had_pe, ga_at_delivery_weeks: a.previous.ga_at_delivery_weeks, interval_years: interval };
  }
  if (a.vanishing_twin) warnings.push("Vanishing twin recorded: the model does not adjust for it; PlGF may be affected.");

  const mf: MaternalFactors = {
    age_years: daysBetween(a.date_of_birth, a.exam_date) / 365.25,
    weight_kg: a.weight_kg,
    height_cm: a.height_cm,
    ethnicity: a.ethnicity,
    smoker: !!a.smoker,
    conception: a.conception ?? "spontaneous",
    chronic_hypertension: !!a.chronic_hypertension,
    diabetes: a.diabetes ?? "none",
    sle_or_aps: !!a.sle_or_aps,
    family_history_pe: !!a.family_history_pe,
    previous,
  };

  const b = a.biomarkers ?? {};
  let mapMmhg: number | null = b.map_mmhg ?? null;
  if (b.map_readings?.length) mapMmhg = meanArterialPressure(b.map_readings);
  const utpiMean = b.utpi_left && b.utpi_right ? (b.utpi_left + b.utpi_right) / 2 : null;

  let plgfGa: number | null = null;
  if (b.plgf_sample_date && (b.plgf_pg_ml != null || b.plgf_mom != null)) {
    plgfGa = ga - daysBetween(b.plgf_sample_date, a.exam_date);
    if (!(plgfGa >= 77 && plgfGa < 98)) throw new Error("PlGF sample must be taken at 11+0 to 13+6 weeks");
  }

  const oa = oaRatio(a);
  if (oa !== null) warnings.push("Ophthalmic artery PSV ratio is recorded but not used in the risk: no published model is loaded.");

  const run = (markers: Set<string>) => {
    const bm: Biomarkers = {
      map_mmhg: markers.has("map") ? mapMmhg : null,
      map_mom: markers.has("map") ? b.map_mom : null,
      utpi_left: markers.has("utpi") ? b.utpi_left : null,
      utpi_right: markers.has("utpi") ? b.utpi_right : null,
      utpi_mom: markers.has("utpi") ? b.utpi_mom : null,
      plgf_pg_ml: markers.has("plgf") ? b.plgf_pg_ml : null,
      plgf_analyser: b.plgf_analyser ?? null,
      plgf_mom: markers.has("plgf") ? b.plgf_mom : null,
      plgf_ga_days: plgfGa,
    };
    return assess(ga, mf, bm);
  };

  const r = run(new Set(["map", "utpi", "plgf"]));

  const present = ["map", "utpi", "plgf"].filter((m) => m in r.moms);
  const combos: AssessmentOut["combinations"] = [
    { markers: [], risk32: risk(r.maternal_factors_only[0]), risk37: risk(r.maternal_factors_only[1]) },
  ];
  const sets = present.map((m) => [m]);
  if (present.length > 1) sets.push(present);
  for (const s of sets) {
    const sub = r.combined ? run(new Set(s)) : null;
    combos.push({
      markers: s,
      risk32: sub?.combined ? risk(sub.combined[0]) : null,
      risk37: sub?.combined ? risk(sub.combined[1]) : null,
    });
  }

  const basis = r.combined ?? r.maternal_factors_only;
  const preterm = basis.find((e) => e.cutoff_weeks === 37)!;

  const analyser: Analyser = b.plgf_analyser ?? "cobas_e411";
  const expected: Record<string, number> = {
    map: 10 ** expectedLog10Map(ga, mf),
    utpi: 10 ** expectedLog10Utpi(ga, mf),
    plgf: 10 ** expectedLog10Plgf(plgfGa || ga, mf, analyser),
  };
  const curves: Record<string, [number, number][]> = {
    map: CURVE_DAYS.map((d) => [d, roundTo(10 ** expectedLog10Map(d, mf), 4)]),
    utpi: CURVE_DAYS.map((d) => [d, roundTo(10 ** expectedLog10Utpi(d, mf), 4)]),
    plgf: CURVE_DAYS.map((d) => [d, roundTo(10 ** expectedLog10Plgf(d, mf, analyser), 4)]),
  };

  const bpdMm = a.dating.bpd_mm;
  const bpd =
    bpdMm != null && bpdMm >= 15 && bpdMm <= 28
      ? { measured_mm: bpdMm, median_mm: roundTo(bpdMedianMm(ga), 2), ga_days_from_bpd: roundTo(gaDaysFromBpd(bpdMm), 1) }
      : null;

  const round3 = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, roundTo(v, 3)]));

  return {
    patient: { name: a.patient?.name ?? "", pid: a.patient?.pid ?? "" },
    exam_date: a.exam_date,
    ga_days: ga,
    ga_label: formatGa(ga),
    edd: eddFromGa(ga, a.exam_date),
    dating_method: a.dating.method,
    age_years: roundTo(mf.age_years, 1),
    interval_years: interval !== null ? roundTo(interval, 2) : null,
    map_mmhg: mapMmhg !== null ? roundTo(mapMmhg, 1) : null,
    utpi_mean: utpiMean !== null ? roundTo(utpiMean, 2) : null,
    plgf_pg_ml: b.plgf_pg_ml ?? null,
    plgf_analyser: b.plgf_pg_ml != null ? (b.plgf_analyser ?? null) : null,
    moms: round3(r.moms),
    maternal_factors_only: r.maternal_factors_only.map(risk),
    combined: r.combined ? r.combined.map(risk) : null,
    markers_used: r.markers_used,
    screen: {
      basis: r.combined ? "combined" : "maternal_factors_only",
      cutoff_one_in: CUTOFF_ONE_IN,
      high_risk: preterm.probability >= 1 / CUTOFF_ONE_IN,
    },
    model_label: r.model_label,
    model_checksum: r.model_checksum,
    warnings: [...warnings, ...r.warnings],
    generated_at: nowVn(),
    prior_terms: priorTerms(mf).map(([name, v]) => ({ name, weeks: roundTo(v, 4) })),
    prior_mean_weeks: roundTo(r.prior_mean_weeks, 3),
    prior_sd_weeks: r.prior_sd_weeks,
    expected_medians: round3(expected),
    curves,
    plgf_sample_ga_days: plgfGa,
    bpd,
    oa_psv_ratio: oa !== null ? roundTo(oa, 3) : null,
    map_operator: b.map_operator ?? "",
    utpi_operator: b.utpi_operator ?? "",
    combinations: combos,
  };
}

export { COEF };
