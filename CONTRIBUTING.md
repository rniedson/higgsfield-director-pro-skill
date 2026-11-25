# Contributing

Thanks for helping. Issues and pull requests are welcome in English or Portuguese.

## Run the checks

There is nothing to install. The skill uses only the Python standard library (3.9 or later).

```bash
cd higgsfield-director && python3 -m unittest discover -s tests -v   # hfd.py and skill format
cd .. && python3 tools/checar_repo.py                               # JSON, links and anchors
```

CI runs both on every push and pull request.

## Rules for changes

- **Credits are spent only after the cost is shown and the operator says "ok".** A change that weakens this
  rule, in `SKILL.md`, in the references or in the code, will not be merged.
- **`hfd.py` stays offline and stdlib-only.** It reads and writes only the paths it is given, never inside the skill
  folder unless the path is passed explicitly. The one default path is `preferencias`, which uses
  `.higgsfield-director/preferencias.json` in the current folder.
- **The preference file never authorizes spending.** It stores how the operator wants to work, nothing else; a change
  that lets it carry a ceiling or a budget will not be merged.
- **Keep the project clearly unofficial.** Do not add Higgsfield's logo or wording that suggests the skill is
  official, endorsed or supported by Higgsfield. Use the name only to say which service the skill works with. Keep
  the notice at the top of both READMEs, the *Disclaimer* / *Aviso* sections and the line at the top of `SKILL.md`.
- **Every bug fix comes with a test that fails before the fix.** Add one for each defect you correct.
- **Model capabilities come from the catalog.** Use the live `models_explore` or the dated snapshot, never memory.
  To refresh the bundled snapshot, follow "Atualizar o retrato" in `references/modelos.md`.
- **Keep `SKILL.md` lean.** At most 200 lines; detail goes into `references/`, which the agent reads on demand. The
  `description` has at most 1024 characters and is a quoted YAML string.
- **The two READMEs move together.** A change to `README.md` needs the same change in `README.pt-BR.md`.
- **Never commit** generated media, API keys, tokens, signed URLs, or prompts and images that belong to a client.
- Add a line to `CHANGELOG.md` under *Unreleased*.

## Contribute a calibration result

A blind round, with and without the skill, on a request of your own, is the most useful contribution: it shows where
the skill wins and where it loses. The steps are in
[`references/calibracao.md`](higgsfield-director/references/calibracao.md).

1. Build the record with `hfd.py resultado`. It writes only allowlisted fields: date, skill version, request type,
   model, shots, credits, whether a reference image was used, the vote, which version was seen first, an optional
   reason of up to 160 characters, and the blind reviewer's scores.
2. **Read the whole record before you share it.** Never add the request text, prompts, images, videos, names,
   clients, brands, links, e-mail addresses or file paths. CI rejects any field outside the allowlist.
3. Put it in `calibracao/` as `YYYY-MM-DD-<category>-<suffix>.json`, run `python3 tools/agregar_calibracao.py
   --escrever` to refresh the scoreboard in both READMEs, and run the checks above.
4. Open a pull request with the record and the two README changes. A round where the skill lost is just as welcome:
   it is how the next fix gets found.

## License

Contributions are accepted under the license of the files they change (see *Licensing* in the README).
