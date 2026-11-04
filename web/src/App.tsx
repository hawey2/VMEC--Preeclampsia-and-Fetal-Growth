import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { msg } from "./messages";
import { UNAUTHORIZED, amendScreening, assess, buildRequest, getScreening, logout, markPrinted, me, saveScreening, signScreening } from "./api";
import { AssessmentForm } from "./Form";
import { loc, t, type Key, type Lang } from "./i18n";
import { MomTable, PrintReport, RiskLines, RiskTable, ScreenBadge } from "./Report";
import { Charts } from "./Charts";
import { HowItWorks } from "./How";
import { Info } from "./Info";
import type { AssessmentOut, FormState, ScreeningSummary, User } from "./types";
import { Login } from "./Login";
import { History, RecordBar } from "./Records";
import { Admin } from "./Admin";

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const EMPTY: FormState = {
  name: "", pid: "", exam_date: today(), date_of_birth: "", height_cm: "", weight_kg: "",
  ethnicity: "east_asian", smoker: "", dating_method: "crl", lmp: "", edd: "",
  transfer_date: "", embryo_age_days: "5", weeks: "", days: "", vanishing_twin: "no",
  conception: "spontaneous", htn: "", dm1: "", dm2: "", dm2_insulin: "", fam_pe: "", sle: "", aps: "",
  parity: "", prev_pe: "", prev_ga_weeks: "", prev_delivery_date: "",
  heart: "present", crl_mm: "", bpd_mm: "",
  bp: Array(8).fill(""), map_mmhg: "", map_operator: "",
  utpi_right: "", utpi_left: "", utpi_operator: "", oa: Array(4).fill(""),
  plgf_date: "", plgf_pg_ml: "", plgf_analyser: "cobas_e411", plgf_mom: "",
};

const pick = (list: [string, string][], v: string) => list.find((x) => x[0] === v)?.[1] ?? v;

