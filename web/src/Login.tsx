import { useState } from "react";
import { login } from "./api";
import { t, type Key, type Lang } from "./i18n";
import type { User } from "./types";

export function Login({ lang, notice, onDone }: { lang: Lang; notice: string; onDone: (u: User) => void }) {
  const L = (k: Key) => t(lang, k);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await login(username, password));
    } catch {
      setError(L("signInFailed"));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card login" onSubmit={submit}>
      <h2>{L("signIn")}</h2>
      <p className="muted">{L("signInIntro")}</p>
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
