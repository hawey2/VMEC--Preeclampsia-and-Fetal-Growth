import { loc, t, type Key, type Lang } from "./i18n";

/** Drugs related to preeclampsia and the interactions to check, in the chosen language (see locales/). */
export function Drugs({ lang }: { lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const { groups, interactions } = loc(lang).drugs;
  return (
    <details className="card how drugs">
      <summary><h2>{L("drugsTitle")}</h2></summary>
      <p className="muted">{L("drugsIntro")}</p>
      {groups.map((g) => (
        <div key={g.title}>
          <h3>{g.title}</h3>
          <ul>{g.items.map((it) => <li key={it}>{it}</li>)}</ul>
        </div>
      ))}
      <h3>{L("drugsTableTitle")}</h3>
      <div className="table-scroll">
        <table className="ddi">
          <thead>
            <tr>
              <th>{L("colLevel")}</th>
              <th>{L("colCombo")}</th>
              <th>{L("colEffect")}</th>
              <th>{L("colManage")}</th>
            </tr>
          </thead>
          <tbody>
            {interactions.map((x) => (
              <tr key={x.combo}>
                <td><span className={`chip ddi--${x.level}`}>{L(`level_${x.level}` as Key)}</span></td>
                <td><strong>{x.combo}</strong></td>
                <td data-label={L("colEffect")}>{x.effect}</td>
                <td data-label={L("colManage")}>{x.manage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{L("drugsSource")}</p>
    </details>
  );
}
