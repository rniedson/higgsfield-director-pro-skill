# Escolher o modelo

**A fonte de verdade é o catálogo ao vivo** do conector (`models_explore`: `recommend` para sugerir, `get` para os
limites de um modelo). `data/modelos.json` é um **retrato datado** do mesmo catálogo, para trabalhar sem o conector e
para o `hfd.py validar` conferir duração, proporção, resolução e áudio. Ao citar um limite, diga de onde veio e a data.
Se a importação atualizar só parte do catálogo, cada modelo conserva sua própria data de atualização; a data geral
do arquivo registra quando o retrato foi salvo. O aviso de retrato antigo usa a data do modelo escolhido.

```bash
python3 <skill>/scripts/hfd.py modelos --tipo video            # resumo de todos
python3 <skill>/scripts/hfd.py modelos --buscar "first-last"    # busca no retrato
python3 <skill>/scripts/hfd.py modelos --id seedance_2_5        # ficha completa
```

## Por necessidade (retrato de 24/11/2026: 66 modelos de vídeo, 56 de imagem)

| Preciso de… | Comece por | Por quê |
|---|---|---|
| Tomada longa (até 30 s) | `cinematic_studio_video_4_0`, `seedance_2_5`, `kling4_0`, `magi_2`, `wan3_0` | duração máxima 30 s no catálogo |
| Controle de cinema (lente, câmera, época, luz) | `cinematic_studio_video_4_0` | tem `camera_model_id`, `camera_lens_id`, `camera_aperture_id`, `era_id`, `genre_id`, `pacing_id`, `light`, `color_palette` |
| Muitas referências (produto, identidade, estilo) | `cinematic_studio_video_4_0`, `seedance_2_5` | até 30 imagens, 10 vídeos, 10 áudios (modo `omni_reference`) |
| Primeiro **e** último quadro | `kling3_0`, `seedance_2_5`, `wan3_0`, `minimax_h3`, `veo3_1_lite`, `gemini_omni_flash_1_2` | papel `end_image` no catálogo |
| Áudio e fala nativos | `cinematic_studio_video_4_0`, `seedance_2_5`, `kling3_0` (`sound`), `veo3_1`, `wan3_0` | parâmetro de áudio ou tag "audio" |
| Editar ou estender um vídeo | `cinematic_studio_video_4_0`, `seedance_2_5` (`video_edit`, `video_extension`), `kling4_0` | modos no catálogo |
| Testar composição barato | no mesmo modelo, na resolução mais baixa que ele aceita (cote o teste e o final); `seedance_2_5` tem `draft` | teste em outro modelo não prevê o resultado final |
| Imagem realista de pessoa/moda/UGC | `soul_2` | "Realistic UGC, fashion editorial and character" |
| Still de cinema / concept art | `soul_cinematic`, `cinematic_studio_image` | "Cinema-grade stills and concept art" |
| Texto legível na imagem, diagrama | `nano_banana_pro`, `ideogram_4_6` | "text and diagrams"; edição com máscara |
| Uso geral de imagem, GIF/SVG | `gpt_image_2_6` | padrão do conector para imagem |
| Fundo transparente, PNG | `seedream_5_5` | "optional transparent background" |
| Vetor, logo, ícone | `recraft_v4_1` | `model_type` para vetor |

Preço não se guarda: ele muda com modelo, duração, resolução, modo, som e plano, e muda com o tempo. **Cote sempre**
com `estimate_video_cost` / `estimate_image_cost` (não gasta, devolve `quote_ref`) e nunca use um número lembrado.

## Modelos de geração de vídeo no retrato (24/11/2026)

