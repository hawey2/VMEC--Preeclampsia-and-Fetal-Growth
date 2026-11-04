import type { AssessmentOut, AuditRow, FormState, OutcomeData, ScreeningFull, ScreeningSummary, User, UserRow } from "./types";

import { parseNum } from "./validate";

/** A number from a form field ("2,5" works too); empty or not a number = null (the field shows the error). */
const num = (s: string) => {
  const v = parseNum(s);
  return v === null || Number.isNaN(v) ? null : v;
};

/** (systolic, diastolic) pairs that are complete. */
export function bpPairs(f: FormState): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < 4; i++) {
    const s = num(f.bp[2 * i]);
    const d = num(f.bp[2 * i + 1]);
    if (s !== null && d !== null && s > 0 && d > 0) pairs.push([s, d]);
  }
  return pairs;
}

/** MAP = DBP + (SBP - DBP) / 3, averaged over the readings (FMF protocol). */
export function liveMap(f: FormState): number | null {
  const p = bpPairs(f);
  if (!p.length) return num(f.map_mmhg);
  return p.reduce((acc, [s, d]) => acc + d + (s - d) / 3, 0) / p.length;
}

export function liveUtpi(f: FormState): number | null {
  const r = num(f.utpi_right);
  const l = num(f.utpi_left);
  return r !== null && l !== null ? (r + l) / 2 : null;
}

/** Ophthalmic artery: PSV2 / PSV1 per eye, then the mean of the eyes. */
export function liveOa(f: FormState): number | null {
  const [r1, r2, l1, l2] = f.oa.map(num);
  const ratios = [
    r1 && r2 ? r2 / r1 : null,
    l1 && l2 ? l2 / l1 : null,
  ].filter((x): x is number => x !== null);
  return ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
}

/** Turn form strings into the API request. Throws a list of missing field keys. */
export function buildRequest(f: FormState): unknown {
  const missing: string[] = [];
  const need = (v: string, key: string) => {
    if (v.trim() === "") missing.push(key);
  };
  need(f.exam_date, "examDate");
  need(f.date_of_birth, "dob");
  need(f.height_cm, "height");
  need(f.weight_kg, "weight");
  need(f.ethnicity, "ethnicity");
  need(f.smoker, "smoker");
  need(f.dating_method, "datingMethod");
  need(f.heart, "heart");
  if (f.dating_method === "crl") need(f.crl_mm, "crl");
  if (f.dating_method === "bpd") need(f.bpd_mm, "bpd");
  need(f.htn, "chronicHtn");
  need(f.dm1, "dm1");
  need(f.dm2, "dm2");
  if (f.dm2 === "yes") need(f.dm2_insulin, "dm2Insulin");
  need(f.fam_pe, "famPe");
  need(f.sle, "sleOnly");
  need(f.aps, "apsOnly");
  need(f.parity, "parity");
  if (f.parity === "parous") {
    need(f.prev_pe, "prevPe");
    need(f.prev_ga_weeks, "prevGa");
    need(f.prev_delivery_date, "prevDate");
  }
  if (missing.length) throw missing;

  const dating: Record<string, unknown> = { method: f.dating_method, crl_mm: num(f.crl_mm), bpd_mm: num(f.bpd_mm) };
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

  const diabetes =
    f.dm1 === "yes" ? "type1" : f.dm2 === "yes" ? (f.dm2_insulin === "yes" ? "type2_insulin" : "type2_no_insulin") : "none";

  const pairs = bpPairs(f);
  const [r1, r2, l1, l2] = f.oa.map(num);
  const bm: Record<string, unknown> = {
    map_readings: pairs.length ? pairs : null,
    map_mmhg: pairs.length ? null : num(f.map_mmhg),
    map_operator: f.map_operator,
    utpi_right: num(f.utpi_right),
    utpi_left: num(f.utpi_left),
    utpi_operator: f.utpi_operator,
    oa_psv: r1 || r2 || l1 || l2 ? { right_psv1: r1, right_psv2: r2, left_psv1: l1, left_psv2: l2 } : null,
  };
  if (num(f.plgf_mom) !== null) bm.plgf_mom = num(f.plgf_mom);
  else if (num(f.plgf_pg_ml) !== null) {
    bm.plgf_pg_ml = num(f.plgf_pg_ml);
    bm.plgf_analyser = f.plgf_analyser;
  }
  if (f.plgf_date && (bm.plgf_mom || bm.plgf_pg_ml)) bm.plgf_sample_date = f.plgf_date;

  return {
    patient: { name: f.name, pid: f.pid },
    exam_date: f.exam_date,
    date_of_birth: f.date_of_birth,
    height_cm: num(f.height_cm),
    weight_kg: num(f.weight_kg),
    ethnicity: f.ethnicity,
    smoker: f.smoker === "yes",
    dating,
    fetal_heart_activity: f.heart === "present",
    conception: f.conception,
    vanishing_twin: f.vanishing_twin === "yes",
    chronic_hypertension: f.htn === "yes",
    diabetes,
    sle_or_aps: f.sle === "yes" || f.aps === "yes",
    family_history_pe: f.fam_pe === "yes",
    previous:
      f.parity === "parous"
        ? { had_pe: f.prev_pe === "yes", ga_at_delivery_weeks: num(f.prev_ga_weeks), delivery_date: f.prev_delivery_date }
        : null,
    biomarkers: bm,
  };
}

