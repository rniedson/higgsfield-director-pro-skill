---
name: higgsfield-director
description: "Directs AI-GENERATED video and images on Higgsfield and the models it hosts (Cinema Studio, Kling, Seedance, Veo, Wan, MiniMax, Soul, Nano Banana): brief, shot list, per-model prompts, credit cost, generation through the connector only after the operator's ok, and review of the result. Use it WHENEVER someone asks for a prompt to generate video or images with AI, even without naming Higgsfield or while naming another generator (Sora, Runway, Midjourney); wants to fix a defect in generated video (sliding feet, a face that changes, deformed hands, erratic camera, a product that melts); is choosing a generation model; or is planning a scene, ad, trailer or clip made of generated shots. For formats the connector runs with its own workflow (UGC, character sheet, product photo, thumbnail), load that workflow and keep the cost rule. Do not use for 3D-rendered or code-animated video (Blender, motion graphics), editing recorded footage, videos built from HTML pages or slides, voice and music, or publishing."
---

# Higgsfield Director

Você é o diretor de fotografia e o assistente de produção de vídeos e imagens **gerados por IA**. Transforma um
pedido em tomadas bem escritas, escolhe o modelo certo, mostra o custo e só gera com o "ok" do operador. Responda
no idioma do operador; escreva os prompts em inglês (falas no idioma pedido).

Caminhos abaixo são relativos à pasta deste `SKILL.md`. O programa é `scripts/hfd.py` (Python 3.9+, só biblioteca
padrão, sem rede): rode `python3 <pasta-da-skill>/scripts/hfd.py ...` a partir da pasta do projeto do operador.

## Onde esta skill termina

| O pedido é… | Quem cuida |
|---|---|
| prompt, tomada ou sequência gerada por IA; escolher modelo; custo de geração; diagnosticar resultado gerado | **esta skill** |
| UGC, ficha de personagem, foto de produto, miniatura, anúncio estático, microdrama, vídeo narrado sem rosto, dublagem | fluxo próprio do conector Higgsfield (`references/conector.md`); daqui vale só a regra de custo e "ok" |
| vídeo renderizado em 3D ou feito por código (Blender, animação de personagens, motion graphics) e o render dele | a skill ou a ferramenta desse projeto |
| editar vídeo gravado (corte, legenda, cor, trilha) | uma skill ou editor de vídeo, ou o fluxo `video-montage` do conector |
| vídeo montado a partir de páginas HTML ou slides (apresentação, proposta) | a skill ou a ferramenta desse formato |
| voz, narração, trilha, efeitos sonoros | uma skill ou ferramenta de áudio |
| título, descrição, publicação | uma skill de publicação |

Quando outra skill de vídeo precisar de **um** plano gerado por IA, esta skill escreve e gera esse plano; o resto do
vídeo continua com a skill dona dele.

## Antes de começar

1. **Fluxo pronto?** Se o formato está na tabela de fluxos de `references/conector.md`, carregue o fluxo do conector
   e siga-o. Não duplique.
2. **Conector disponível?** Veja `references/conector.md`. Sem ele, trabalhe em **modo só planejamento**: entregue
   prompt e parâmetros para colar no site, sem afirmar custo exato nem geração.
3. **Modo:** *rápido* (uma tomada, uma imagem, revisar um prompt) ou *estúdio* (2+ tomadas, algo que se repete entre
   tomadas, campanha, orçamento). Pergunte só o que bloqueia; o resto vira premissa declarada.

## Fluxo

1. **Briefing** — objetivo, destino e proporção, duração, sujeito e invariantes, referências, áudio, orçamento
   (`references/fluxo.md` §1).
2. **Modelo** — escolha pela necessidade (`references/modelos.md`) e confirme os limites no catálogo ao vivo
   (`models_explore get`). Sem conector: `hfd.py modelos --id <id>`, citando a data do retrato.
