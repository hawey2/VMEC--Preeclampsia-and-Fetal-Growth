/**
 * The standalone website calculates in the browser (src/engine/). This checks it against the
 * Python API on the cases in parity_cases.json (made by make_parity_cases.py).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COEF, compute } from "../src/engine/compute";

type Case = { request: Record<string, unknown>; response?: Record<string, unknown>; error?: string };
const cases: Case[] = JSON.parse(readFileSync(new URL("./parity_cases.json", import.meta.url), "utf8"));

/** Numbers equal to 1e-9 relative (integers such as "1 in N" exactly), everything else exactly. */
function same(a: unknown, b: unknown, path: string, out: string[]): void {
  if (typeof a === "number" && typeof b === "number") {
    const ok = Number.isInteger(b) && Number.isInteger(a) ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
    if (!ok) out.push(`${path}: ${a} != ${b}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: length ${a.length} != ${b.length}`);
    else a.forEach((v, i) => same(v, b[i], `${path}[${i}]`, out));
  } else if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) out.push(`${path}: keys ${ka} != ${kb}`);
    for (const k of kb) same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`, out);
  } else if (a !== b) out.push(`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

describe("browser engine matches the Python API", () => {
  it("uses the same coefficient file", () => {
    const withResult = cases.find((c) => c.response)!;
    expect(COEF.checksum).toBe(withResult.response!.model_checksum);
  });

  it.each(cases.map((c, i) => [i, c] as const))("case %i", (_i, c) => {
    if (c.error) {
      expect(() => compute(c.request)).toThrow(c.error);
      return;
    }
    const got = compute(c.request) as unknown as Record<string, unknown>;
    const diffs: string[] = [];
    const { generated_at: _g, ...have } = got;
    same(have, c.response, "", diffs);
    expect(diffs).toEqual([]);
  });
});
