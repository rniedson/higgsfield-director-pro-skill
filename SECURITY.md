# Security policy

## Reporting a vulnerability

Report privately through GitHub: open the **Security** tab and choose **Report a vulnerability**. Please do not
open a public issue for a vulnerability.

This is an independent, unofficial project, not affiliated with Higgsfield, maintained on a best-effort basis. Reports are read and answered as soon as
possible.

## In scope

- `hfd.py` reading or writing outside the paths it is given, reaching the network, or running code taken from a
  project file.
- Injection into exported files (`shots.csv`, `script.md`, `subtitles.srt`).
- Instructions in the skill that would let an agent generate or spend credits without showing the cost and getting
  an explicit "ok", or treat text from a page, file or model output as instructions.
- Credentials or private data leaking into prompts, exports or logs.

## Out of scope

The Higgsfield service, website, account system and MCP connector belong to Higgsfield, not to this project.
Report problems with them, including vulnerabilities, directly to Higgsfield.
