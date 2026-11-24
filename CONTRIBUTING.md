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
  folder unless the path is passed explicitly.
- **Every bug fix comes with a test that fails before the fix.** Add one for each defect you correct.
- **Model capabilities come from the catalog.** Use the live `models_explore` or the dated snapshot, never memory.
  To refresh the bundled snapshot, follow "Atualizar o retrato" in `references/modelos.md`.
- **Keep `SKILL.md` lean.** At most 200 lines; detail goes into `references/`, which the agent reads on demand. The
  `description` has at most 1024 characters and is a quoted YAML string.
- **The two READMEs move together.** A change to `README.md` needs the same change in `README.pt-BR.md`.
- **Never commit** generated media, API keys, tokens, signed URLs, or prompts and images that belong to a client.
- Add a line to `CHANGELOG.md` under *Unreleased*.

## License

Contributions are accepted under the license of the files they change (see *Licensing* in the README).
