import { Fragment, useEffect, useState } from "react";
import { getHistory, putOutcome } from "./api";
import { msg, t, type Key, type Lang } from "./i18n";
import type { OutcomeData, Role, ScreeningSummary } from "./types";

export const fmtDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
export const fmtDateTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
const oneIn = (n: number | null, lang: Lang) => (n == null ? "—" : t(lang, "oneInFmt").replace("{n}", n.toLocaleString("en")));
const gaText = (d: number | null, lang: Lang) => (d == null ? "" : `${Math.floor(d / 7)}+${d % 7} ${t(lang, "weeks")}`);

export function StatusChip({ s, lang }: { s: ScreeningSummary["status"]; lang: Lang }) {
  return <span className={`chip chip--${s}`}>{t(lang, `status_${s}` as Key)}</span>;
}

/** Record line in the results card: saved or not, version, status, who signed; save / sign buttons. */
export function RecordBar(props: {
  lang: Lang;
  role: Role;
  record: ScreeningSummary | null;
  dirty: boolean;
  hasPid: boolean;
  busy: boolean;
  onSave: () => void;
  onSign: () => void;
}) {
  const { lang, role, record, dirty, hasPid, busy, onSave, onSign } = props;
  const L = (k: Key) => t(lang, k);
  return (
    <div className="recordbar">
      <div>
        {record ? (
          <>
            <strong>{L("record")} #{record.id}</strong> · {L("versionWord")} {record.version} · <StatusChip s={record.status} lang={lang} />
            <div className="muted small">
              {L("savedBy")} {record.created_by}, {fmtDateTime(record.created_at, lang)}
              {record.signed_by && <> · {L("signedBy")} {record.signed_by}, {fmtDateTime(record.signed_at!, lang)}</>}
            </div>
            {dirty && <div className="note small">{L("unsavedChanges")}</div>}
          </>
        ) : (
          <>
            <strong>{L("notSaved")}</strong>
            {!hasPid && <div className="muted small">{L("pidNeeded")}</div>}
          </>
        )}
      </div>
      <div className="recordbar__actions">
        {(!record || dirty) && (
          <button type="button" className="primary" onClick={onSave} disabled={busy || !hasPid}>
            {record ? L("saveNew") : L("save")}
          </button>
        )}
        {record && !dirty && record.status === "draft" && role === "doctor" && (
          <button type="button" className="primary" onClick={onSign} disabled={busy}>{L("signRecord")}</button>
        )}
      </div>
    </div>
  );
}

const yn = (b: boolean | null) => (b == null ? "" : b ? "yes" : "no");

function OutcomeForm({ s, lang, onSaved, onCancel }: {
  s: ScreeningSummary; lang: Lang; onSaved: (s: ScreeningSummary) => void; onCancel: () => void;
}) {
  const L = (k: Key) => t(lang, k);
  const o = s.outcome;
  const [date, setDate] = useState(o?.delivery_date ?? "");
  const [gw, setGw] = useState(o?.ga_at_delivery_days != null ? String(Math.floor(o.ga_at_delivery_days / 7)) : "");
  const [gd, setGd] = useState(o?.ga_at_delivery_days != null ? String(o.ga_at_delivery_days % 7) : "");
  const [pe, setPe] = useState(yn(o?.preeclampsia ?? null));
  const [pw, setPw] = useState(o?.pe_ga_days != null ? String(Math.floor(o.pe_ga_days / 7)) : "");
  const [pd, setPd] = useState(o?.pe_ga_days != null ? String(o.pe_ga_days % 7) : "");
  const [asp, setAsp] = useState(yn(o?.aspirin ?? null));
  const [notes, setNotes] = useState(o?.notes ?? "");
  const [error, setError] = useState("");

  const days = (w: string, d: string) => (w.trim() === "" ? null : Number(w) * 7 + Number(d || 0));
  const seg = (v: string, setV: (x: string) => void, label: string) => (
    <div className="field" role="radiogroup" aria-label={label}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        <span className="seg">
          {(["yes", "no"] as const).map((x) => (
            <button key={x} type="button" className={v === x ? "seg__on" : ""} aria-pressed={v === x} onClick={() => setV(x)}>{L(x)}</button>
          ))}
        </span>
      </span>
    </div>
  );

  const submit = async () => {
    if (!pe) return setError(`${L("required")}: ${L("hadPe")}`);
    const body: OutcomeData = {
      delivery_date: date || null,
      ga_at_delivery_days: days(gw, gd),
      preeclampsia: pe === "yes",
      pe_ga_days: pe === "yes" ? days(pw, pd) : null,
      aspirin: asp ? asp === "yes" : null,
      notes,
    };
    try {
      onSaved(await putOutcome(s.id, body));
    } catch (e) {
      setError(msg((e as Error).message, lang));
    }
  };

  return (
    <div className="outcome-form">
      <div className="grid">
        <label className="field"><span className="field__label">{L("deliveryDate")}</span>
          <span className="field__control"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></span></label>
        <label className="field"><span className="field__label">{L("gaAtDelivery")}</span>
          <span className="field__control">
            <input aria-label={`${L("gaAtDelivery")} ${L("weeks")}`} inputMode="numeric" value={gw} onChange={(e) => setGw(e.target.value)} /><span className="unit">{L("weeks")}</span>
            <input aria-label={`${L("gaAtDelivery")} ${L("days")}`} inputMode="numeric" value={gd} onChange={(e) => setGd(e.target.value)} /><span className="unit">{L("days")}</span>
          </span></label>
        {seg(pe, setPe, L("hadPe"))}
        {pe === "yes" && (
          <label className="field"><span className="field__label">{L("gaAtPe")}</span>
            <span className="field__control">
              <input aria-label={`${L("gaAtPe")} ${L("weeks")}`} inputMode="numeric" value={pw} onChange={(e) => setPw(e.target.value)} /><span className="unit">{L("weeks")}</span>
              <input aria-label={`${L("gaAtPe")} ${L("days")}`} inputMode="numeric" value={pd} onChange={(e) => setPd(e.target.value)} /><span className="unit">{L("days")}</span>
            </span></label>
        )}
        {seg(asp, setAsp, L("aspirinTaken"))}
        <label className="field"><span className="field__label">{L("notesField")}</span>
          <span className="field__control"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></span></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="primary" onClick={submit}>{L("saveOutcome")}</button>
        <button type="button" onClick={onCancel}>{L("cancel")}</button>
      </div>
    </div>
  );
}

