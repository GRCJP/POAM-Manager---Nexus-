# Baseline Checkpoint (Working)

This file records the known-good baseline for the POAM skills pipeline.

## Git References

- Baseline tag: `baseline-working-2026-03-17`
- Baseline branch: `baseline/working-2026-03-17`
- Baseline commit: `17d75ee`

## What This Baseline Includes

- Main app and test pipeline aligned to the same skills logic.
- CSV parsing fixed for quoted fields and embedded commas.
- Header mapping fixed to avoid `TruRisk Score` being used as severity.
- Status default behavior aligned to `ACTIVE` when missing.
- Skills order aligned in app pipeline: `SLA -> Classification -> Grouping -> POAMBuilder`.
- Weighted POAM severity logic based on grouped finding distribution.

## Known-Good Validation Snapshot

Using the sample Qualys CSV:

`Sample Scan/VM_vulns_fecfe3hp_20260316 (1)_SCRUBBED_20260316_222744.csv`

Expected (skills test path):

- Total findings: `46570`
- Eligible findings: `46570`
- Groups created: `450`
- POAMs created: `443`
- Groups skipped: `7`

## Restore / Start From Baseline

### Option A: Checkout baseline tag (immutable)

```bash
git fetch --all --tags
git checkout baseline-working-2026-03-17
```

### Option B: Start new work from baseline branch

```bash
git fetch --all
git checkout baseline/working-2026-03-17
git checkout -b feature/<your-next-change>
```

## Recommended Backup Practice

- Keep this tag immutable.
- Create a new tag for each known-good milestone.
- Export app data backup from UI after major imports (Backup button in Vulnerability Tracking).
