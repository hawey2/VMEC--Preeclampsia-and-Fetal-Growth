import { describe, expect, it } from "vitest";
import { formGaDays, hasErrors, parseNum, validateForm } from "../src/validate";
import type { FormState } from "../src/types";

const base = {
  name: "", pid: "", exam_date: "2026-11-04", date_of_birth: "1990-03-15", height_cm: "158", weight_kg: "55",
  ethnicity: "east_asian", smoker: "no", dating_method: "crl", lmp: "", edd: "", transfer_date: "", embryo_age_days: "5",
  weeks: "", days: "", vanishing_twin: "no", conception: "spontaneous", htn: "no", dm1: "no", dm2: "no", dm2_insulin: "",
  fam_pe: "no", sle: "no", aps: "no", parity: "nulliparous", prev_pe: "", prev_ga_weeks: "", prev_delivery_date: "",
  heart: "present", crl_mm: "65", bpd_mm: "", bp: Array(8).fill(""), map_mmhg: "", map_operator: "",
  utpi_right: "", utpi_left: "", utpi_operator: "", oa: Array(4).fill(""), plgf_date: "", plgf_pg_ml: "",
  plgf_analyser: "cobas_e411", plgf_mom: "",
} as FormState;
const check = (patch: Partial<FormState>) => validateForm({ ...base, ...patch }, "en");

describe("field checks", () => {
  it("reads a decimal comma", () => {
    expect(parseNum("2,5")).toBe(2.5);
    expect(parseNum(" 12 ")).toBe(12);
    expect(parseNum("")).toBeNull();
    expect(parseNum("abc")).toBeNaN();
    expect(parseNum("12+3")).toBeNaN();
  });

  it("accepts a complete normal form", () => {
    expect(hasErrors(check({ utpi_right: "1,6", utpi_left: "1.7", plgf_pg_ml: "35" }))).toBe(false);
  });

  it("CRL 45 to 84 mm, including 84 (13+6)", () => {
    expect(check({ crl_mm: "84" }).crl_mm).toBeUndefined();
    expect(check({ crl_mm: "90" }).crl_mm?.text).toContain("45 to 84 mm");
    expect(check({ crl_mm: "6,5x" }).crl_mm?.text).toContain("Not a number");
  });

  it("gives the accepted LMP dates for 11+0 to 13+6", () => {
    expect(check({ dating_method: "lmp", lmp: "2026-08-19" }).lmp).toBeUndefined(); // 77 days
    expect(check({ dating_method: "lmp", lmp: "2026-07-30" }).lmp).toBeUndefined(); // 97 days
    expect(check({ dating_method: "lmp", lmp: "2026-09-05" }).lmp?.text).toContain("30/07/2026 to 19/08/2026");
  });

  it("manual GA 13+6 is fine, 14+0 is not", () => {
    expect(hasErrors(check({ dating_method: "manual", weeks: "13", days: "6" }))).toBe(false);
    expect(hasErrors(check({ dating_method: "manual", weeks: "14", days: "0" }))).toBe(true);
    expect(formGaDays({ ...base, dating_method: "manual", weeks: "12", days: "" })).toBe(84);
  });

  it("PlGF: number, range, and a sample date inside the window", () => {
    expect(check({ plgf_pg_ml: "abc" }).plgf_pg_ml?.level).toBe("error");
    expect(check({ plgf_pg_ml: "3000" }).plgf_pg_ml?.level).toBe("error");
    expect(check({ plgf_pg_ml: "2" }).plgf_pg_ml?.level).toBe("warn");
    expect(check({ plgf_pg_ml: "35", plgf_date: "2026-11-02" }).plgf_date).toBeUndefined();
    expect(check({ plgf_pg_ml: "35", plgf_date: "2026-10-01" }).plgf_date?.level).toBe("error");
  });

  it("blood pressure: pairs, and systolic above diastolic (an error beats a warning)", () => {
    const bp = Array(8).fill("");
    bp[0] = "70";
    bp[1] = "90";
    expect(check({ bp }).bp0?.text).toContain("Systolic must be higher");
    const half = Array(8).fill("");
    half[2] = "120";
    expect(check({ bp: half }).bp3?.level).toBe("error");
  });

  it("UtA-PI needs both sides", () => {
    expect(check({ utpi_right: "1.6" }).utpi_left?.level).toBe("error");
  });
});
