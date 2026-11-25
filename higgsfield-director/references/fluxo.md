# Fluxo de produção

## 1. Briefing (pergunte só o que bloqueia; o resto vira premissa declarada)

Objetivo e público · formato e destino (proporção) · duração total · sujeito e o que não pode mudar nele ·
referências que o operador tem (e o direito de usá-las) · tom e intenção · áudio (gerado, pós ou nenhum) ·
orçamento em créditos · modelo preferido (se houver).

## 2. Modo

- **Rápido** (uma tomada, uma imagem, revisar um prompt): sem projeto.json. Escreva o prompt pela
  `references/prompt.md`, confira limites no catálogo e entregue.
- **Estúdio** (2+ tomadas, personagem/produto que se repete, campanha, orçamento): monte o projeto a partir de
  `templates/projeto.json` (ou `templates/i2v.json`), valide e compile com `scripts/hfd.py`.

## 3. Estrutura por formato

| Formato | Esqueleto |
|---|---|
| Comercial de produto | imagem de referência do produto (a do cliente, ou uma gerada e aprovada antes) → detalhe/material com um momento de impacto → demonstração ou benefício → hero frame (produto inteiro e centrado, rótulo legível); texto e CTA na pós |
| Trailer | premissa → escalada → título (na pós) |
| Clipe musical | mapa de batidas fornecido pelo operador; tomadas cortadas na batida; direitos da música não se presumem |
| Documental | observação → contexto → fato verificável; luz disponível, poucos cortes |
| Cena narrativa | estabelecimento → ação → reação; eixo de 180° respeitado |
| Loop | último quadro = primeiro quadro (pose, câmera, luz, velocidade) |
| Campanha | mesmas fichas; varie **uma** dimensão por peça |

## 4. Fichas (bíblias) e continuidade

Cada personagem, produto, lugar ou marca que se repete ganha uma ficha em `biblias`:

```json
"P01": {"tipo": "produto", "descricao": "A black glass perfume bottle with a faceted gold cap...",
        "fixo": {"cor": "black", "tampa": "gold"}, "variavel": {"posicao": "pode mudar"}}
```

- `descricao` é copiada **igual** no início do prompt de toda tomada que lista a entidade em `entidades`: a mesma
  frase em todas é o que mais segura identidade entre gerações.
- `fixo` são invariantes; o `validar` acusa estado que contradiz a ficha.
- Cada tomada pode registrar `inicio` e `fim` por entidade; o `validar` compara o fim de uma com o início da próxima.
  Mudança de propósito vai em `mudancas_aprovadas: ["P01.posicao"]`.
- Para encadear tomadas, gere a tomada N, extraia o último quadro e use como `start_image` da N+1.

## 5. O projeto (campos que o `hfd.py` entende)

| Nível | Campo | O que é |
|---|---|---|
| projeto | `titulo`, `modelo` (id do catálogo), `modo` (`t2v`, `i2v`, `edit`, `extend`, `imagem`), `proporcao`, `resolucao` | escolhas globais |
| projeto | `biblias`, `restricoes` (frases positivas), `referencias`, `preservar` (i2v), `alvo` (edit), `eixo` [[x,y],[x,y]] | continuidade |
| tomada | `id`, `duracao` (s), `entidades` ou `sujeito`, `ambiente`, `acao`, `microacao`, `enquadramento`, `camera`, `otica`, `luz`, `estetica`, `atmosfera`, `secundario`, `final` | o prompt, nesta ordem |
| tomada | `som`, `falas` [{`quem`, `idioma`, `texto`}] | bloco de áudio |
| tomada | `inicio`, `fim`, `mudancas_aprovadas`, `camera_xy`, `cruzamento_motivado`, `linha_do_tempo` [{`trilha`,`de`,`ate`}] | checagens |
| tomada | `custo_teste`, `custo_final`, `tentativas` | orçamento (preço vindo da estimativa do conector) |

Limite atual: **um modelo e um modo por projeto**. Tomadas em modelos ou modos diferentes (uma em texto para
vídeo, outra a partir de imagem, outra no Kling) vão em arquivos de projeto separados.

## 6. Comandos

```bash
S=<pasta-da-skill>
python3 $S/scripts/hfd.py validar  projeto.json          # erros (exit 1) e avisos
python3 $S/scripts/hfd.py compilar projeto.json --texto  # prompts + parametros prontos para o conector
python3 $S/scripts/hfd.py orcamento projeto.json --reserva 20
python3 $S/scripts/hfd.py exportar projeto.json saida/   # roteiro.md, tomadas.csv, legendas.srt
python3 $S/scripts/hfd.py otica 85 2 1.8                 # campo de visão e faixa de foco
```

Os comandos leem e escrevem só os arquivos indicados; trabalhe na pasta do projeto do operador, nunca dentro da
pasta da skill.

## 7. Entrega

**Direção** (intenção e abordagem, 2–4 linhas) · **Premissas** · **Modelo e parâmetros** (com a data/fonte dos limites)
· **Prompt(s)** em bloco copiável · **Plano de tomadas** (estúdio) · **Custo** (estúdio, ou sempre que for gerar) ·
**Riscos e próximo teste**. Pedido simples: só prompt, parâmetros e um risco.

## 8. Depois da geração

Montagem, trilha, voz e legendas são de outras ferramentas: uma skill ou ferramenta de áudio para voz e trilha, um
editor de vídeo local, ou o fluxo `video-montage` do conector. Diga ao operador onde cada arquivo gerado está.
