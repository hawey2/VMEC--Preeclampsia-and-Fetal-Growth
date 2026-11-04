import { markerName, t, type Lang } from "./i18n";
import type { AssessmentOut, FormState } from "./types";
import { bpPairs } from "./api";

const termLabel: Record<string, [string, string]> = {
  intercept: ["Hằng số (nhóm tham chiếu)", "Intercept (reference group)"],
  age_over_35: ["Tuổi > 35: −0.2069 × (tuổi − 35)", "Age > 35: −0.2069 × (age − 35)"],
  height: ["Chiều cao: +0.1171 × (cm − 164)", "Height: +0.1171 × (cm − 164)"],
  weight: ["Cân nặng: −0.0694 × (kg − 69)", "Weight: −0.0694 × (kg − 69)"],
  ethnicity: ["Chủng tộc", "Ethnicity"],
  chronic_hypertension: ["Tăng huyết áp mạn: −7.2897", "Chronic hypertension: −7.2897"],
  sle_or_aps: ["SLE hoặc APS: −3.0519", "SLE or APS: −3.0519"],
  ivf: ["IVF: −1.6327", "IVF: −1.6327"],
  parous_previous_pe: ["Đã sinh, có TSG: −8.1667 + 0.0272 × (tuổi thai trước − 24)²", "Parous with PE: −8.1667 + 0.0272 × (prev GA − 24)²"],
  parous_no_previous_pe: [
    "Đã sinh, không TSG: −4.335 − 4.1514/khoảng cách + 9.2147/√khoảng cách + 0.0155 × (tuổi thai trước − 24)²",
    "Parous, no PE: −4.335 − 4.1514/interval + 9.2147/√interval + 0.0155 × (prev GA − 24)²",
  ],
  family_history_pe: ["Mẹ bị TSG: −1.7154", "Mother had PE: −1.7154"],
  diabetes: ["Đái tháo đường: −3.3899", "Diabetes: −3.3899"],
};

const unitOf: Record<string, string> = { map: "mmHg", utpi: "", plgf: "pg/mL" };

