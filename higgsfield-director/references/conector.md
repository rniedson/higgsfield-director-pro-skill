# O conector do Higgsfield (MCP)

Quem gera, cobra e guarda é o conector oficial (`https://mcp.higgsfield.ai/mcp`). Esta skill decide **o que** pedir;
o conector decide **como** executar. Quando as instruções do próprio conector (servidor MCP ou um fluxo carregado
por `get_workflow_instructions`) disserem algo mais específico sobre uma ferramenta, elas valem.

## Disponível neste agente?

| Agente | Como aparece | Se não aparecer |
|---|---|---|
| Claude Code | ferramentas `mcp__claude_ai_Higgsfield__<nome>` (conector do claude.ai). Podem vir "adiadas": carregue pelo nome com a busca de ferramentas antes de chamar. | o operador ativa o conector "Higgsfield" no claude.ai e abre uma **sessão nova** (sessão antiga não recebe as ferramentas). |
| Codex | ferramentas do servidor `higgsfield` | o operador roda `codex mcp add higgsfield --url https://mcp.higgsfield.ai/mcp` e `codex mcp login higgsfield` (login OAuth no navegador). Configuração e login são decisão dele. |

Sem conector: **modo só planejamento.** Entregue prompts e parâmetros prontos para colar no site do Higgsfield, diga
que o custo deve ser conferido lá antes de gerar, e não afirme que algo foi gerado.

Os nomes das ferramentas abaixo são os mesmos nos dois agentes (muda só o prefixo).

## Antes de planejar: existe um fluxo pronto?

O conector traz fluxos completos para formatos específicos. Se o pedido é um deles, **carregue o fluxo**
(`get_workflow_instructions` com o nome) e siga-o; esta skill só ajuda onde o fluxo pedir um prompt de tomada.
`get_workflow_instructions` sem argumento lista todos. Os arquivos que um fluxo cita (guias, exemplos) se leem com
`get_workflow_bundle_file` (só leitura, não gasta). O fluxo manda no formato; a regra de custo e "ok" desta skill
continua valendo, mesmo que o fluxo diga que a intenção de criar já autoriza gastar.

| O pedido é… | Fluxo do conector |
|---|---|
| vídeo UGC (criador falando, unboxing, try-on, tutorial, tour de site) | `ugc-video` |
| ficha de personagem, turnaround, folha de expressões | `character-sheet` |
| foto de produto, packshot, lifestyle, carrossel, try-on virtual | `product-photoshoot` |
| miniatura ou capa de vídeo | `thumbnail-generation` |
| anúncio estático com texto (Meta/Instagram) | `ads-studio` |
| variações de um anúncio em vídeo já pronto | `ad-multiplier` |
| microdrama com personagens falando | `drama-ads` (só por `/drama-ads`) |
| vídeo narrado sem rosto (explicativo, história, infantil) | `faceless-video` |
| dublar o vídeo de um criador | `creator-dub` |
| montar clipes, trilha, legenda queimada | `video-montage` |
| efeitos sonoros num vídeo existente | `video-sound-design` |
| melhorar/upscale 1:1 com Kling | `higgsfield-enhance-video` |
| criatura, monstro | `monsters` |
| modelo 3D a partir de foto | `photo-to-3d-model` |
| logo, identidade, peças de marca | `brand-asset-creation` |

Fica com esta skill: tomadas cinematográficas, comercial ou cena com várias tomadas geradas, trailer, clipe musical,
plano de produto em movimento, imagem-para-vídeo de uma foto, e todo diagnóstico de prompt.

## A ordem das chamadas

1. **Modelo:** `models_explore` (`recommend` com o objetivo e o tipo de entrada; depois `get` no escolhido).
2. **Referências** (se houver): `media_upload` + upload + `media_confirm`, ou `media_import_url` (HTTPS). Só suba
   mídia que o operador forneceu e tem direito de usar. Guarde o id de cada uma com o papel (`start_image`,
   `end_image`, `image_references`...).
3. **Custo por tomada:** `estimate_video_cost` / `estimate_image_cost` com os mesmos `params` que serão gerados
   (o `hfd.py compilar` já devolve `parametros` nesse formato). Anote `custo_teste`/`custo_final` no projeto e rode
   `hfd.py orcamento`.
4. **Pare e mostre:** total em créditos, quantas gerações, o que cada uma é. Espere um "ok" explícito.
   Se o conector responder com `unlim_choice` (gerações ilimitadas de teste), pergunte ao operador qual saldo usar.
5. **Gerar:** `generate_video` / `generate_image` (ou `_batch` para tomadas independentes), de preferência com
   `params: {"ref": "<quote_ref>"}` da estimativa, para gerar exatamente o que foi cotado. Antes da primeira geração
   sem pasta, `get_preferences` (o conector decide se cria projeto).
6. **Esperar e mostrar:** `jobs_wait` (timeout ≤ 15 s por chamada, repita) e `show_generation_by_ids` uma vez.
7. **Revisar:** veja o resultado (quadros do início, meio e fim de cada tomada) e pontue com `hfd.py pontuar`
   (`references/qualidade.md`). Próxima tentativa muda **uma** variável e volta ao passo 3.

Não use `execute_preset` nem gere nada só porque um preset, galeria ou widget foi aberto: abrir não autoriza gerar.

## Ferramentas úteis além de gerar

`upscale_video`/`upscale_image`, `remove_background`, `reframe` (mudar proporção), `outpaint_image`,
`voice_change`, `separate_stems`, `video_analysis_create` (análise de um vídeo), `balance` (saldo), `transactions`.
Todas que produzem arquivo gastam crédito: mesma regra de custo e "ok".