| id | nome | duração (s) | áudio | 1º/último quadro | refs | modos |
|---|---|---|---|---|---|---|
| `cinematic_studio_video_4_0` | Cinema Studio 4.0 | 4–30 | sim | 1º+último | áudio, imagem, vídeo | t2v, omni_reference, video_edit, video_extension |
| `cinematic_studio_video_3_5` | Cinematic Studio 3.5 | ? | sim | 1º+último | áudio, imagem, vídeo | — |
| `seedance_2_5` | Seedance 2.5 | 4–30 | sim | 1º+último | áudio, imagem, vídeo | t2v, omni_reference, video_edit, video_extension |
| `seedance_2_5_flash` | Seedance 2.5 Flash | 4–30 | sim | 1º+último | áudio, imagem, vídeo | idem |
| `seedance_2_0` | Seedance 2.0 | 4–15 | sim | 1º+último | áudio, imagem, vídeo | std, fast |
| `kling4_0` | Kling 4.0 | 3–30 | ? | 1º+último | imagem, vídeo | text/image/reference-to-video, video-edit |
| `kling_4_0_flash` | Kling 4.0 Flash | 3–20 | ? | 1º | imagem, vídeo | idem |
| `kling3_0` | Kling 3.0 | 3–15 | sim (`sound`) | 1º+último | — | std, pro, 4k (qualidade) |
| `kling_o3_image_reference` | Kling 3.0 Omni | 3–15 | sim (`sound`) | — | imagem | std, pro, 4k; multi-shot |
| `veo3_1` | Google Veo 3.1 | 4/6/8 | sim | 1º | — | variante preview/fast |
| `veo3_1_lite` | Google Veo 3.1 Lite | 4/6/8 | sim | 1º+último | — | — |
| `gemini_omni_flash_1_2` | Gemini Omni Flash 1.2 | 3–15 | sim | 1º+último | imagem, vídeo | t2v, i2v, ref, edit, extend |
| `wan3_0` | Wan 3.0 | até 30 | sim | 1º+último | áudio, imagem, vídeo | — |
| `wan2_7` | Wan 2.7 | 2–15 | sim | 1º+último | áudio | — |
| `minimax_h3` | MiniMax H3 | 4–15 | ? | 1º+último | áudio, imagem, vídeo | — |
| `minimax_hailuo` | MiniMax Hailuo | 6/10 | ? | 1º+último | — | — |
| `magi_2` | MAGI-2 | 4–30 | sim | 1º+último | áudio, imagem, vídeo | — (tem `seed`) |
| `flux_3_video` | FLUX 3 Video | 5–20 | sim | 1º+último | imagem, vídeo | — |
| `grok_video_v15` | Grok Video 1.5 | 2–15 | sim | 1º | áudio, imagem | — |

"?" = o catálogo não mostra; confira com `models_explore get`. Fora desta tabela ficam os modelos de ferramenta
(upscale, remover fundo, dublagem, lipsync, reenquadrar, Genjutsu, Editing Room…): veja `references/conector.md`.

## Avisos de 24/11/2026

- **Sora 2:** não está no catálogo do Higgsfield; a imprensa (CBS, Axios, 24/03/2026) noticiou a descontinuação.
- **Veo 3.1 "preview":** a documentação do Google diz que o Veo 3.1 Preview foi desligado em 22/10/2026; o conector
  ainda oferece a variante `veo-3-1-preview`. Prefira `veo-3-1-fast` ou confira ao vivo.
- **MiniMax:** há relato de terceiros de que o Hailuo 2.3 virou legado e o H3 é o atual (não confirmado).

## Validar contra os limites ao vivo (modo estúdio, com conector)

Salve a resposta do `models_explore get` do modelo escolhido num arquivo do projeto e importe só ele:
`python3 <skill>/scripts/hfd.py modelos --importar <projeto>/get.json --saida <projeto>/modelos.json`. O `get`
entra ou atualiza aquele modelo sem tirar nenhum outro. Depois use `--retrato <projeto>/modelos.json` em `validar`,
`compilar` e `exportar`: a validação passa a usar os limites de hoje, não os do retrato que vem com a skill.

## Atualizar o retrato inteiro (quando tiver mais de 30 dias ou um modelo citado não estiver nele)

1. Chame `models_explore` com `action: list`, `type: video`, `limit: 100`; salve a resposta JSON num arquivo.
   Repita com `type: image`. (No Claude Code, resposta grande já vem salva em arquivo; use esse caminho.)
2. Monte o retrato novo **fora da pasta da skill**, com todas as listas no mesmo comando:
   `python3 <skill>/scripts/hfd.py modelos --importar video.json imagem.json --saida <projeto>/modelos.json`.
   Para cada tipo importado, o que não veio na lista sai do retrato; confira `removidos` na resposta (lista cortada
   em 100 itens tira modelos que ainda existem: importe todas as páginas juntas).
3. Use esse retrato com `--retrato <projeto>/modelos.json` em `validar`, `compilar`, `exportar` e `modelos`.
4. Atualizar o retrato que vem com a skill é trabalho de quem mantém o repositório: `--saida <clone>/higgsfield-director/data/modelos.json`,
   rode `python3 -m unittest discover -s <skill>/tests`, revise a tabela acima se algo grande mudou e faça o commit.
