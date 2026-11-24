# Escrever o prompt

Leia antes de escrever ou revisar qualquer prompt. O vocabulário fica em `references/vocabulario.md`.

## 1. A regra de ouro (ordem)

Sujeito e detalhes que não mudam → ambiente → ação em ordem cronológica → plano e ângulo → movimento de câmera e
velocidade → lente e foco → luz e cor → atmosfera e movimento secundário → estado final → (bloco de áudio separado).

- **Uma ação dominante e um movimento de câmera por tomada.** Mais de um só em fases explícitas:
  "Static for two seconds, then a slow push-in". (Sora cookbook; Higgsfield, "shot list" por bloco.)
- **Duração, proporção, resolução e áudio liga/desliga vão nos PARÂMETROS**, nunca no texto. "Make it longer"
  no prompt não muda a duração. (Sora, Veo, MiniMax.)
- **Descreva o que quer ver, não o que não quer.** "The label stays flat and readable", não "no warped label".
  Campo de negativo só se o modelo tiver (nenhum dos principais mostra no catálogo de 24/11/2026). (Veo; Higgsfield:
  "Say what you want, not what you don't".)
- **Inglês** dá o resultado mais previsível. Diálogo fica no idioma pedido, com o idioma escrito. O guia do Higgsfield
  diz que Seedance e Kling às vezes respondem melhor a chinês em movimento sutil: teste, não suponha.
- **Clipe curto obedece melhor.** Quanto mais longa a tomada, mais o modelo inventa; divida em tomadas.
- **Mude uma coisa por vez** entre tentativas. Duas falhas seguidas: replaneje a tomada em vez de empilhar restrições.

Fontes: higgsfield.ai/creator-hub/help-center/getting-started/how-do-i-write-a-good-prompt (mod. 14/09/2026);
docs.cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide; kling.ai/blog/kling-ai-prompt-guide
(07/08/2026); developers.openai.com/cookbook/examples/sora/sora2_prompting_guide; help.aliyun.com/en/model-studio/text-to-video-prompt;
platform.minimax.io/docs/api-reference/video-generation-t2v.

## 2. Moldes por modo

| Modo | Molde |
|---|---|
| Texto para vídeo | `[Sujeito e invariantes]. [Ambiente]. [Ação cronológica]. [Plano e ângulo]. [Câmera: trajetória e velocidade]. [Lente e foco]. [Luz e cor]. [Atmosfera e movimento secundário]. [Estado final].` + `Audio: ...` |
| Imagem para vídeo | `The reference image is the opening frame; preserve [identidade, geometria, figurino, fundo]. [Uma ação]. [Câmera]. [Movimento secundário]. [Estado final].` A imagem já traz sujeito e cena: o texto fala de **movimento e câmera** (Wan). O texto e a imagem precisam concordar: não peça "calm, still" sobre um quadro tremido (Higgsfield). |
| Edição | `Change only [alvo]; preserve everything else exactly as it is. [Como fica o alvo].` |
| Extensão | `Continue seamlessly from the final frame of the previous clip. [O que acontece a seguir].` |
| Imagem parada | Sem tempo, sem câmera em movimento, sem som: sujeito, ambiente, plano, ângulo, lente, luz, cor, estilo. |
| Sequência | Gere tomada por tomada; o **último quadro** de uma vira a imagem inicial da seguinte (Higgsfield; Veo first/last frame). |

## 3. Áudio e fala

- Peça o som **explicitamente, em frase ou bloco separado** (Veo, Wan, Kling, Sora). O `hfd.py compilar` já põe
  tudo depois de `Audio:`.
- **Rotule quem fala** e repita o mesmo rótulo em toda tomada: `Ana says in Brazilian Portuguese: "..."` (Kling, Sora).
- **A fala cabe na duração**: ~2,5 palavras por segundo. Em 4 s cabem 1 ou 2 falas curtas (Sora). O `validar` avisa.
- Para silêncio de fala: "No dialogue" (Wan). Para não ter trilha: "No music" (prática do Higgsfield para Seedance).
- Seedance (convenção copiada de documento da ByteDance pelo Higgsfield, fonte secundária): música entre `( )`,
  efeitos entre `< >`, fala entre `{ }`. Use só no Seedance e só depois de testar.
- Pessoa real, voz de alguém, menor de idade: veja as regras duras do `SKILL.md`.

## 4. Notas por modelo (fato oficial quando há fonte do fabricante)