/** Fired when the server says the session is missing or expired, so the app shows the sign-in screen. */
export const UNAUTHORIZED = "pe-unauthorized";

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) {
    const detail = data?.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d: { loc?: string[]; msg: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg}`).join("; ")
      : String(detail ?? res.statusText);
    if (res.status === 401 && !url.endsWith("/login")) window.dispatchEvent(new CustomEvent(UNAUTHORIZED, { detail: msg }));
    throw new Error(msg);
  }
  return data as T;
}

/** On the standalone website the browser calculates; nothing is sent anywhere. */
export const assess = (body: unknown): Promise<AssessmentOut> =>
  __STANDALONE__
    ? import("./engine/compute").then((m) => m.compute(body))
    : call<AssessmentOut>("POST", "/api/assess", body);

export const login = (username: string, password: string) => call<User>("POST", "/api/auth/login", { username, password });
export const logout = () => call<{ ok: boolean }>("POST", "/api/auth/logout");
export const me = () => call<User>("GET", "/api/auth/me");

export const saveScreening = (assessment: unknown, form: FormState) =>
  call<ScreeningFull>("POST", "/api/screenings", { assessment, form_state: form });
export const amendScreening = (id: number, assessment: unknown, form: FormState) =>
  call<ScreeningFull>("POST", `/api/screenings/${id}/amend`, { assessment, form_state: form });
export const getHistory = (pid: string) => call<ScreeningSummary[]>("GET", `/api/patients/${encodeURIComponent(pid)}/screenings`);
export const getScreening = (id: number) => call<ScreeningFull>("GET", `/api/screenings/${id}`);
export const signScreening = (id: number) => call<ScreeningSummary>("POST", `/api/screenings/${id}/sign`);
export const markPrinted = (id: number, lang: string) => call<{ ok: boolean }>("POST", `/api/screenings/${id}/printed?lang=${lang}`);
export const putOutcome = (id: number, o: OutcomeData) => call<ScreeningSummary>("PUT", `/api/screenings/${id}/outcome`, o);
export const getAudit = (username: string, action: string) =>
  call<AuditRow[]>("GET", `/api/audit?username=${encodeURIComponent(username)}&action=${encodeURIComponent(action)}`);
export const getUsers = () => call<UserRow[]>("GET", "/api/users");
export const authMode = () => call<{ auth_mode: string }>("GET", "/api/auth/config");
export const changePassword = (current: string, next: string) => call<User>("POST", "/api/auth/password", { current, new: next });
export const createUser = (u: { username: string; display_name: string; role: string; password: string }) =>
  call<UserRow>("POST", "/api/users", u);
export const updateUser = (username: string, patch: { display_name?: string; role?: string; active?: boolean; password?: string }) =>
  call<UserRow>("PATCH", `/api/users/${encodeURIComponent(username)}`, patch);
