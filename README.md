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
| 2 | Web form and A4 print | In review |
| 3 | PostgreSQL, sign-in, audit, on-premise package | Not started |
| 4 | Side-by-side validation with the FMF calculator | Not started |
| 5 | 19-24, 30-34, 35-37 week modules | Not started |
| 6 | Outcome capture and calibration audit | Not started |

## Run the app locally

```bash
pip install -e engine -e api
(cd web && npm ci && npm run build)
uvicorn pe_api.main:app --app-dir api --port 8000
# open http://localhost:8000
```

For front-end work, run `npm run dev` in `web/` (it proxies `/api` to port 8000).
The aspirin cut-off defaults to 1 in 100 for PE <37 weeks; set `PE_CUTOFF_ONE_IN` to change it.

- **Form**: the FMF fields in Vietnamese or English, dating by CRL, LMP, EDD, IVF transfer date or manual GA.
  BPD and HC are shown but disabled until a chart is chosen.
- **Results**: risk of PE <32 and <37 weeks, screen result against the cut-off, MoMs, suggested action and technical notes.
- **Print**: "In báo cáo" opens a one-page A4 bilingual report with patient block, maternal factors,
  biomarkers, risks, screen result, signature lines, disclaimer and model checksum.
- Phase 2 stores nothing; the database, sign-in and audit log arrive in phase 3.

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
report.combined                # risk of PE <32 and <37 weeks from maternal factors + biomarkers
report.warnings                # why the result is not clinical-grade
```

What it does today:

- Prior distribution of gestational age at delivery with PE from maternal factors (Wright 2015).
- MoMs for MAP, UtA-PI and PlGF (DELFIA, Kryptor, Roche Cobas e411) from Tan 2018, Appendix 1.
- CRL dating (Robinson 1975).
- Bayes combination by numerical integration, tested with synthetic parameters, including a
  simulation calibration check.
- Every result carries the coefficient set label and SHA-256 checksum for the printed report.

Biomarker likelihood parameters come from a secondary source that matches the FMF online
calculator (see `docs/coefficients.md`). Until a second person checks them against O'Gorman 2016,
every result says it is not for clinical use.

## Languages

Vietnamese and English are kept apart, on screen, on paper and in the code:

- `web/src/locales/vi.ts`: every Vietnamese word the app shows, including option lists, the
  screening protocols, the "How it is calculated" labels and translations of engine/API messages.
- `web/src/locales/en.ts`: the same keys in English. It is typed against `vi.ts`, so the build
  fails if a key is missing or misspelled in either file.
- Components only look text up by key (`t(lang, "key")`, `loc(lang).info`). They contain no
  inline Vietnamese or English sentences.
- The printed report uses one language: the screen language, or the other one from the
  second print button.

