export type Risk = { cutoff_weeks: number; probability: number; one_in: number };

export type AssessmentOut = {
  patient: { name: string; pid: string };
  exam_date: string;
  ga_days: number;
  ga_label: string;
  edd: string;
  dating_method: string;
  age_years: number;
  interval_years: number | null;
  map_mmhg: number | null;
  utpi_mean: number | null;
  plgf_pg_ml: number | null;
  plgf_analyser: string | null;
  moms: Record<string, number>;
  maternal_factors_only: Risk[];
  combined: Risk[] | null;
  markers_used: string[];
  screen: { basis: "combined" | "maternal_factors_only"; cutoff_one_in: number; high_risk: boolean };
  model_label: string;
  model_checksum: string;
  warnings: string[];
  generated_at: string;
  prior_terms: { name: string; weeks: number }[];
  prior_mean_weeks: number;
  prior_sd_weeks: number;
  expected_medians: Record<string, number>;
  curves: Record<string, [number, number][]>;
  plgf_sample_ga_days: number | null;
  bpd: { measured_mm: number; median_mm: number; ga_days_from_bpd: number } | null;
  oa_psv_ratio: number | null;
  map_operator: string;
  utpi_operator: string;
  combinations: { markers: string[]; risk37: Risk | null; risk32: Risk | null }[];
};

/** Everything the form holds, as strings straight from the inputs. */
export type YN = "" | "yes" | "no";
export type FormState = {
  name: string;
  pid: string;
  exam_date: string;
  date_of_birth: string;
  height_cm: string;
  weight_kg: string;
  ethnicity: string;
  smoker: YN;
  dating_method: string;
  lmp: string;
  edd: string;
  transfer_date: string;
  embryo_age_days: string;
  weeks: string;
  days: string;
  vanishing_twin: YN;
  conception: string;
  htn: YN;
  dm1: YN;
  dm2: YN;
  dm2_insulin: YN;
  fam_pe: YN;
  sle: YN;
  aps: YN;
  parity: "" | "nulliparous" | "parous";
  prev_pe: YN;
  prev_ga_weeks: string;
  prev_delivery_date: string;
  heart: "" | "present" | "absent";
  crl_mm: string;
  bpd_mm: string;
  bp: string[]; // 8 values: [M1 right sys, dia, M1 left sys, dia, M2 right sys, dia, M2 left sys, dia]
  map_mmhg: string;
  map_operator: string;
  utpi_right: string;
  utpi_left: string;
  utpi_operator: string;
  oa: string[]; // [right psv1, right psv2, left psv1, left psv2]
  plgf_date: string;
  plgf_pg_ml: string;
  plgf_analyser: string;
  plgf_mom: string;
};

export type Role = "sonographer" | "doctor" | "admin";
export type User = { username: string; display_name: string; role: Role };

export type OutcomeData = {
  delivery_date: string | null;
  ga_at_delivery_days: number | null;
  preeclampsia: boolean;
  pe_ga_days: number | null;
  aspirin: boolean | null;
  notes: string;
  entered_by?: string;
  entered_at?: string;
};

export type ScreeningSummary = {
  id: number;
  version: number;
  replaces_id: number | null;
  status: "draft" | "signed" | "superseded";
  pid: string;
  name: string;
  exam_date: string;
  ga_label: string;
  risk37_one_in: number | null;
  high_risk: boolean;
  created_by: string;
  created_at: string;
  signed_by: string | null;
  signed_at: string | null;
  outcome: OutcomeData | null;
};

export type ScreeningFull = ScreeningSummary & { request: unknown; form_state: FormState | null; result: AssessmentOut };

export type AuditRow = {
  id: number;
  at: string;
  username: string;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown>;
  ip: string;
};

export type UserRow = { username: string; display_name: string; role: Role; active: boolean; last_login: string | null };
