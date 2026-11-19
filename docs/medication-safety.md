# Medication and interaction check

The calculator now checks the medicines, injectables, foods and supplements a patient takes against a
small, sourced rule base for the preeclampsia pathway. It runs in the browser, in the server build and in
the standalone file. It is **not verified**: `KB_META.verified` is `false` and the card says so until a
Vinmec clinical pharmacist and obstetrician sign the rules off.

## Where things live

| Path | What |
| --- | --- |
| [`web/src/meds/kb.ts`](../web/src/meds/kb.ts) | Items (regular medicines, ward injectables, foods and supplements), rules, sources. Vietnamese and English side by side per rule. |
| [`web/src/meds/check.ts`](../web/src/meds/check.ts) | `checkMeds(selected, {phase, flags})`: pure function, most severe first. `unmatched()` lists items no rule mentions. |
| [`web/src/MedCheck.tsx`](../web/src/MedCheck.tsx) | The card (stage, patient conditions, item lists, findings) and the lines printed on the A4 report. |
| [`web/tests/meds.test.ts`](../web/tests/meds.test.ts) | Rule-base integrity (ids, references, sources, both languages) and behaviour of each rule family. |

The interaction table that used to be written out in both locale files is gone: every rule is defined once,
in `kb.ts`.

## How a rule works

```ts
{ id: "mg_oliguria", level: "avoid", actor: "nurse", evidence: "mechanism",
  all: ["magnesium"], flags: ["oliguria"], effect: {vi, en}, manage: {vi, en}, sources: ["mgso4", "label"] }
```

- `all`: every reference must match a **different** selected item, by id or by group (`nsaid`, `ccb`,
  `beta_blocker`…). Aspirin is in `antiplatelet`, not `nsaid`, so it never matches a rule about other NSAIDs.
- `phases` (before 20 weeks, 20 to 35+6, from 36, after delivery) and `flags` (severe hypertension,
  oliguria, coagulopathy, asthma, neuraxial planned) narrow when the rule applies. A rule with no items and
  a flag fires on the condition alone (the 60-minute treatment reminder).
- `level`: `avoid` > `caution` > `separate` > `info`. `actor`: who acts (prescriber, nurse or midwife,
  anaesthetist). `evidence`: trial in pregnancy, non-pregnant data, mechanism, or guideline.

## Design decisions

1. **Severity comes from the rule base, never from a language model.** Published LLM evaluations show
   DDI detection below 26% accuracy and inconsistent results between runs.
2. **Show only what applies.** The old card listed all 12 interactions to everyone. Override studies put
   ignored drug alerts at 49–96%, mostly because of low specificity. Only `avoid` should ever interrupt a
   workflow once this is wired into ordering.
3. **No record is not safe.** Selected items no rule mentions are listed as "no record in the knowledge
   base (this does not mean safe)".
4. **Check at the point of administration, not only at prescribing.** Magnesium sulphate errors happen
   while mixing and setting pumps; 60% of smart-pump infusions in a 10-hospital study had an error.
   Injectables therefore have their own list and nurse-facing rules.
5. **Context changes the answer.** NSAIDs are avoided from 20 weeks, yet three RCTs found postpartum
   ibuprofen safe for blood pressure in hypertensive disorders of pregnancy. ACE inhibitors are
   contraindicated antenatally only.
6. **Print what was reviewed.** The A4 report lists the stage, the conditions and the items, every `avoid`
   warning with its management, and `caution`/`separate` pairs on one line each. Seven items with six
   `avoid` warnings still fit on one page; eight or more `avoid` warnings move the end of the report to a
   second page.

## Not covered

- Y-site compatibility of IV drugs: needs a licensed source (or the hospital pharmacy's table).
- Dose calculation and pump settings: belong in the pump drug library and the hospital protocol.
- Medicines outside the list: the P-060 drug-interaction service could answer these later, marked as a
  secondary source and never deciding severity on this card.
- Saving the medication review with the screening record (see roadmap).

## Roadmap

| Step | What | Gate |
| --- | --- | --- |
| 1 (done) | Rule base, checker, card, print, tests | Pharmacist and obstetrician review; set `verified: true` in a PR that names them |
| 2 | Save the medication review with the screening (API `medications` field, new version on change, audit log entry); record aspirin adherence at follow-up visits in outcomes | Data-protection approval already needed for records |
| 3 | Silent mode on the ward: log which rules would fire for real orders, without showing them; count alerts per patient and override reasons | Agreed alert budget per patient |
| 4 | Read orders and administrations from the hospital system (HL7 FHIR `MedicationRequest`, `MedicationAdministration`) and show `avoid` rules at ordering and at the bedside scan | Step 3 shows acceptable alert volume |
| 5 | Measure: aspirin started by 16 weeks in screen-positive women, adherence, time from BP ≥160/110 to treatment, magnesium incidents | Baseline taken before step 4 |

## How to change a rule

1. Edit `kb.ts`; every rule needs at least one source and both languages.
2. `npm test` in `web/` checks references, sources and translations.
3. A pharmacist reviews the pull request. Until the whole base is signed off, `KB_META.verified` stays false
   and the card shows the warning.
