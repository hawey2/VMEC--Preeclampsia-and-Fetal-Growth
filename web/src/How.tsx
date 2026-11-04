import { loc, markerName, t, type Key, type Lang } from "./i18n";
import type { AssessmentOut, FormState } from "./types";
import { bpPairs } from "./api";

const unitOf: Record<string, string> = { map: "mmHg", utpi: "", plgf: "pg/mL" };

export function HowItWorks({ r, f, lang }: { r: AssessmentOut; f: FormState; lang: Lang }) {
  const L = (k: Key) => t(lang, k);
  const g = (r.ga_days / 7).toFixed(2);
  const mu = r.prior_mean_weeks;
  const sd = r.prior_sd_weeks;
  const r37 = r.maternal_factors_only.find((e) => e.cutoff_weeks === 37)!;
  const pairs = bpPairs(f);

  const datingLine = (() => {
    switch (r.dating_method) {
      case "crl":
        return `GA = 8.052 × √${f.crl_mm} + 23.73 = ${r.ga_days.toFixed(1)} ${L("days")} (${r.ga_label})`;
      case "bpd":
        return `GA = (${f.bpd_mm} + 16.338) / 0.4299 = ${r.ga_days.toFixed(1)} ${L("days")} (${r.ga_label})`;
      case "lmp":
        return `GA = ${L("gaLmp")} = ${r.ga_days} ${L("days")} (${r.ga_label})`;
      case "edd":
        return `GA = 280 − (EDD − ${L("gaEdd")}) = ${r.ga_days} ${L("days")} (${r.ga_label})`;
      case "ivf":
        return `GA = (${L("gaIvf")}) + ${f.embryo_age_days} + 14 = ${r.ga_days} ${L("days")} (${r.ga_label})`;
      default:
        return `GA = ${r.ga_label}`;
    }
  })();

  return (
    <details className="card how">
      <summary><h2>{t(lang, "howTitle")}</h2></summary>

      <h3>1. {L("howGa")}</h3>
      <p className="formula">{datingLine}</p>

      {r.map_mmhg !== null && (
        <>
          <h3>2. {L("howMap")}</h3>
          <p className="formula">MAP = DBP + (SBP − DBP) / 3</p>
          {pairs.length > 0 && (
            <p className="formula small">
              {pairs.map(([s, d]) => `${d} + (${s} − ${d})/3 = ${(d + (s - d) / 3).toFixed(1)}`).join(" · ")} → {L("mean")} {r.map_mmhg}
            </p>
          )}
        </>
      )}

      {Object.keys(r.moms).length > 0 && (
        <>
          <h3>3. MoM ({L("howMom")})</h3>
          <p className="formula">MoM = {L("momRatio")}; log₁₀(median) = a + b·(GA − 77) + c·(GA − 77)² + {L("maternalTerms")}</p>
          <table className="moms">
            <thead>
              <tr>
                <th>{L("marker")}</th>
                <th>{L("colMeasured")}</th>
                <th>{L("colExpected")}</th>
                <th>MoM</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.moms).map(([m, v]) => {
                const measured = m === "map" ? r.map_mmhg : m === "utpi" ? r.utpi_mean : r.plgf_pg_ml;
                return (
                  <tr key={m}>
                    <td>{markerName[m]}</td>
                    <td className="num">{measured ?? L("labMom")}</td>
                    <td className="num">{measured != null ? `${r.expected_medians[m]} ${unitOf[m]}` : "—"}</td>
                    <td className="num">{v.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Tan 2018, Appendix 1 (doi:10.1002/uog.19112)</p>
        </>
      )}

      <h3>4. {L("howPrior")}</h3>
      <p className="formula">T ~ N(μ, σ²), μ = Σ {L("terms")}, σ = {sd}</p>
      <table className="moms">
        <tbody>
          {r.prior_terms.map((p) => (
            <tr key={p.name}>
              <td>{loc(lang).priorTerms[p.name] ?? p.name}</td>
              <td className="num">{p.weeks >= 0 && p.name !== "intercept" ? "+" : ""}{p.weeks.toFixed(3)}</td>
            </tr>
          ))}
          <tr>
            <td><strong>μ</strong></td>
            <td className="num">{mu.toFixed(3)} {L("weeks")}</td>
          </tr>
        </tbody>
      </table>
      <p className="muted small">Wright 2015, Table 2 (doi:10.1016/j.ajog.2015.02.018)</p>

      <h3>5. {L("riskBefore37")}</h3>
      <p className="formula">P = [Φ((37 − μ)/σ) − Φ((g − μ)/σ)] / [1 − Φ((g − μ)/σ)], g = {g}</p>
      <p className="formula">
        = [Φ({((37 - mu) / sd).toFixed(3)}) − Φ({((r.ga_days / 7 - mu) / sd).toFixed(3)})] / [1 − Φ({((r.ga_days / 7 - mu) / sd).toFixed(3)})] = {r37.probability.toPrecision(3)} ≈ 1 / {r37.one_in}
      </p>

      <h3>6. {L("howBayes")}</h3>
      <p className="formula">p(t | MoMs) ∝ φ((t − μ)/σ) × N(log₁₀ MoM; m(t), Σ), t &gt; g</p>
      <p className="formula">
        m(t) = b₀ + b₁·t ({L("whileNeg")}): MAP 0.088997 − 0.0016711·t; UtA-PI 0.5861 − 0.014233·t; PlGF −0.92352 + 0.021584·t
      </p>
      <p className="formula">
        P(PE &lt; 37) = ∫<sub>g</sub><sup>37</sup> p(t | MoMs) dt / ∫<sub>g</sub><sup>∞</sup> p(t | MoMs) dt
        {r.combined && ` = ${r.combined[1].probability.toPrecision(3)} ≈ 1 / ${r.combined[1].one_in}`}
      </p>
      <p className="muted small">
        {L("bayesNote")}
      </p>
    </details>
  );
}
