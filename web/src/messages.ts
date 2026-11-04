export { msg } from "./locales";

/** One line for all "coefficients not verified" notes so the report stays short. */
export function compactWarnings(ws: string[]): string[] {
  const coef = ws.map((w) => /^Coefficients for '(\w+)' are '(\w+)'/.exec(w)).filter((m): m is RegExpExecArray => !!m);
  const rest = ws.filter((w) => !/^Coefficients for '/.test(w));
  if (!coef.length) return rest;
  return [`Coefficients not verified, not for clinical use: ${coef.map((m) => `${m[1]} (${m[2]})`).join(", ")}.`, ...rest];
}
