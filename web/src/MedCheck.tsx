import { loc, t, type Key, type Lang } from "./i18n";
import { checkMeds, unmatched, type Finding, type MedContext } from "./meds/check";
import { FLAGS, ITEMS, PHASES, SOURCES, type Item, type Kind } from "./meds/kb";

export type MedState = MedContext & { selected: string[] };
export const EMPTY_MEDS: MedState = { phase: "lt20", flags: [], selected: [] };

const KINDS: Kind[] = ["regular", "injectable", "food"];
const sourceById = new Map(SOURCES.map((s) => [s.id, s]));

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function FindingItem({ f, lang }: { f: Finding; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const { rule } = f;
  return (
    <li className={`finding finding--${rule.level}`}>
      <div className="finding__head">
        <span className={`chip ddi--${rule.level}`}>{L(`level_${rule.level}` as Key)}</span>
        <strong>{f.items.map((i) => i.name[lang]).join(" + ") || L(`flag_${rule.flags?.[0]}` as Key)}</strong>
        <span className="muted small">{L(`actor_${rule.actor}` as Key)}</span>
      </div>
      <p>{rule.effect[lang]} <strong>{rule.manage[lang]}</strong></p>
      <p className="muted small">
        {L(`evidence_${rule.evidence}` as Key)} ·{" "}
        {rule.sources.map((id, n) => {
          const s = sourceById.get(id)!;
          return (
            <span key={id}>
              {n > 0 && "; "}
              {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}
            </span>
          );
        })}
      </p>
    </li>
  );
}

/** Pick medicines and conditions; shows only the rules that apply, most severe first. */
export function MedCheck({ lang, value, onChange }: { lang: Lang; value: MedState; onChange: (v: MedState) => void }) {
  const L = (k: Key) => t(lang, k);
  const findings = checkMeds(value.selected, value);
  const none = unmatched(value.selected, findings);
  return (
    <details className="card how medcheck">
      <summary><h2>{L("medTitle")}</h2></summary>
      <p className="muted">{L("medIntro")}</p>
      <p className="note">{L("medUnverified")}</p>

      <div className="medcheck__ctx">
        <label className="field">
          <span className="field__label">{L("medPhase")}</span>
          <select value={value.phase} onChange={(e) => onChange({ ...value, phase: e.target.value as MedState["phase"] })}>
            {PHASES.map((p) => <option key={p} value={p}>{L(`phase_${p}` as Key)}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>{L("medFlags")}</legend>
          {FLAGS.map((fl) => (
            <label key={fl} className="check">
              <input type="checkbox" checked={value.flags.includes(fl)} onChange={() => onChange({ ...value, flags: toggle(value.flags, fl) })} />
              {L(`flag_${fl}` as Key)}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="medcheck__items">
        {KINDS.map((k) => (
          <fieldset key={k}>
            <legend>{L(`kind_${k}` as Key)}</legend>
            {ITEMS.filter((i) => i.kind === k).map((i) => (
              <label key={i.id} className="check">
                <input type="checkbox" checked={value.selected.includes(i.id)}
                  onChange={() => onChange({ ...value, selected: toggle(value.selected, i.id) })} />
                {i.name[lang]}
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <h3>{L("medFindings")} ({findings.length})</h3>
      {findings.length === 0 && none.length === 0 && <p className="muted">{L("medNone")}</p>}
      <ul className="findings">{findings.map((f) => <FindingItem key={f.rule.id} f={f} lang={lang} />)}</ul>
      {none.length > 0 && <p className="muted small">{L("medNoRecord")}: {none.map((i) => i.name[lang]).join(", ")}</p>}

      <h3>{L("medReference")}</h3>
      {loc(lang).drugs.map((b) => (
        <div key={b.title}>
          <h4>{b.title}</h4>
          <ul>{b.items.map((it) => <li key={it}>{it}</li>)}</ul>
        </div>
      ))}
    </details>
  );
}

/** Name without the examples in brackets, to keep the printed lines short. */
const short = (i: Item, lang: Lang) => i.name[lang].replace(/\s*\(.*\)$/, "");
const pair = (f: Finding, lang: Lang) => f.items.map((i) => short(i, lang)).join(" + ");

/**
 * Compact lines for the one-page A4 report: what was reviewed, every "avoid" warning in full, and the
 * other warnings as one line per level (their detail stays on screen).
 */
export function MedPrintLines({ value, lang }: { value: MedState; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  if (!value.selected.length) return null;
  const findings = checkMeds(value.selected, value).filter((f) => f.items.length > 0);
  const avoid = findings.filter((f) => f.rule.level === "avoid");
  const names = ITEMS.filter((i) => value.selected.includes(i.id)).map((i) => short(i, lang));
  return (
    <section className="pr__notes pr__meds">
      <h2>{L("medPrinted")} ({L(`phase_${value.phase}` as Key)})</h2>
      <p>
        {names.join(", ")}
        {value.flags.length > 0 && <> · {L("medFlags")}: {value.flags.map((fl) => L(`flag_${fl}` as Key)).join(", ")}</>}
      </p>
      <ul>
        {avoid.map((f) => (
          <li key={f.rule.id}><strong>{L("level_avoid")}:</strong> {pair(f, lang)}. {f.rule.manage[lang]}</li>
        ))}
      </ul>
      {(["caution", "separate"] as const).map((lv) => {
        const fs = findings.filter((f) => f.rule.level === lv);
        return fs.length ? <p key={lv}><strong>{L(`level_${lv}`)}:</strong> {fs.map((f) => pair(f, lang)).join("; ")}</p> : null;
      })}
    </section>
  );
}
