# Avaliação da RC3/RC4 (ChatGPT) e o que mudou na v5

24/11/2026. Pacote avaliado: a pasta baixada "Higgsfield Director PRO v4.1 RC3", gerada pelo ChatGPT. O pacote **não
está neste repositório**: fica na cópia local do operador. Abaixo, o que veio e o que aproveitamos de cada parte. Tudo
foi medido, e a última coluna das tabelas diz como.

## 0. O que veio no download e o que entrou no repositório

| Item baixado | O que é | No repositório? |
|---|---|---|
| `hfd-4.1-final-private/` (116 MB) | a RC3 completa: skill de 116 "comandos", scripts, catálogos, 165 imagens esquemáticas, relatórios, mais `history/` com 8 zips das versões v2.0 a v4.1-rc2, cada um dentro do outro (zip de origem `rc3-original.zip`, sha256 `6f19b4b3…`) | **Não.** O que tinha valor foi reescrito na v5 (§4). |
| `hfd-4.1-final-public-candidate/` (172 KB) | a RC4 "CORE": pacote Python com SDK, CLI, REST local, adaptador MCP e Docker (zip sha256 `97cdd2b5…`) | **Não.** Virou o `scripts/hfd.py`. REST, Docker e o MCP próprio saíram: o MCP que gera é o oficial do Higgsfield. |
| `hfd-AAA-public-review/` (292 KB) | a mesma RC4 (código e testes idênticos, conferidos com `diff`) + README de 86 KB + `docs/encyclopedia-previous.md` (76 KB) | **Não.** O vocabulário da enciclopédia já está em `references/vocabulario.md`. |
| `hfd-AAA-illustrated-private/` (3,4 MB) | o mesmo + `visual/`: 20 GIFs de movimento de câmera, 20 diagramas, 3 pranchas, 8 esferas de luz, 4 de óptica, 10 fichas, 100 estudos do atlas e 20 estudos de estilo, com catálogo e sha256 de cada um | **Sim, como manual ilustrado** (`docs/manual/`, decisão do operador): as 11 partes, o atlas e os diagramas, com as 185 imagens (sha256 conferido com o `MANIFEST.sha256` do pacote: 191/191 arquivos de `visual/`). Ficou fora a metade final do README dele: uma cópia do README da RC4 e a enciclopédia dos 116 comandos e dos scripts `studio.py`/`ultimate.py`/`master.py`, que não existem na v5. |
| `README-Higgsfield-Director-PRO.md` (19 KB) | o README desenhado: cabeçalho centralizado, selos, sumário, diagrama, tabelas, exemplos, seção em português | **O padrão, sim; o texto, não.** O texto descrevia SDK, REST e Docker que não existem mais. O `README.md` da raiz segue o mesmo desenho com o conteúdo da v5. |
| `download.svg` | o emblema (só formas e texto, sem script) | **Sim**, `docs/assets/emblema.svg`. |

Direitos das imagens: o próprio pacote declara que os ativos visuais são privados, esquemáticos (não são fotos nem
renders do Higgsfield) e sem autorização pública presumida (`VISUAL-RIGHTS.md`). Por isso eles não estão na licença
MIT do código: veja o README, seção de licenças.

## 1. Em uma frase

A RC3 tinha um bom esqueleto de método (briefing → tomadas → fichas de continuidade → custo → nota com evidência) e um
bom vocabulário de câmera e luz (o da v1), mas o resto era enchimento, os três compiladores erravam em casos comuns, o
conhecimento sobre modelos estava vazio e defasado, e nada falava com o conector oficial do Higgsfield. A v5 reescreve
enxuto, aproveitando ~15% do conteúdo.

## 2. Medições

| Item | Resultado | Como |
|---|---|---|
| Integridade | manifestos 31/31 e 18/18 OK; wheel igual ao código-fonte | `shasum -a 256 -c`; hash de cada `.py` do wheel |
| Segurança | sem rede, `subprocess` importado e nunca usado, HTML sem script externo, zips sem caminho malicioso | leitura dos 20 `.py`, 3 `.html` e dos 8 zips aninhados |
| Testes RC4 | 11/11 passam | Python 3.12.4 |
| Testes RC3 | 65/67 passam; 2 erram por falta do OpenCV | Python 3.12.4, cópia isolada |
| Tamanho | 113 de 121 MB = 8 zips de versões antigas, um dentro do outro | `unzip -l` de cada zip |
| Código | 675 linhas em 4 scripts + 1 pacote que se repetem (3 compiladores, 2 ópticas, 3 orçamentos) | `wc -l` |
| Modelos conhecidos | 9 perfis; 7 com todos os campos `null`; duas matrizes que se contradizem | `models/` × `ultimate/capabilities.json` |
| Modelos no conector | 66 de vídeo + 56 de imagem | `models_explore list`, 24/11/2026 |
| Custo real (5 s) | Cinema Studio 4.0 = 15 / 35 / 80 créditos (480p / 720p / 1080p); Seedance 2.5 720p = 35; Kling 3.0 = 7,5 a 10 | `estimate_video_cost` (não gera) |

