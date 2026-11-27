# Tests: `tests/`

84 `unittest` cases, standard library only, with no network and no credits. CI runs them on every pull request, on
Python 3.9 to 3.13.

```bash
cd higgsfield-director && python3 -m unittest discover -s tests -v
```

```mermaid
flowchart LR
    PR([pull request]) --> CI[GitHub Actions]
    CI --> P39[Python 3.9] & P310[3.10] & P311[3.11] & P312[3.12] & P313[3.13]
    P39 & P310 & P311 & P312 & P313 --> OK{84 tests pass?}
    OK -- yes --> M([ready for review])
    OK -- no --> F([the pull request shows the failure])
```

| Group | Tests | What it protects |
|---|---:|---|
| Camera | 6 | a negation ("static camera, no orbit") is not a conflict; phases are allowed; two moves at once warn and never block |
| Model and audio | 11 | durations, aspect ratios and resolutions within the model; audio as each model takes it; image-to-video modes |
| Continuity | 6 | bibles repeat in every shot; fixed attributes; declared changes; the 180° axis |
| Rules | 7 | dialogue that fits the duration and has a speaker; no overlapping timeline; no empty lines from empty fields |
| Calculations | 4 | the budget refuses to guess a price; the optics formulas; a score needs evidence |
| Files | 7 | export; importing the catalog; the templates validate on the real snapshot; exit codes |
| Robustness | 4 | wrong shapes become listed errors, never a traceback |
| Review | 7 | budget rounding, attempts, subtitles; an import that never touches the skill folder and keeps the models it did not bring |
| Skill | 3 | the frontmatter; every path `SKILL.md` and the guides cite exists; `SKILL.md` stays under 200 lines |
| Modes and calibration | 11 | the first-use question asks only the working mode; the preferences file refuses a spending field; the blind draw keeps its key closed |
| Old names | 8 | the Portuguese commands, fields and files from before 6.0 still work, with a warning |
| Crop | 4 | a valid box becomes a crop command; an invalid one is an error with no command |
| Security regressions | 6 | huge numbers, non-finite JSON and oversized files are refused before they cost memory |

A test is worth what it catches: when 5.0.0 was written, 4 defects were planted in the code on purpose, and the tests
caught all 4 ([CHANGELOG](../../CHANGELOG.md)). The checks of the rest of the repository are in [`tools/`](../../tools/README.md).
