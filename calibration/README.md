# Calibration records

Each file is one blind round, with and without the skill, run by someone who uses it. The scoreboard in the
[README](../README.md#calibration-scoreboard) and in its
[Portuguese translation](../README.pt-BR.md#placar-da-calibração) is built from these files by
`tools/aggregate_calibration.py`.

## How to add yours

1. Run a calibration: [`calibration.md`](../higgsfield-director/references/calibration.md).
2. Build the record with `hfd.py result ... --out calibration/YYYY-MM-DD-<category>-<suffix>.json`, then read it
   in full before sharing it.
3. Run `python3 tools/aggregate_calibration.py --write` to refresh both READMEs, then `python3 tools/check_repo.py`.
4. Open a pull request with the record and the two README changes. See [CONTRIBUTING](../CONTRIBUTING.md).

The record holds only the allowlisted fields (date, skill version, request type, model, shots, credits, whether a
reference image was used, the vote, the order seen, an optional short reason and the reviewer's scores). It never
holds the request text, prompts, media, names, clients, brands, links, e-mail addresses or file paths; CI rejects any
other field.

## The first records

`2026-11-24-*-b1r1` is the first round, which the skill lost. `b2r1` and `b2r2` are the rematch after the fixes. They
were run by the maintainers, with one voter, so the sample is small.
