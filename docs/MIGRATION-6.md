# Migrating to 6.0: everything in English

From 6.0 the skill, its files, its commands and its fields are in English. The skill still answers in the language of
the person using it; only its content changed language. `README.pt-BR.md` stays as a Portuguese translation of
`README.md` and is the only file in Portuguese.

The old Portuguese names keep working for one version (6.x) with a warning that names the new one. They will be
removed in 7.0.

## Files

| Old | New |
|---|---|
| `references/fluxo.md` | `references/workflow.md` |
| `references/vocabulario.md` | `references/vocabulary.md` |
| `references/modelos.md` | `references/models.md` |
| `references/conector.md` | `references/connector.md` |
| `references/qualidade.md` | `references/quality.md` |
| `references/modos.md` | `references/modes.md` |
| `references/calibracao.md` | `references/calibration.md` |
| `references/preproducao.md` | `references/preproduction.md` |
| `references/prompt.md` | `references/prompt.md` (unchanged) |
| `data/modelos.json` | `data/models.json` |
| `data/pesos.json` | `data/weights.json` |
| `templates/projeto.json` | `templates/project.json` |
| `templates/avaliacao.json` | `templates/evaluation.json` |
| `templates/i2v.json` | `templates/i2v.json` (unchanged) |
| `scripts/calibrar_claude_code.sh` | `scripts/calibrate_claude_code.sh` |
| `tools/checar_repo.py` | `tools/check_repo.py` |
| `tools/agregar_calibracao.py` | `tools/aggregate_calibration.py` |
| `calibracao/` | `calibration/` (records: `anuncio-produto` becomes `product-ad` in the file name) |
| `docs/AVALIACAO-RC3.md` | `docs/RC3-EVALUATION.md` |
| `.github/workflows/testes.yml` | `.github/workflows/tests.yml` |
| `.higgsfield-director/preferencias.json` | `.higgsfield-director/preferences.json` (the old file is still read, with a warning) |
| `export` output: `roteiro.md`, `tomadas.csv`, `legendas.srt` | `script.md`, `shots.csv`, `subtitles.srt` |
| `blind` output: `pedidos-cegos.json`, `chave-cega.json` | `blind-requests.json`, `blind-key.json` |

## `hfd.py` commands

| Old | New | | Old | New |
|---|---|---|---|---|
| `validar` | `validate` | | `modelos` | `models` |
| `compilar` | `compile` | | `preferencias` | `preferences` |
| `orcamento` | `budget` | | `cego` | `blind` |
| `exportar` | `export` | | `resultado` | `result` |
| `otica` | `optics` | | `recortar` | `crop` |
| `pontuar` | `score` | | | |

## `hfd.py` options

| Old | New | | Old | New |
|---|---|---|---|---|
| `--retrato` | `--snapshot` | | `--com` | `--with` |
| `--texto` | `--text` | | `--sem` | `--without` |
| `--tomadas` | `--shots` | | `--chave` | `--key` |
| `--custo-teste` | `--test-cost` | | `--voto` | `--vote` |
| `--custo-final` | `--final-cost` | | `--categoria` | `--category` |
| `--tentativas` | `--attempts` | | `--modelo` | `--model` |
| `--reserva` | `--reserve` | | `--custo` | `--cost` |
| `--tipo` | `--type` | | `--versao` | `--version` |
| `--buscar` | `--search` | | `--referencia` | `--reference` |
| `--importar` | `--import` | | `--motivo` | `--reason` |
| `--saida` | `--out` | | `--avaliacao-x` / `--avaliacao-y` | `--evaluation-x` / `--evaluation-y` |
| `--modo` | `--mode` | | `--avaliador` | `--rater` |
| `--calibrar` | `--calibrate` | | `--primeiro` | `--first` |
| `--arquivo` | `--file` | | `--data` | `--date` |
| `--margem` | `--margin` | | `--id` | `--id` (unchanged) |

## Project fields (`project.json`, `i2v.json`)

| Level | Old | New |
|---|---|---|
| project | `titulo`, `modelo`, `modo`, `proporcao`, `resolucao` | `title`, `model`, `mode`, `aspect_ratio`, `resolution` |
| project | `biblias`, `restricoes`, `referencias`, `preservar`, `alvo`, `eixo` | `bibles`, `constraints`, `references`, `preserve`, `target`, `axis` |
| project | `tomadas` | `shots` |
| mode value | `imagem` | `image` (`t2v`, `i2v`, `edit`, `extend` unchanged) |
| bible entry | `tipo`, `descricao`, `fixo`, `variavel` | `type`, `description`, `fixed`, `variable` |
| bible type | `produto`, `personagem`, `lugar`, `marca`, `objeto` | `product`, `character`, `place`, `brand`, `object` |
| shot | `id`, `duracao`, `entidades`, `sujeito`, `ambiente` | `id`, `duration`, `entities`, `subject`, `setting` |
| shot | `acao`, `microacao`, `enquadramento`, `camera`, `otica` | `action`, `micro_action`, `framing`, `camera`, `optics` |
| shot | `luz`, `estetica`, `atmosfera`, `secundario`, `final` | `lighting`, `aesthetic`, `atmosphere`, `secondary`, `final` |
| shot | `som`, `falas` [{`quem`, `idioma`, `texto`}] | `sound`, `dialogue` [{`speaker`, `language`, `text`}] |
| shot | `inicio`, `fim`, `mudancas_aprovadas`, `camera_xy`, `cruzamento_motivado` | `start`, `end`, `approved_changes`, `camera_xy`, `motivated_crossing` |
| shot | `linha_do_tempo` [{`trilha`, `de`, `ate`}] | `timeline` [{`track`, `from`, `to`}] |
| shot | `custo_teste`, `custo_final`, `tentativas` | `test_cost`, `final_cost`, `attempts` |