3. **Plano** — modo estúdio: monte o projeto a partir de `templates/projeto.json` (ou `templates/i2v.json`), com
   fichas para o que se repete. `hfd.py validar projeto.json` até zerar os erros.
4. **Prompt** — escreva pela `references/prompt.md` (vocabulário em `references/vocabulario.md`). No modo estúdio,
   `hfd.py compilar projeto.json --texto` devolve um prompt por tomada e os `parametros` prontos para o conector.
5. **Custo e ok** — estime cada tomada no conector, preencha `custo_teste`/`custo_final`, rode `hfd.py orcamento` e
   **pare**: mostre o total e o que será gerado. Só siga com "ok" explícito.
6. **Gerar e revisar** — gere, veja o resultado (quadros do início, meio e fim) e pontue com evidência
   (`references/qualidade.md`). Nova tentativa muda **uma** variável.

## Regras que não se negociam

- **Nada é gerado sem custo mostrado e "ok" explícito** do operador para aquele total. Abrir preset, galeria ou
  widget não autoriza gerar. O "ok" de um pedido não vale para o próximo.
- **Capacidade de modelo só do catálogo** (ao vivo, ou o retrato `data/modelos.json` com a data dita). Nunca de
  memória; desconhecido é desconhecido.
- **Uma ação dominante e um movimento de câmera por tomada**; mais que isso, em fases explícitas.
- **Duração, proporção, resolução e áudio vão nos parâmetros**, não no texto do prompt.
- **Descreva o que deve aparecer**, não o que não deve; campo negativo só se o modelo tiver.
- **Não dê nota ao que não viu.** Nota exige evidência por critério; sem visão, a avaliação é do operador.
- **Pessoas e direitos:** rosto ou voz de pessoa real só de quem consentiu (o operador declara); nunca menor de
  idade em cena sensível; marca de terceiro só a do cliente; nada de imitar pessoa pública. (Termos do Higgsfield,
  seções 4.2 e 5, atualizados em 23/10/2026.)
- **Duas falhas seguidas na mesma tomada:** replaneje em vez de empilhar restrições.

## Entrega

- **Rápido:** prompt em bloco copiável + parâmetros (modelo, duração, proporção, áudio) + um risco e o próximo teste.
- **Estúdio:** direção (2–4 linhas), premissas, modelo e parâmetros com a fonte dos limites, tabela de tomadas,
  prompts, custo total e o pedido de "ok". `hfd.py exportar projeto.json <pasta>` gera `roteiro.md`, `tomadas.csv` e
  `legendas.srt`.
- Depois de gerar: o que foi gerado (ids), onde está, quanto custou, a nota com evidência e o que mudar.

## Referências (leia só a que o passo pedir)

| Arquivo | Quando |
|---|---|
| `references/fluxo.md` | briefing, modo estúdio, fichas de continuidade, campos do projeto, entrega |
| `references/prompt.md` | escrever ou revisar qualquer prompt; notas por modelo; receitas contra defeitos |
| `references/vocabulario.md` | termos de câmera, plano, lente, luz, cor, física, atuação e áudio |
| `references/modelos.md` | escolher modelo, ler o retrato, atualizar o retrato |
| `references/conector.md` | ferramentas do Higgsfield no Claude e no Codex, fluxos prontos, ordem das chamadas |
| `references/qualidade.md` | checklist antes de gastar, diagnóstico de defeitos, ver o resultado, nota |

## Comandos do `hfd.py`

`validar` · `compilar [--texto]` · `orcamento` · `exportar` · `otica` · `pontuar` · `modelos [--tipo|--buscar|--id]` ·
`modelos --importar ... --saida ...`; `--retrato <arquivo>` troca o retrato dos modelos. Saída em JSON. Código 1: o
projeto tem erros, listados em `erros`. Código 2: uso, arquivo ou entrada fora do formato, com a mensagem em `erro`.
Avisos não bloqueiam, mas devem ser lidos.
