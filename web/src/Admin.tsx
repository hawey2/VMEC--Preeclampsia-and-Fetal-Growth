import { useEffect, useState } from "react";
import { createUser, getAudit, getUsers, updateUser } from "./api";
import { msg, t, type Key, type Lang } from "./i18n";
import { fmtDateTime } from "./Records";
import type { AuditRow, Role, UserRow } from "./types";

const ACTIONS = [
  "login", "login_failed", "create", "view", "amend", "sign", "print", "outcome", "export",
  "user_create", "user_update", "password_change", "password_change_failed",
];
const ROLES: Role[] = ["sonographer", "doctor", "admin"];

/** Add an account with a temporary password (cloud deployment: accounts kept by the app). */
function AddUser({ lang, onAdded }: { lang: Lang; onAdded: () => void }) {
  const L = (k: Key) => t(lang, k);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("sonographer");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNote("");
    try {
      const u = await createUser({ username: username.trim(), display_name: name.trim(), role, password });
      setNote(`${L("userCreated")}: ${u.username}`);
      setUsername("");
      setName("");
      setPassword("");
      onAdded();
    } catch (err) {
      setError(msg((err as Error).message, lang));
    }
  };

  return (
    <form className="add-user" onSubmit={submit}>
      <h3>{L("addUser")}</h3>
      <div className="grid">
        <label className="field"><span className="field__label">{L("username")}</span>
          <span className="field__control"><input id="new-username" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} required pattern="[A-Za-z0-9._\-]{2,64}" /></span></label>
        <label className="field"><span className="field__label">{L("name")}</span>
          <span className="field__control"><input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required /></span></label>
        <label className="field"><span className="field__label">{L("roleCol")}</span>
          <span className="field__control">
            <select id="new-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{L(`role_${r}` as Key)}</option>)}
            </select>
          </span></label>
        <label className="field"><span className="field__label">{L("tempPassword")}</span>
          <span className="field__control"><input id="new-password" type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} /></span></label>
      </div>
      <p className="muted small">{L("addUserNote")}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {note && <p className="note" role="status">{note}</p>}
      <button type="submit" className="primary">{L("createUser")}</button>
    </form>
  );
}

function UserActions({ u, lang, self, onChanged }: { u: UserRow; lang: Lang; self: string; onChanged: (e: string) => void }) {
  const L = (k: Key) => t(lang, k);
  const [pw, setPw] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => p.then(() => onChanged("")).catch((e) => onChanged(msg((e as Error).message, lang)));
  return (
    <div className="row-actions">
      <select aria-label={`${L("roleCol")} ${u.username}`} value={u.role} disabled={u.username === self}
        onChange={(e) => run(updateUser(u.username, { role: e.target.value }))}>
        {ROLES.map((r) => <option key={r} value={r}>{L(`role_${r}` as Key)}</option>)}
      </select>
      {u.username !== self && (
        <button type="button" onClick={() => run(updateUser(u.username, { active: !u.active }))}>
          {u.active ? L("disableUser") : L("enableUser")}
        </button>
      )}
      {pw === null ? (
        <button type="button" onClick={() => setPw("")}>{L("resetPassword")}</button>
      ) : (
        <span className="inline-form">
          <input aria-label={`${L("tempPassword")} ${u.username}`} type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={10} />
          <button type="button" className="primary" onClick={() => run(updateUser(u.username, { password: pw }).then(() => setPw(null)))}>{L("setPassword")}</button>
          <button type="button" onClick={() => setPw(null)}>{L("cancel")}</button>
        </span>
      )}
    </div>
  );
}

/** Administrator screen: audit log, users, research export. Admins do not screen patients. */
export function Admin({ lang, self, local }: { lang: Lang; self: string; local: boolean }) {
  const L = (k: Key) => t(lang, k);
  const [username, setUsername] = useState("");
  const [action, setAction] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userError, setUserError] = useState("");
  const loadUsers = () => getUsers().then(setUsers).catch(() => setUsers([]));
  const load = () => {
    getAudit(username.trim(), action).then(setRows).catch(() => setRows([]));
    loadUsers();
  };
  useEffect(load, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = (u: UserRow) =>
    !u.active ? L("userDisabled") : u.must_change_password ? L("mustChange") : L("userActive");

  return (
    <>
      <section className="card">
        <h2>{L("usersTitle")}</h2>
        {userError && <p className="error" role="alert">{userError}</p>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{L("username")}</th><th>{L("name")}</th><th>{L("roleCol")}</th>
                {local && <th>{L("statusCol")}</th>}
                <th>{L("lastLogin")}</th>
                {local && <th />}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} className={u.active ? "" : "is-disabled"}>
                  <td>{u.username}</td>
                  <td>{u.display_name}</td>
                  <td>{L(`role_${u.role}` as Key)}</td>
                  {local && <td>{status(u)}</td>}
                  <td>{u.last_login ? fmtDateTime(u.last_login, lang) : "—"}</td>
                  {local && (
                    <td><UserActions u={u} lang={lang} self={self} onChanged={(e) => { setUserError(e); loadUsers(); }} /></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {local && <AddUser lang={lang} onAdded={loadUsers} />}
      </section>

      <section className="card">
        <h2>{L("exportCsv")}</h2>
        <p className="muted">{L("exportNote")}</p>
        <a className="button primary" href="/api/export.csv" download>{L("exportCsv")}</a>
      </section>

      <section className="card">
        <h2>{L("auditTitle")}</h2>
        <div className="filters">
          <label className="field"><span className="field__label">{L("filterUser")}</span>
            <span className="field__control"><input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></span></label>
          <label className="field"><span className="field__label">{L("filterAction")}</span>
            <span className="field__control">
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="">{L("allActions")}</option>
                {ACTIONS.map((a) => <option key={a} value={a}>{L(`action_${a}` as Key)}</option>)}
              </select>
            </span></label>
          <button type="button" onClick={load}>{L("refresh")}</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{L("colTime")}</th><th>{L("filterUser")}</th><th>{L("filterAction")}</th><th>{L("colTarget")}</th><th>IP</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{fmtDateTime(r.at, lang)}</td>
                  <td>{r.username}</td>
                  <td>{ACTIONS.includes(r.action) ? L(`action_${r.action}` as Key) : r.action}</td>
                  <td>{r.target_type ? `${r.target_type} ${r.target_id}` : ""}</td>
                  <td className="muted small">{r.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