export function HowItWorks({ r, f, lang }: { r: AssessmentOut; f: FormState; lang: Lang }) {
  const vi = lang === "vi";
  const g = (r.ga_days / 7).toFixed(2);
  const mu = r.prior_mean_weeks;
  const sd = r.prior_sd_weeks;
  const r37 = r.maternal_factors_only.find((e) => e.cutoff_weeks === 37)!;
  const pairs = bpPairs(f);

  const datingLine = (() => {
    switch (r.dating_method) {
      case "crl":
        return `GA = 8.052 × √${f.crl_mm} + 23.73 = ${r.ga_days.toFixed(1)} ${vi ? "ngày" : "days"} (${r.ga_label})`;
      case "bpd":
        return `GA = (${f.bpd_mm} + 16.338) / 0.4299 = ${r.ga_days.toFixed(1)} ${vi ? "ngày" : "days"} (${r.ga_label})`;
      case "lmp":
        return `GA = ${vi ? "ngày khám − kỳ kinh cuối" : "exam date − LMP"} = ${r.ga_days} ${vi ? "ngày" : "days"} (${r.ga_label})`;
      case "edd":
        return `GA = 280 − (EDD − ${vi ? "ngày khám" : "exam date"}) = ${r.ga_days} ${vi ? "ngày" : "days"} (${r.ga_label})`;
      case "ivf":
        return `GA = (${vi ? "ngày khám − ngày chuyển phôi" : "exam − transfer"}) + ${f.embryo_age_days} + 14 = ${r.ga_days} ${vi ? "ngày" : "days"} (${r.ga_label})`;
      default:
        return `GA = ${r.ga_label}`;
    }
  })();

  return (
    <details className="card how">
      <summary><h2>{t(lang, "howTitle")}</h2></summary>

      <h3>1. {vi ? "Tuổi thai" : "Gestational age"}</h3>
      <p className="formula">{datingLine}</p>

      {r.map_mmhg !== null && (
        <>
          <h3>2. {vi ? "Huyết áp động mạch trung bình" : "Mean arterial pressure"}</h3>
          <p className="formula">MAP = DBP + (SBP − DBP) / 3</p>
          {pairs.length > 0 && (
            <p className="formula small">
              {pairs.map(([s, d]) => `${d} + (${s} − ${d})/3 = ${(d + (s - d) / 3).toFixed(1)}`).join(" · ")} → {vi ? "trung bình" : "mean"} {r.map_mmhg}
            </p>
          )}
        </>
      )}

      {Object.keys(r.moms).length > 0 && (
        <>
          <h3>3. MoM ({vi ? "bội số của trung vị" : "multiple of the median"})</h3>
          <p className="formula">MoM = {vi ? "giá trị đo / trung vị kỳ vọng" : "measured / expected median"}; log₁₀(median) = a + b·(GA − 77) + c·(GA − 77)² + {vi ? "các hệ số mẹ" : "maternal terms"}</p>
          <table className="moms">
            <thead>
              <tr>
                <th>{vi ? "Chỉ số" : "Marker"}</th>
                <th>{vi ? "Đo" : "Measured"}</th>
                <th>{vi ? "Trung vị kỳ vọng" : "Expected median"}</th>
                <th>MoM</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.moms).map(([m, v]) => {
                const measured = m === "map" ? r.map_mmhg : m === "utpi" ? r.utpi_mean : r.plgf_pg_ml;
                return (
                  <tr key={m}>
                    <td>{markerName[m]}</td>
                    <td className="num">{measured ?? (vi ? "MoM xét nghiệm" : "lab MoM")}</td>
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

      <h3>4. {vi ? "Phân bố tiên nghiệm từ yếu tố mẹ" : "Prior from maternal factors"}</h3>
      <p className="formula">T ~ N(μ, σ²), μ = Σ {vi ? "các hệ số" : "terms"}, σ = {sd}</p>
      <table className="moms">
        <tbody>
          {r.prior_terms.map((p) => (
            <tr key={p.name}>
              <td>{(termLabel[p.name] ?? [p.name, p.name])[vi ? 0 : 1]}</td>
              <td className="num">{p.weeks >= 0 && p.name !== "intercept" ? "+" : ""}{p.weeks.toFixed(3)}</td>
            </tr>
          ))}
          <tr>
            <td><strong>μ</strong></td>
            <td className="num">{mu.toFixed(3)} {vi ? "tuần" : "weeks"}</td>
          </tr>
        </tbody>
      </table>
      <p className="muted small">Wright 2015, Table 2 (doi:10.1016/j.ajog.2015.02.018)</p>

      <h3>5. {vi ? "Nguy cơ trước 37 tuần" : "Risk before 37 weeks"}</h3>
      <p className="formula">P = [Φ((37 − μ)/σ) − Φ((g − μ)/σ)] / [1 − Φ((g − μ)/σ)], g = {g}</p>
      <p className="formula">
        = [Φ({((37 - mu) / sd).toFixed(3)}) − Φ({((r.ga_days / 7 - mu) / sd).toFixed(3)})] / [1 − Φ({((r.ga_days / 7 - mu) / sd).toFixed(3)})] = {r37.probability.toPrecision(3)} ≈ 1 / {r37.one_in}
      </p>

      <h3>6. {vi ? "Kết hợp chỉ số sinh học (Bayes)" : "Combining biomarkers (Bayes)"}</h3>
      <p className="formula">p(t | MoMs) ∝ φ((t − μ)/σ) × N(log₁₀ MoM; m(t), Σ), t &gt; g</p>
      <p className="formula">
        m(t) = b₀ + b₁·t {vi ? "khi" : "while"} &lt; 0 ({vi ? "sau đó" : "then"} 0): MAP 0.088997 − 0.0016711·t; UtA-PI 0.5861 − 0.014233·t; PlGF −0.92352 + 0.021584·t
      </p>
      <p className="formula">
        P(PE &lt; 37) = ∫<sub>g</sub><sup>37</sup> p(t | MoMs) dt / ∫<sub>g</sub><sup>∞</sup> p(t | MoMs) dt
        {r.combined && ` = ${r.combined[1].probability.toPrecision(3)} ≈ 1 / ${r.combined[1].one_in}`}
      </p>
      <p className="muted small">
        {vi
          ? "Tham số m(t) và ma trận hiệp phương sai Σ lấy từ nguồn thứ cấp (PERiskProfileR, khớp với máy tính FMF trực tuyến ở ngưỡng 1/100 trong 4986/5000 ca mô phỏng). Nguồn gốc: O'Gorman 2016 (doi:10.1016/j.ajog.2015.08.034), cần đối chiếu với bản in trước khi dùng lâm sàng."
          : "m(t) and the covariance Σ come from a secondary source (PERiskProfileR, which matched the FMF online calculator at the 1 in 100 cut-off in 4986 of 5000 simulated cases). Primary source: O'Gorman 2016 (doi:10.1016/j.ajog.2015.08.034); check against the printed paper before clinical use."}
      </p>
    </details>
  );
}
