# Coefficient provenance and verification

All numbers live in [`engine/pe_risk/coefficients/fmf_11_13_v1.json`](../engine/pe_risk/coefficients/fmf_11_13_v1.json).
Each component has a `verification` level. The engine warns on every result until all are `verified`.

| Component | Source | Level | Action needed |
| --- | --- | --- | --- |
| Prior (maternal factors) | Wright 2015, AJOG 213:62, Table 2 ([doi](https://doi.org/10.1016/j.ajog.2015.02.018)) | `transcribed_signs_inferred` | Check every sign against the printed Table 2 (see below) |
| MoM equations: MAP, UtA-PI, PlGF | Tan 2018, UOG 52:186, Appendix 1 ([doi](https://doi.org/10.1002/uog.19112)) | `transcribed` | Second-person check against the printed appendix |
| Biomarker likelihood in PE (mean log10 MoM vs GA at delivery, covariance) | Secondary: [PERiskProfileR](https://github.com/andjar/PERiskProfileR) "Details" vignette; primary believed to be O'Gorman 2016, AJOG 214:103 ([doi](https://doi.org/10.1016/j.ajog.2015.08.034)) | `secondary_source` | Check against the printed O'Gorman 2016 tables |
| MoM truncation limits (log10 MoM: MAP ±0.1224, UtA-PI ±0.4216, PlGF ±0.5655) | Same secondary source | `secondary_source` | Confirm against FMF's published limits |
| CRL dating | Robinson & Fleming 1975 | `transcribed` | None beyond the second check |

## Why the prior signs are flagged

The copy of Wright 2015 we could read lost minus signs in the coefficient column. Signs were set
from each row's 95% confidence interval and the paper's text, for example the text states the
chronic hypertension effect as "−7.3 (95% CI −7.9 to −6.7)". Two choices deserve a specific check:

1. **Parous, no previous PE.** Read as `−4.3350 − 4.1514·interval⁻¹ + 9.2147·interval⁻⁰·⁵ + 0.0155·(GA−24)²`.
   With positive powers the model would make long intervals strongly harmful, which contradicts
   the paper's statement that a protective effect persists beyond 15 years.
2. **Interval floor.** The fractional polynomial diverges near zero, so intervals below 0.25 years
   are raised to 0.25 with a warning. The paper does not say how FMF handles this.

## Roche analyser

Tan 2018 gives a PlGF intercept for **Cobas e411** (Roche Elecsys PlGF), so raw Roche results can be
converted to MoMs. Vinmec should still confirm which analyser and reagent lot its lab uses.

## Asian population

Chaemsaithong 2020 found MAP MoMs about 4% lower and PlGF MoMs about 11% lower than the European
equations predict in East and Southeast Asian women. Vinmec should audit its own MoM medians once
a few hundred screens are recorded, before relying on the risk cut-off.

## How to mark a component verified

1. A second person compares every number and sign in the JSON with the printed source.
2. Change its `verification` to `verified` in a pull request that names the checker.
3. Update `tests/test_coefficients.py::test_nothing_is_marked_clinical_ready_yet` in the same PR.

## Biomarker likelihood (secondary source)

The O'Gorman 2016 tables are behind a subscription. The numbers in `likelihood` come from the
PERiskProfileR R package (GPL-3.0), whose validation article compares its formula-based risks
with the FMF online calculator on 5000 simulated women: at the 1 in 100 cut-off the two agreed
in 4986 cases, and in the other 14 the formula said high risk where the FMF site said low.

In PE, the mean log10 MoM is a line in gestational age at delivery `t` (weeks), and 0 once the
line reaches 0:

| Marker | b0 | b1 per week | Reaches 0 at |
| --- | --- | --- | --- |
| MAP | 0.088997 | −0.0016711 | 53.3 w |
| UtA-PI | 0.5861 | −0.014233 | 41.2 w |
| PlGF | −0.92352 | 0.021584 | 42.8 w |

Covariance of log10 MoM (MAP, UtA-PI, PlGF): diagonal 0.00141396, 0.01630906, 0.03147225;
MAP–UtA-PI −0.0002726, MAP–PlGF −0.0001907, UtA-PI–PlGF −0.0034539.

Before clinical use, a second person should check these against the printed paper and mark the
component `verified`.
