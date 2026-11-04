import type { AssessmentOut, FormState } from "./types";

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** Turn form strings into the API request. Throws a list of missing labels. */
export function buildRequest(f: FormState): unknown {
  const missing: string[] = [];
  const need = (v: string, label: string) => {
    if (v.trim() === "") missing.push(label);
  };
  need(f.exam_date, "examDate");
  need(f.date_of_birth, "dob");
  need(f.height_cm, "height");
  need(f.weight_kg, "weight");
  need(f.ethnicity, "ethnicity");
  need(f.smoker, "smoker");
  need(f.dating_method, "datingMethod");
  need(f.parity, "parity");
  if (f.parity === "parous") {
    need(f.prev_pe, "prevPe");
    need(f.prev_ga_weeks, "prevGa");
    need(f.prev_delivery_date, "prevDate");
  }
  if (missing.length) throw missing;

  const dating: Record<string, unknown> = { method: f.dating_method };
  if (f.dating_method === "crl") dating.crl_mm = num(f.crl_mm);
  if (f.dating_method === "lmp") dating.lmp = f.lmp || null;
  if (f.dating_method === "edd") dating.edd = f.edd || null;
  if (f.dating_method === "ivf") {
    dating.transfer_date = f.transfer_date || null;
    dating.embryo_age_days = num(f.embryo_age_days);
  }
  if (f.dating_method === "manual") {
    dating.weeks = num(f.weeks);
    dating.days = num(f.days);
  }

  const bm: Record<string, unknown> = {};
  if (f.map_mode === "readings") {
    const pairs: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      const s = num(f.bp[2 * i]);
      const d = num(f.bp[2 * i + 1]);
      if (s !== null && d !== null) pairs.push([s, d]);
    }
    if (pairs.length) bm.map_readings = pairs;
  } else if (f.map_mode === "value") bm.map_mmhg = num(f.map_mmhg);
  else bm.map_mom = num(f.map_mom);

  if (f.utpi_mode === "raw") {
    bm.utpi_left = num(f.utpi_left);
    bm.utpi_right = num(f.utpi_right);
  } else bm.utpi_mom = num(f.utpi_mom);

  if (f.plgf_mode === "raw") {
    bm.plgf_pg_ml = num(f.plgf_pg_ml);
    if (f.plgf_pg_ml) bm.plgf_analyser = f.plgf_analyser;
  } else bm.plgf_mom = num(f.plgf_mom);

  return {
    patient: { name: f.name, pid: f.pid },
    exam_date: f.exam_date,
    date_of_birth: f.date_of_birth,
    height_cm: num(f.height_cm),
    weight_kg: num(f.weight_kg),
    ethnicity: f.ethnicity,
    smoker: f.smoker === "yes",
    dating,
    conception: f.conception,
    vanishing_twin: f.vanishing_twin === "yes",
    chronic_hypertension: f.chronic_hypertension,
    diabetes: f.diabetes,
    sle_or_aps: f.sle_or_aps,
    family_history_pe: f.family_history_pe,
    previous:
      f.parity === "parous"
        ? { had_pe: f.prev_pe === "yes", ga_at_delivery_weeks: num(f.prev_ga_weeks), delivery_date: f.prev_delivery_date }
        : null,
    biomarkers: bm,
  };
}

export async function assess(body: unknown): Promise<AssessmentOut> {
  const res = await fetch("/api/assess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data?.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { loc?: string[]; msg: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}`).join("; ")
      : String(detail ?? res.statusText);
    throw new Error(msg);
  }
  return data as AssessmentOut;
}
