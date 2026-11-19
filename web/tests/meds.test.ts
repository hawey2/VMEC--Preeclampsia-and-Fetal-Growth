import { describe, expect, it } from "vitest";
import { checkMeds, unmatched } from "../src/meds/check";
import { ITEMS, KB_META, RULES, SOURCES, type Flag, type Phase } from "../src/meds/kb";

const ids = (sel: string[], phase: Phase = "w20to36", flags: Flag[] = []) => checkMeds(sel, { phase, flags }).map((f) => f.rule.id);

describe("knowledge base integrity", () => {
  const refs = new Set(ITEMS.flatMap((i) => [i.id, ...(i.groups ?? [])]));
  const sources = new Set(SOURCES.map((s) => s.id));

  it("has unique ids", () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it.each(RULES.map((r) => [r.id, r] as const))("%s refers to known items, sources and both languages", (_, r) => {
    for (const ref of r.all) expect(refs.has(ref)).toBe(true);
    expect(r.sources.length).toBeGreaterThan(0);
    for (const s of r.sources) expect(sources.has(s)).toBe(true);
    for (const text of [r.effect, r.manage]) {
      expect(text.vi.trim()).not.toBe("");
      expect(text.en.trim()).not.toBe("");
    }
    expect(r.all.length > 0 || (r.flags?.length ?? 0) > 0).toBe(true);
  });

  it("stays marked unverified until the pharmacist review is signed", () => {
    expect(KB_META.verified).toBe(false);
  });
});

describe("checkMeds", () => {
  it("returns nothing for an empty selection", () => {
    expect(checkMeds([], { phase: "lt20", flags: [] })).toEqual([]);
  });

  it("flags aspirin with an NSAID and the NSAID itself from 20 weeks, most severe first", () => {
    const out = checkMeds(["aspirin", "nsaid"], { phase: "w20to36", flags: [] });
    expect(out.map((f) => f.rule.id)).toEqual(["aspirin_nsaid", "nsaid_antenatal", "aspirin_adherence"]);
    expect(out[0].items.map((i) => i.id)).toEqual(["aspirin", "nsaid"]);
  });

  it("treats postpartum ibuprofen as acceptable, per the RCTs", () => {
    expect(ids(["nsaid"], "postpartum")).toEqual(["nsaid_postpartum"]);
  });

  it("does not let aspirin count as an NSAID", () => {
    expect(ids(["aspirin"], "w20to36")).not.toContain("nsaid_antenatal");
  });

  it("forbids ACE inhibitors and ARBs in pregnancy but not after delivery", () => {
    expect(ids(["acei_arb"], "lt20")).toContain("acei_pregnancy");
    expect(ids(["acei_arb"], "postpartum")).not.toContain("acei_pregnancy");
  });

  it("checks injectables at the bedside", () => {
    expect(ids(["mgso4", "nifedipine"])).toEqual(expect.arrayContaining(["mg_ccb", "mg_monitoring"]));
    expect(ids(["mgso4"], "ge36", ["oliguria"])[0]).toBe("mg_oliguria");
    expect(ids(["labetalol_iv"], "ge36", ["asthma"])).toContain("beta_asthma");
    expect(ids(["hydralazine_iv"], "ge36", ["asthma"])).not.toContain("beta_asthma");
  });

  it("raises the 60-minute treatment reminder from the condition alone", () => {
    expect(ids([], "ge36", ["severe_htn"])).toEqual(["severe_htn_60min"]);
  });

  it("covers foods and supplements", () => {
    expect(ids(["nifedipine", "grapefruit"])).toContain("nifedipine_grapefruit");
    expect(ids(["aspirin", "ginkgo"])).toContain("aspirin_supplement");
    expect(ids(["calcium", "iron"])).toEqual(["calcium_iron"]);
  });

  it("lists selected items with no rule as 'no record', not as safe", () => {
    const sel = ["oxytocin", "paracetamol", "calcium", "iron"];
    const f = checkMeds(sel, { phase: "ge36", flags: [] });
    expect(unmatched(sel, f).map((i) => i.id)).toEqual(["oxytocin", "paracetamol"]);
  });
});
