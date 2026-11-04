/**
 * Language-neutral names (devices, marker abbreviations) live here.
 * Words the user reads live in locales/vi.ts and locales/en.ts.
 */
export { loc, msg, t, type Key, type Lang } from "./locales";

export const analysers: [string, string][] = [
  ["cobas_e411", "Roche Cobas e411 (Elecsys)"],
  ["kryptor", "Thermo Fisher BRAHMS Kryptor"],
  ["delfia_xpress", "Revvity DELFIA Xpress"],
];

export const markerName: Record<string, string> = { map: "MAP", utpi: "UtA-PI", plgf: "PlGF" };
