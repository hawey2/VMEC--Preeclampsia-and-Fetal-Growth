# Vinmec preeclampsia risk calculator

Decision-support app for the Department of Obstetrics, Vinmec Ocean Park 2. It reimplements the
Fetal Medicine Foundation (FMF) competing-risks model for preeclampsia from published papers,
prints an A4 report for doctors, and stores assessments in an on-premise database.

> **Not for clinical use.** This is a research build. Risks must not guide treatment until every
> coefficient set is verified against the printed papers, results match the FMF calculator within
> an agreed tolerance, and Vinmec has approved clinical use. See [docs/coefficients.md](docs/coefficients.md).

Full plan and build draft (scope, model, architecture, database schema, report layout):
[Preeclampsia Risk Calculator: Plan and Build Draft](https://claude.ai/artifact/3V88CyXtFYyxDFsc1MkDMV).

## Status

| Phase | What | State |
| --- | --- | --- |
| 1 | Risk engine, 11+0 to 13+6 weeks | In review |
| 2 | Web form and A4 print | Not started |
| 3 | PostgreSQL, sign-in, audit, on-premise package | Not started |
| 4 | Side-by-side validation with the FMF calculator | Not started |
| 5 | 19-24, 30-34, 35-37 week modules | Not started |
| 6 | Outcome capture and calibration audit | Not started |

## Risk engine (`engine/`)

```bash
cd engine
pip install -e '.[test]'
pytest
```

```python
from pe_risk import *

mf = MaternalFactors(age_years=32, weight_kg=58, height_cm=156, ethnicity=Ethnicity.EAST_ASIAN)
report = assess(Assessment(ga_days=86, maternal=mf,
                           biomarkers=Biomarkers(map_mmhg=84, utpi_left=1.7, utpi_right=1.9,
                                                 plgf_pg_ml=32, plgf_analyser=Analyser.COBAS_E411)))
report.maternal_factors_only   # risk of PE <32 and <37 weeks from maternal factors
report.moms                    # MAP, UtA-PI, PlGF MoMs
report.combined                # None until the biomarker likelihood parameters are filled in
report.warnings                # why the result is not clinical-grade
```

What it does today:

- Prior distribution of gestational age at delivery with PE from maternal factors (Wright 2015).
- MoMs for MAP, UtA-PI and PlGF (DELFIA, Kryptor, Roche Cobas e411) from Tan 2018, Appendix 1.
- CRL dating (Robinson 1975).
- Bayes combination by numerical integration, tested with synthetic parameters, including a
  simulation calibration check.
- Every result carries the coefficient set label and SHA-256 checksum for the printed report.

What it cannot do yet: combine biomarkers with the prior, because the published likelihood
parameters (O'Gorman 2016) could not be accessed. The engine reports this in `warnings` and
returns `combined = None` rather than guessing.
