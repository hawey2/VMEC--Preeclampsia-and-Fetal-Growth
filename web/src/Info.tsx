import { loc, t, type Lang } from "./i18n";

/** Screening guidance and measurement protocols, in the chosen language (see locales/). */
export function Info({ lang }: { lang: Lang }) {
  return (
    <details className="card how">
      <summary><h2>{t(lang, "infoTitle")}</h2></summary>
      {loc(lang).info.map((b) => (
        <div key={b.title}>
          <h3>{b.title}</h3>
          <ul>{b.items.map((it) => <li key={it}>{it}</li>)}</ul>
        </div>
      ))}
      <p className="muted small">{t(lang, "infoSource")}</p>
    </details>
  );
}