/** Saved screenings for the PID in the form, newest first, with outcome entry. */
export function History({ pid, lang, refreshKey, currentId, onOpen }: {
  pid: string; lang: Lang; refreshKey: number; currentId: number | null; onOpen: (id: number) => void;
}) {
  const L = (k: Key) => t(lang, k);
  const [rows, setRows] = useState<ScreeningSummary[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    const p = pid.trim();
    if (!p) return setRows(null);
    let live = true;
    const id = window.setTimeout(() => {
      getHistory(p).then((r) => live && setRows(r)).catch(() => live && setRows(null));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [pid, refreshKey]);

  if (rows === null) return null;
  return (
    <section className="card history">
      <h2>{L("historyTitle")} · {pid}</h2>
      {rows.length === 0 ? (
        <p className="muted">{L("noHistory")}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{L("examDate")}</th>
                <th>{L("ga")}</th>
                <th>{L("riskBefore37")}</th>
                <th>{L("status")}</th>
                <th>{L("outcome")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Fragment key={s.id}>
                  <tr className={s.id === currentId ? "is-current" : ""}>
                    <td className="num">{s.id} <span className="muted small">v{s.version}</span></td>
                    <td>{fmtDate(s.exam_date)}</td>
                    <td>{s.ga_label}</td>
                    <td className={`num ${s.high_risk ? "risk-high" : ""}`}>{oneIn(s.risk37_one_in, lang)}</td>
                    <td><StatusChip s={s.status} lang={lang} />{s.signed_by && <div className="muted small">{s.signed_by}</div>}</td>
                    <td>
                      {s.outcome
                        ? <>{s.outcome.preeclampsia ? L("peYes") : L("peNo")}{s.outcome.ga_at_delivery_days != null && <div className="muted small">{gaText(s.outcome.ga_at_delivery_days, lang)}</div>}</>
                        : <span className="muted">{L("noOutcome")}</span>}
                    </td>
                    <td><div className="row-actions">
                      {s.status !== "superseded" && s.id !== currentId && <button type="button" onClick={() => onOpen(s.id)}>{L("open")}</button>}
                      {s.status !== "superseded" && (
                        <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)}>
                          {s.outcome ? L("editOutcome") : L("enterOutcome")}
                        </button>
                      )}
                    </div></td>
                  </tr>
                  {editing === s.id && (
                    <tr>
                      <td colSpan={7}>
                        <OutcomeForm s={s} lang={lang} onCancel={() => setEditing(null)}
                          onSaved={(u) => { setRows(rows.map((x) => (x.id === u.id ? u : x))); setEditing(null); }} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