| Modelo | O que muda no prompt | Fonte |
|---|---|---|
| Cinema Studio 4.0 (Higgsfield) | Câmera, lente, abertura, época, gênero, ritmo e luz existem como **controles** (`camera_model_id`, `camera_lens_id`, `light`...); movimento de câmera vai no texto. Áudio ligado por padrão. 4–30 s. | catálogo do conector; central de ajuda do Cinema Studio (mod. 19/11/2026) |
| Seedance 2.5 / 2.0 | Referências citadas no texto como `@Image 1`, `@Video 1`, `@Audio 1`, com o papel de cada uma escrito (não dentro da imagem). Ordem: sujeito e ação; cena; estilo; câmera ou corte; áudio. | central de ajuda Seedance (mod. 17/11/2026), guia do blog do Higgsfield |
| Kling 3.x / 4.0 | Sujeito, ação, cena, câmera, luz, humor. Rótulos claros de quem fala; fala em chinês, inglês, japonês, coreano ou espanhol (português: teste antes). | kling.ai/blog/kling-ai-prompt-guide |
| Veo 3.1 | Elementos: sujeito, ação, cena, ângulo, movimento, lente, estilo, tempo, áudio. **Zoom não é dolly.** Ângulos "avançados" não são oficialmente suportados. 4, 6 ou 8 s. | Vertex AI video prompt guide; aistudio.google.com/docs/veo |
| Wan 2.6–3.0 | T2V = entidade + cena + movimento; I2V = movimento + câmera. Multi-shot no texto: `Shot 1 [0-3s] ...`; plano único: "Generate single shot." | help.aliyun.com/en/model-studio/text-to-video-prompt |
| MiniMax Hailuo | Comandos de câmera entre colchetes, até 3: `[Push in]`, `[Pan left]`, `[Truck right]`, `[Tilt up]`, `[Zoom in]`, `[Tracking shot]`, `[Static shot]`, `[Shake]`... Mais precisos que texto livre. | platform.minimax.io (API t2v) |

Sora 2 **não está** no catálogo do Higgsfield (24/11/2026) e a imprensa noticiou a descontinuação em 03/2026.

## 5. Intenção → linguagem visual (ponto de partida, o briefing manda)

| Intenção | Câmera | Luz | Risco |
|---|---|---|---|
| Intimidade | close-up, slow push-in | janela suave | identidade |
| Poder | low angle, static | rim light | distorção |
| Solidão | extreme wide, static | difusa | sujeito ilegível |
| Luxo | slow orbit | reflexos controlados | geometria e rótulo |
| Ansiedade | handheld discreto | low key | tremor |
| Descoberta | reveal, crane up | motivada | continuidade |
| Ação | tracking | contraste legível | contato físico |
| Contemplação | locked-off | natural | movimento demais |
| UGC | medium close-up, handheld leve | janela | sincronia labial |
| Arquitetura | fly-through estabilizado | dia | linhas e escala |

Se identidade importa, reduza oclusão e rotação. Se texto importa, deixe espaço e ponha o texto na pós. Se a tomada é
curta, tire ações antes de acelerar.

## 6. Receitas contra defeitos clássicos

| Tema | Escreva assim | Evite |
|---|---|---|
| Olhar e subtexto | She looks away, pauses, then exhales softly. | She expresses every emotion at once. |
| Peso | She plants her left foot before turning. | She glides while walking. |
| Vidro | A clear glass bottle refracts the background; its base remains on the table. | The rigid bottle bends as it rotates. |
| Tecido | Silk follows the arm with a slight delayed sway. | The silk moves like rigid metal. |
| Líquido | Water pours downward into the cup, with a rising fill level. | Water flows upward without a force. |
| Identidade | Preserve facial proportions and hairstyle from reference A. | Change the face each time the camera turns. |
| Logo | Keep the label flat and readable; add typography in post if needed. | Make the logo transform during the orbit. |
| Cintilação | Maintain constant key light and exposure throughout. | Random exposure changes in a continuous shot. |
| Pés | Each planted foot stays fixed until lifted. | Walk without lifting either foot. |
| Cenário | Keep straight architectural lines fixed in world space. | The room changes shape during the pan. |
| Luz | Large soft key at camera left, weaker fill. | Hard and soft shadows from the same tiny source. |
| Cor | Neutral white balance; preserve highlight detail. | Apply an unspecified log conversion twice. |
| Perspectiva sonora | Distant traffic under close dry dialogue. | All sounds equally loud and close. |
| Foley | A soft click exactly when the latch closes. | Random loud impacts unrelated to action. |
| Suspense | Hold a wide frame with negative space before the reveal. | Reveal all threats immediately. |
| Documentário | Observe a single everyday action in available light. | Gratuitous cuts during a quiet observation. |
| Produto | Reveal material detail, then finish on a centered product frame. | Hide the product and change its label. |
| UGC | Demonstrate one concrete use case in a natural voice. | Unsupported claims about the product. |

## 7. Exemplos curtos (texto para vídeo)

- **Perfume:** A black perfume bottle on polished obsidian. Slow 180-degree orbit, macro close-up, controlled specular highlights, black and gold palette. The label stays flat and readable. Single continuous shot.
- **Moda:** A model walks through a minimalist concrete interior. Smooth reverse tracking, full-body framing, soft cross lighting, natural fabric motion.
- **Carro:** A sports car drives along a coastal highway at sunset. Low-angle side tracking, realistic wheel rotation and reflections, golden hour backlight.
- **Retrato:** Extreme close-up, slow push-in, 85mm portrait look, soft window light, natural blinking and subtle breathing.
- **Imóvel:** Smooth stabilized fly-through from the entrance to the living room, wide-angle, straight verticals, natural daylight.
- **Suspense:** A detective listens in a dim corridor. Slow push-in, muted green shadows, restrained expression, subtle head turn, one continuous take.
- **Transição:** The camera passes through a dewdrop into an underwater world. Continuous forward motion, realistic refraction.
- **Loop:** A glass sphere completes one slow revolution. Locked-off camera, stable lighting, the closing frame matches the opening frame.
