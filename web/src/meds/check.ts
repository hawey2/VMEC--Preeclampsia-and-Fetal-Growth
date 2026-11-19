import { ITEMS, RULES, type Flag, type Item, type Level, type Phase, type Rule } from "./kb";

export type MedContext = { phase: Phase; flags: Flag[] };
export type Finding = { rule: Rule; items: Item[] };

const byId = new Map(ITEMS.map((i) => [i.id, i]));
const order: Record<Level, number> = { avoid: 0, caution: 1, separate: 2, info: 3 };

const matches = (item: Item, ref: string) => item.id === ref || !!item.groups?.includes(ref);

/** One distinct selected item per reference, or null (small backtracking: rules have at most two refs). */
function assign(refs: string[], items: Item[], used: Item[] = []): Item[] | null {
  if (!refs.length) return used;
  for (const it of items) {
    if (used.includes(it) || !matches(it, refs[0])) continue;
    const rest = assign(refs.slice(1), items, [...used, it]);
    if (rest) return rest;
  }
  return null;
}

/**
 * Rules that apply to the selected items in this context, most severe first. Deterministic: the same
 * selection always gives the same findings. An empty result means "no record in this knowledge base",
 * not "safe".
 */
export function checkMeds(selected: string[], ctx: MedContext): Finding[] {
  const items = selected.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  const out: Finding[] = [];
  for (const rule of RULES) {
    if (rule.phases && !rule.phases.includes(ctx.phase)) continue;
    if (rule.flags && !rule.flags.every((f) => ctx.flags.includes(f))) continue;
    const hit = assign(rule.all, items);
    if (hit) out.push({ rule, items: hit });
  }
  return out.sort((a, b) => order[a.rule.level] - order[b.rule.level]);
}

/** Selected items that no rule mentions: shown as "no record", never as safe. */
export function unmatched(selected: string[], findings: Finding[]): Item[] {
  const seen = new Set(findings.flatMap((f) => f.items.map((i) => i.id)));
  return selected.filter((id) => !seen.has(id)).map((id) => byId.get(id)).filter((i): i is Item => !!i);
}