## 3. Defeitos medidos (todos viraram teste em `higgsfield-director/tests/test_hfd.py`)

**Diziam coisa errada:**
1. Tirava o áudio do Cinema Studio e mandava para "pós-produção" (lia a matriz em que tudo é `null`); o catálogo diz
   que o Cinema Studio 4.0 gera áudio por padrão.
2. Modelo desconhecido (`kling-3.0`) caía no perfil "universal" sem aviso.
3. Tomada sem `end_state` desligava a checagem de fronteira: a seguinte podia começar com o produto de outra cor.
4. Perfis de modelos defasados: "sora" (fora do catálogo; descontinuado segundo a imprensa), sem Kling 4.0,
   Seedance 2.5, Veo 3.1, Wan 3.0, MiniMax H3, Gemini Omni.
5. `SKILL.md` citava `references/v2.1-original.zip`, que não existe.

**Travavam o uso:**
6. "static camera, no orbit", "locked-off shot, no pan or dolly" e "slow orbit around a static subject" eram
   **recusados** (erro, não aviso) pelos três compiladores.
7. O MCP da RC4 recebia 4 dos 25 campos.
8. `tempo`, `cuts`, `reference_count` aceitos e ignorados; linha `LOCKS:` vazia; prompt picotado em fragmentos.

**Peso morto:** 116 "comandos" em três registros que só apontavam para `.md`; catálogo de 2.010 "receitas" = 212
termos × modificadores, todas `unverified`; 200 "DNAs" = 10 × 5 × 4 combinações não testadas; 165 imagens
esquemáticas (a "ficha de personagem" repetia o mesmo boneco nas 4 vistas); REST, Docker, CI, mkdocs, LUT,
"semelhança" por histograma, embeddings opcionais.

**Não funcionava no Codex:** sem MCP do Higgsfield configurado, caminhos relativos à pasta da skill, descrição larga
demais (disputaria gatilho com as skills de vídeo existentes), sem `agents/openai.yaml`.

## 4. O que foi aproveitado

Vocabulário da v1 (`references/legacy/camera.md`, `look.md`, `motion.md`) → `references/vocabulario.md`; moldes e
exemplos (`workflows.md`), regra de ouro (`core/prompting.md`), tabela de intenção (`core/decision.md`), 18 receitas
(`master/MANUAL.md`) → `references/prompt.md`; planejamento, fichas e orçamento (`production/`) →
`references/fluxo.md`; diagnóstico e nota (`quality/`) → `references/qualidade.md`; validação, continuidade, nota
(`scripts/studio.py`), regra dos 180° e exportação (`scripts/ultimate.py`) → `scripts/hfd.py`, reescritos.

## 5. Fatos oficiais usados na v5

Levantados em 24/11/2026; a fonte de cada um está em `higgsfield-director/references/prompt.md` e `modelos.md`.

- Guia do Higgsfield: vídeo é "shot list", descreva o que quer (não o que não quer), inglês é mais previsível, use o
  último quadro como início da próxima tomada.
- Regras em duas ou mais fontes oficiais (Higgsfield, Google Veo, Kling, OpenAI Sora, Alibaba Wan, MiniMax): estrutura
  sujeito/ação/cena/câmera/luz; um movimento e uma ação por plano; vocabulário padrão de câmera; áudio pedido em
  bloco separado; falas rotuladas e do tamanho da duração; parâmetros fora do texto; iterar uma variável por vez.
- Termos do Higgsfield (23/10/2026): imagem de pessoa real exige direito e consentimento; menores protegidos; seguir
  a política de cada fornecedor de modelo.
- Veo 3.1 Preview desligado pelo Google em 22/10/2026 (o conector ainda oferece a variante); Sora 2 fora do catálogo.

## 6. Resultado da v5

| | RC3 | v5 |
|---|---|---|
| Arquivos da skill | 328 (121 MB) | 15 (203 kB, quase metade é o retrato dos modelos) |
| `SKILL.md` | roteia para 116 comandos | 91 linhas, 6 referências lidas sob demanda |
| Programa | 4 scripts + pacote, dependências opcionais | 1 `hfd.py`, só biblioteca padrão |
| Modelos | 9 perfis, quase todos `null` | retrato de 122 modelos do catálogo, datado, atualizável por comando |
| Testes | 67 (2 dependem do OpenCV) | 50, todos sem dependência, rodados no CI; 4 mutações plantadas, 4 pegas |
| Geração | nenhuma integração | pelo conector oficial, só depois do custo e do "ok" |
| Conflito com outras skills | descrição genérica de vídeo | descrição presa a "gerado por IA / Higgsfield", com exclusões nomeadas |