## Evaluation (`evaluation.json`, `hfd.py score`)

| Old | New |
|---|---|
| `tipo`: `prompt` or `resultado` | `type`: `prompt` or `result` |
| `arquivo`, `criterios`, `falha_critica` | `file`, `criteria`, `critical_failure` |
| criterion: `nota`, `evidencia`, `nao_se_aplica` | `score`, `evidence`, `not_applicable` |
| criteria: `identidade`, `movimento`, `camera`, `luz`, `materiais`, `continuidade`, `briefing`, `audio` | `identity`, `motion`, `camera`, `lighting`, `materials`, `continuity`, `briefing`, `audio` |
| output: `nota`, `situacao` | `score`, `verdict` |
| verdicts: `excelente`, `aprovado com ajustes`, `revisar`, `reprovado`, `bloqueado (falha crítica)` | `excellent`, `approved with adjustments`, `revise`, `rejected`, `blocked (critical failure)` |

## Working mode and calibration

| Old | New |
|---|---|
| preferences: `modo` = `acompanhar`, `preco`, `teto` | `mode` = `follow`, `price`, `ceiling` |
| preferences: `calibrar` = `sim`, `nao`, `depois`; `atualizado_em` | `calibrate` = `yes`, `no`, `later`; `updated_at` |
| record: `formato`, `data`, `versao_skill`, `categoria`, `modelo`, `tomadas` | `format`, `date`, `skill_version`, `category`, `model`, `shots` |
| record: `custo_creditos`, `referencia_de_imagem`, `voto`, `avaliador`, `motivo`, `notas`, `visto_primeiro` | `cost_credits`, `image_reference`, `vote`, `rater`, `reason`, `scores`, `seen_first` |
| vote: `com`, `sem`, `empate` | `with`, `without`, `tie` |
| rater: `cego-automatico`, `pessoa`, `nenhum` | `blind-auto`, `person`, `none` |
| seen first: `X`, `Y`, `juntos` | `X`, `Y`, `together` |
| category: `anuncio-produto`, `cena-com-personagem`, `trailer`, `institucional`, `clipe`, `loop`, `imagem`, `outro` | `product-ad`, `character-scene`, `trailer`, `corporate`, `music-video`, `loop`, `image`, `other` |

## Model snapshot (`data/models.json`)

| Old | New |
|---|---|
| `fonte`, `gerado_em`, `modelos` | `source`, `generated_at`, `models` |
| per model: `nome`, `fornecedor`, `tipo`, `descricao`, `midias`, `modos` | `name`, `provider`, `type`, `description`, `media`, `modes` |
| per model: `parametros`, `proporcoes`, `resolucao`, `duracao`, `audio`, `audio_nas_tags` | `parameters`, `aspect_ratios`, `resolution`, `duration`, `audio`, `audio_in_tags` |
| inside `audio`, `resolucao`, `duracao`: `parametro`, `opcoes`, `padrao` | `parameter`, `options`, `default` |

## Output keys that the agent reads

| Old | New |
|---|---|
| `erros`, `avisos`, `erro`, `lembrete` | `errors`, `warnings`, `error`, `reminder` |
| `parametros`, `arquivo`, `arquivos`, `pasta`, `registro`, `pergunta` | `parameters`, `file`, `files`, `folder`, `record`, `question` |
| `comandos`, `comando`, `quadro`, `caixas` (crop) | `commands`, `command`, `frame`, `boxes` |
| `retrato_dos_modelos`, `total_no_retrato`, `quantidade`, `por_tipo`, `importados`, `removidos` | `models_snapshot`, `total_in_snapshot`, `count`, `by_type`, `imported`, `removed` |
| `reserva_pct`, `subtotal`, `total` | `reserve_pct`, `subtotal`, `total` |
| `duracao_s`, `duracao_total_s`, `inicio_s`, `fim_s` | `duration_s`, `total_duration_s`, `start_s`, `end_s` |
| optics: `campo_de_visao_horizontal_graus`, `largura_do_quadro_m`, `foco_de_m`, `foco_ate_m`, `hiperfocal_m`, `infinito` | `horizontal_fov_degrees`, `frame_width_m`, `focus_from_m`, `focus_to_m`, `hyperfocal_m`, `infinity` |
| blind test: `pedidos`, `arquivo_pedidos`, `chave`, `mostrar_primeiro`, `como_mostrar` | `requests`, `requests_file`, `key`, `show_first`, `how_to_show` |
