import { useEffect, useState } from "react";
import { getAudit, getUsers } from "./api";
import { t, type Key, type Lang } from "./i18n";
import { fmtDateTime } from "./Records";
import type { AuditRow, UserRow } from "./types";

const ACTIONS = ["login", "login_failed", "create", "view", "amend", "sign", "print", "outcome", "export"];

/** Administrator screen: audit log, users, research export. Admins do not screen patients. */
export function Admin({ lang }: { lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const [username, setUsername] = useState("");
  const [action, setAction] = useState("");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const load = () => {
    getAudit(username.trim(), action).then(setRows).catch(() => setRows([]));
    getUsers().then(setUsers).catch(() => setUsers([]));
  };
  useEffect(load, [action]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
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

      <section className="card">
        <h2>{L("usersTitle")}</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{L("username")}</th><th>{L("name")}</th><th>{L("roleCol")}</th><th>{L("lastLogin")}</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.username}</td>
                  <td>{u.display_name}</td>
                  <td>{L(`role_${u.role}` as Key)}</td>
                  <td>{u.last_login ? fmtDateTime(u.last_login, lang) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