function facts(f: FormState, lang: Lang): { label: Key; value: string }[] {
  const L = (k: Key) => t(lang, k);
  const yn = (v: string) => L(v === "yes" ? "yes" : "no");
  const out: { label: Key; value: string }[] = [
    { label: "height", value: `${f.height_cm} cm` },
    { label: "weight", value: `${f.weight_kg} kg` },
    { label: "ethnicity", value: pick(loc(lang).ethnicities, f.ethnicity) },
    { label: "smoker", value: yn(f.smoker) },
    { label: "conception", value: pick(loc(lang).conceptions, f.conception) },
    { label: "parity", value: L(f.parity === "parous" ? "parous" : "nulliparous") },
  ];
  if (f.parity === "parous") {
    out.push({ label: "prevPe", value: yn(f.prev_pe) });
    out.push({ label: "prevGa", value: `${f.prev_ga_weeks} ${L("weeks")}` });
  }
  out.push(
    { label: "chronicHtn", value: yn(f.htn) },
    { label: "dm1", value: yn(f.dm1) },
    { label: "dm2", value: f.dm2 === "yes" && f.dm2_insulin === "yes" ? `${L("yes")} (insulin)` : yn(f.dm2) },
    { label: "sleOnly", value: yn(f.sle) },
    { label: "apsOnly", value: yn(f.aps) },
    { label: "famPe", value: yn(f.fam_pe) },
  );
  return out;
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("pe-lang") as Lang) || "vi";
    } catch {
      return "vi";
    }
  });
  const [f, setF] = useState<FormState>(EMPTY);
  const [missing, setMissing] = useState<string[]>([]);
  const [result, setResult] = useState<AssessmentOut | null>(null);
  const [submitted, setSubmitted] = useState<FormState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const L = (k: Key) => t(lang, k);

  // Sign-in: undefined while checking, null when signed out.
  // The standalone website has no server: no sign-in, nothing saved.
  const [user, setUser] = useState<User | null | undefined>(
    __STANDALONE__ ? { username: "", display_name: "", role: "sonographer" } : undefined,
  );
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (__STANDALONE__) return;
    me().then(setUser).catch(() => setUser(null));
    const onExpired = () => {
      setUser((u) => {
        if (u) setNotice("expired");
        return null;
      });
    };
    window.addEventListener(UNAUTHORIZED, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED, onExpired);
  }, []);
  const signOut = async () => {
    await logout().catch(() => undefined);
    setUser(null);
    setNotice("");
    setF({ ...EMPTY, exam_date: today() });
    setResult(null);
    setRecord(null);
  };

  // The saved record this form belongs to, and the form as it was saved (to spot unsaved changes).
  const [record, setRecord] = useState<{ summary: ScreeningSummary; form: FormState } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const samePatient = !!record && record.summary.pid === f.pid.trim();
  const dirty = !!record && JSON.stringify(record.form) !== JSON.stringify(f);

  const saveRecord = async (): Promise<ScreeningSummary | null> => {
    setError("");
    let body: unknown;
    try {
      body = buildRequest(f);
    } catch (m) {
      setMissing(m as string[]);
      setError(`${L("required")}: ${(m as Key[]).map((k) => L(k)).join(", ")}`);
      return null;
    }
    setSaving(true);
    try {
      const s = record && samePatient ? await amendScreening(record.summary.id, body, f) : await saveScreening(body, f);
      setRecord({ summary: s, form: f });
      setResult(s.result);
      setSubmitted(f);
      setHistoryKey((k) => k + 1);
      return s;
    } catch (e) {
      setError(`${L("error")}: ${msg((e as Error).message, lang)}`);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const signRecord = async () => {
    if (!record) return;
    setSaving(true);
    try {
      const s = await signScreening(record.summary.id);
      setRecord({ ...record, summary: s });
      setHistoryKey((k) => k + 1);
    } catch (e) {
      setError(`${L("error")}: ${msg((e as Error).message, lang)}`);
    } finally {
      setSaving(false);
    }
  };

  const openRecord = async (id: number) => {
    try {
      const s = await getScreening(id);
      const form = { ...EMPTY, ...(s.form_state ?? {}) } as FormState;
      firstRun.current = true; // show the stored result as saved, not a recalculation
      setF(form);
      setRecord({ summary: s, form });
      setResult(s.result);
      setSubmitted(form);
      setMissing([]);
      setError("");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(`${L("error")}: ${msg((e as Error).message, lang)}`);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem("pe-lang", lang);
    } catch {
      /* private mode: language just isn't remembered */
    }
    document.documentElement.lang = lang;
  }, [lang]);

  const set = (patch: Partial<FormState>) => setF((prev) => ({ ...prev, ...patch }));

  // Recalculate quietly as the form is filled in, like the FMF calculator, once it is complete.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    let body: unknown;
    try {
      body = buildRequest(f);
    } catch {
      setResult(null);
      return;
    }
    let live = true;
    const id = window.setTimeout(() => {
      assess(body)
        .then((r) => {
          if (!live) return;
          setResult(r);
          setSubmitted(f);
          setMissing([]);
          setError("");
        })
        .catch(() => live && setResult(null));
    }, 450);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [f]);

  // The printed report is in one language: the screen language, or the other one on request.
  const [printLang, setPrintLang] = useState<Lang | null>(null);
  const printIn = async (l: Lang) => {
    // Every printed report carries a record number: save first when there are unsaved changes.
    let rec = record && !dirty ? record.summary : null;
    if (!rec && f.pid.trim() && !__STANDALONE__) rec = await saveRecord();
    if (rec) await markPrinted(rec.id, l).catch(() => undefined);
    flushSync(() => setPrintLang(l));
    window.print();
    setPrintLang(null);
  };

  const calculate = async () => {
    setError("");
    let body: unknown;
    try {
      body = buildRequest(f);
    } catch (m) {
      setMissing(m as string[]);
      setError(`${L("required")}: ${(m as Key[]).map((k) => L(k)).join(", ")}`);
      return;
    }
    setMissing([]);
    setBusy(true);
    try {
      const r = await assess(body);
      setResult(r);
      setSubmitted(f);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setError(`${L("error")}: ${msg((e as Error).message, lang)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="app">
        <header className="top">
          <div>
            <h1>{L("appTitle")}</h1>
            <p className="muted">{L("appSub")}</p>
          </div>
          <div className="top__right">
          {user && !__STANDALONE__ && (
            <div className="whoami">
              <span><strong>{user.display_name}</strong> · {L(`role_${user.role}` as Key)}</span>
              <button type="button" className="link" onClick={signOut}>{L("signOut")}</button>
            </div>
          )}
          <div className="seg seg--small" role="group" aria-label="Language">
            <button type="button" className={lang === "vi" ? "seg__on" : ""} onClick={() => setLang("vi")}>VI</button>
            <button type="button" className={lang === "en" ? "seg__on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          </div>
        </header>

        <div className="banner" role="note">{L("notClinical")}</div>
        {__STANDALONE__ && <p className="note standalone-note">{L("standaloneNote")}</p>}

        {user === undefined && <p className="muted">…</p>}
        {user === null && (
          <Login lang={lang} notice={notice ? L("sessionExpired") : ""} onDone={(u) => { setUser(u); setNotice(""); }} />
        )}
        {user?.role === "admin" && <Admin lang={lang} />}
        {user && user.role !== "admin" && (
        <>
        <AssessmentForm lang={lang} f={f} set={set} missing={missing} result={result} />

        <div className="actions">
          <button type="button" className="primary" onClick={calculate} disabled={busy}>
            {busy ? "…" : L("calculate")}
          </button>
          <button type="button" onClick={() => { setF({ ...EMPTY, exam_date: today() }); setResult(null); setRecord(null); setMissing([]); setError(""); }}>
            {L("reset")}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        {result && (
          <section className="card results" ref={resultRef} aria-live="polite">
            <div className="results__head">
              <h2>{L("results")}</h2>
              <div className="print-actions">
                <button type="button" className="primary" onClick={() => printIn(lang)}>{L("print")}</button>
                <button type="button" onClick={() => printIn(lang === "vi" ? "en" : "vi")}>{L("printOther")}</button>
              </div>
            </div>
            {!__STANDALONE__ && <RecordBar lang={lang} role={user.role} record={record?.summary ?? null} dirty={dirty || (!!record && !samePatient)}
              hasPid={!!f.pid.trim()} busy={saving} onSave={saveRecord} onSign={signRecord} />}
            <p className="muted">
              {L("ga")} {result.ga_label} ({L("dating")} {result.dating_method.toUpperCase()}) · {L("age")} {result.age_years.toFixed(1)} {L("years")}
            </p>
            <RiskLines r={result} lang={lang} />
            <ScreenBadge r={result} lang={lang} />
            <RiskTable r={result} lang={lang} />
            {!result.combined && Object.keys(result.moms).length > 0 && <p className="note">{L("combinedMissing")}</p>}
            <MomTable r={result} lang={lang} />
            <p>
              <strong>{L("action")}:</strong> {result.screen.high_risk ? L("actionHigh") : L("actionLow")}
            </p>
            {result.warnings.length > 0 && (
              <details>
                <summary>{L("notes")} ({result.warnings.length})</summary>
                <ul>{result.warnings.map((w) => <li key={w}>{msg(w, lang)}</li>)}</ul>
              </details>
            )}
            <p className="muted small">{L("disclaimer")}</p>
          </section>
        )}
        {result && submitted && <Charts r={result} lang={lang} />}
        {result && submitted && <HowItWorks r={result} f={submitted} lang={lang} />}
        {!__STANDALONE__ && <History pid={f.pid} lang={lang} refreshKey={historyKey} currentId={record?.summary.id ?? null} onOpen={openRecord} />}
        </>
        )}
        <Info lang={lang} />
      </div>
      {user && result && submitted && (
        <PrintReport r={result} facts={facts(submitted, printLang ?? lang)} lang={printLang ?? lang}
          record={record && !dirty ? record.summary : null} />
      )}
    </>
  );
}
