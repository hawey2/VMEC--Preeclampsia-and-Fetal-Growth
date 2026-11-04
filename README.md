# Vinmec preeclampsia risk calculator

Decision-support app for the Department of Obstetrics, Vinmec Ocean Park 2. It reimplements the
Fetal Medicine Foundation (FMF) competing-risks model for preeclampsia from published papers,
prints an A4 report for doctors, and stores assessments in an on-premise database.

> **Not for clinical use.** This is a research build. Risks must not guide treatment until every
> coefficient set is verified against the printed papers, results match the FMF calculator within
> an agreed tolerance, and Vinmec has approved clinical use. See [docs/coefficients.md](docs/coefficients.md).

Plans: [Plan and Build Draft](https://claude.ai/artifact/3V88CyXtFYyxDFsc1MkDMV) (model, scope, report) and
[Build and deploy plan](https://claude.ai/artifact/Wmig1H4MJ257rVowTXo4cv) (database, sign-in, deployment, validation).

## Status

| Phase | What | State |
| --- | --- | --- |
| 1 | Risk engine, 11+0 to 13+6 weeks | In review |
| 2 | Web form, charts, formulas and A4 print (VI / EN) | In review |
| 3 | PostgreSQL, Vinmec sign-in (LDAP), records, sign-off, outcomes, audit log | In review |
| 4 | Docker deployment on the hospital server | Files ready ([deploy/](deploy/README.md)); waiting for a server |
| 5 | Validation on Vinmec outcomes, recalibration if needed | Not started (needs ethics approval) |

## Standalone website

A separate version of the calculator that needs no server, sign-in or database. It is a single HTML
file: the risk is calculated in the browser, nothing is saved or sent anywhere, and the report prints
the same way. Open it from a USB stick or a shared folder, or publish it as a website.

```bash
cd web && npm ci && npm run build:standalone   # → web/dist-standalone/index.html
```

- **Website:** `.github/workflows/standalone-site.yml` publishes it to GitHub Pages. Turn it on once in
  the repository's Settings → Pages → Source: "GitHub Actions", then run the workflow (it also runs on
  every push to `main`).
- **Same numbers as the server:** the browser engine (`web/src/engine/`) is a copy of the Python
  engine. `web/tests/parity.test.ts` checks it against the Python API on 300 generated cases
  (`web/tests/make_parity_cases.py`), and CI fails if the cases are out of date.

## Run the app locally

```bash
pip install -e engine -e api
(cd web && npm ci && npm run build)
uvicorn pe_api.main:app --app-dir api --port 8000
# open http://localhost:8000 and sign in as sono/sono, doctor/doctor or admin/admin
```

Locally the app uses SQLite (`pe_local.db`) and three test accounts (`PE_AUTH_MODE=dev`). In the hospital it
uses PostgreSQL and Vinmec accounts over LDAP: see [deploy/README.md](deploy/README.md).
For front-end work, run `npm run dev` in `web/` (it proxies `/api` to port 8000).

- **Roles:** sonographers screen, save, print and enter outcomes; doctors can also sign; administrators see the
  audit log, the user list and the de-identified research export, and do not screen.
- **Records:** a screening is saved with its PID, full inputs, full result and coefficient checksum. A saved
  screening is never edited: a change is saved as a new version that replaces it. Printing saves first, so every
  printed report carries a record number.
- **Outcomes:** delivery date and gestational age, PE yes/no and when, aspirin yes/no, entered per screening.
- **Audit log:** every sign-in (and failed attempt), view, save, new version, sign, print, outcome and export.
  On PostgreSQL a trigger makes it append-only.
- **Sessions** end after 15 idle minutes (`PE_SESSION_IDLE_MINUTES`).

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

