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
};

/** Everything the form holds, as strings straight from the inputs. */
export type FormState = {
  name: string;
  pid: string;
  exam_date: string;
  date_of_birth: string;
  height_cm: string;
  weight_kg: string;
  ethnicity: string;
  smoker: "" | "yes" | "no";
  dating_method: string;
  crl_mm: string;
  lmp: string;
  edd: string;
  transfer_date: string;
  embryo_age_days: string;
  weeks: string;
  days: string;
  vanishing_twin: "" | "yes" | "no";
  conception: string;
  parity: "" | "nulliparous" | "parous";
  prev_pe: "" | "yes" | "no";
  prev_ga_weeks: string;
  prev_delivery_date: string;
  chronic_hypertension: boolean;
  diabetes: string;
  sle_or_aps: boolean;
  family_history_pe: boolean;
  map_mode: "readings" | "value" | "mom";
  bp: string[]; // 8 values: sys/dia x 4 readings
  map_mmhg: string;
  map_mom: string;
  utpi_mode: "raw" | "mom";
  utpi_left: string;
  utpi_right: string;
  utpi_mom: string;
  plgf_mode: "raw" | "mom";
  plgf_pg_ml: string;
  plgf_analyser: string;
  plgf_mom: string;
};
