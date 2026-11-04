import { useEffect, useState } from "react";
import { authMode, changePassword, login } from "./api";
import { msg, t, type Key, type Lang } from "./i18n";
import type { User } from "./types";

export function Login({ lang, notice, onDone }: { lang: Lang; notice: string; onDone: (u: User) => void }) {
  const L = (k: Key) => t(lang, k);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("");
  useEffect(() => {
    authMode().then((m) => setMode(m.auth_mode)).catch(() => undefined);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await login(username, password));
    } catch (err) {
      setError((err as Error).message === "account locked" ? L("accountLocked") : L("signInFailed"));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h2>{L("signIn")}</h2>
      <p className="muted">{L(mode === "local" ? "signInIntroLocal" : "signInIntro")}</p>
      {notice && <p className="note" role="status">{notice}</p>}
      <label className="field">
        <span className="field__label">{L("username")}</span>
        <span className="field__control">
          <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </span>
      </label>
      <label className="field">
        <span className="field__label">{L("password")}</span>
        <span className="field__control">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </span>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="primary" disabled={busy}>{busy ? "…" : L("signIn")}</button>
    </form>
  );
}

/** Set your own password: required after a temporary one, and available from the header (cloud accounts). */
export function ChangePassword({ lang, forced, onDone, onCancel }: {
  lang: Lang; forced: boolean; onDone: (u: User) => void; onCancel?: () => void;
}) {
  const L = (k: Key) => t(lang, k);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== again) return setError(L("passwordsDiffer"));
    setBusy(true);
    setError("");
    try {
      onDone(await changePassword(current, next));
    } catch (err) {
      setError(msg((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  };

  const field = (id: string, label: Key, v: string, set: (x: string) => void, auto: string) => (
    <label className="field">
      <span className="field__label">{L(label)}</span>
      <span className="field__control">
        <input id={id} type="password" autoComplete={auto} value={v} onChange={(e) => set(e.target.value)} required minLength={id === "pw-current" ? 1 : 10} />
      </span>
    </label>
  );

  return (
    <form className="card login" onSubmit={submit}>
      <h2>{L("changePassword")}</h2>
      {forced && <p className="note">{L("changePasswordIntro")}</p>}
      {field("pw-current", "currentPassword", current, setCurrent, "current-password")}
      {field("pw-new", "newPassword", next, setNext, "new-password")}
      {field("pw-again", "newPasswordAgain", again, setAgain, "new-password")}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy}>{busy ? "…" : L("changePassword")}</button>
        {onCancel && <button type="button" onClick={onCancel}>{L("cancel")}</button>}
      </div>
    </form>
  );
}
