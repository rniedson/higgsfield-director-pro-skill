# Calibration records · Registros de calibração

Each file is one blind round, with and without the skill, run by someone who uses it. The scoreboard in the
[README](../README.md#calibration-scoreboard) is built from these files by `tools/agregar_calibracao.py`.

Cada arquivo é uma rodada às cegas, com e sem a skill, feita por alguém que a usa. O placar do
[README](../README.pt-BR.md#placar-da-calibração) sai destes arquivos pelo `tools/agregar_calibracao.py`.

## How to add yours · Como mandar o seu

1. Run a calibration: [`calibracao.md`](../higgsfield-director/references/calibracao.md).
2. Build the record with `hfd.py resultado ... --saida calibracao/YYYY-MM-DD-<category>-<suffix>.json`, then read it
   in full before sharing it.
3. Run `python3 tools/agregar_calibracao.py --escrever` to refresh both READMEs, then `python3 tools/checar_repo.py`.
4. Open a pull request with the record and the two README changes. See [CONTRIBUTING](../CONTRIBUTING.md).

The record holds only the allowlisted fields (date, skill version, request type, model, shots, credits, whether a
reference image was used, the vote, the order seen, an optional short reason and the reviewer's scores). It never
holds the request text, prompts, media, names, clients, brands, links, e-mail addresses or file paths; CI rejects any
other field.

O registro guarda só os campos da lista branca. Nunca o texto do pedido, os prompts, a mídia, nomes, clientes,
marcas, links, e-mails ou caminhos de arquivo; o CI recusa qualquer outro campo.

## The first records · Os primeiros registros

`2026-11-24-*-b1r1` is the first round, which the skill lost. `b2r1` and `b2r2` are the rematch after the fixes. They
were run by the maintainers, with one voter, so the sample is small.

`b1r1` é a primeira rodada, que a skill perdeu; `b2r1` e `b2r2` são a revanche depois das correções. Foram feitas pelos
mantenedores, com uma pessoa votando, então a amostra é pequena.
