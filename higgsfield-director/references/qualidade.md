# Qualidade: antes e depois de gerar

## Antes de gastar (checklist)

- [ ] O formato não é um fluxo pronto do conector (`references/conector.md`).
- [ ] Modelo confirmado no catálogo ao vivo; duração, proporção, resolução e áudio dentro dos limites.
- [ ] `hfd.py validar` sem erros; avisos lidos e aceitos ou resolvidos.
- [ ] Cada tomada tem **uma** ação dominante e **um** movimento principal (ou fases explícitas).
- [ ] A fala cabe na duração; quem fala está rotulado.
- [ ] Sem instrução negativa solta ("no X") onde dá para dizer o positivo.
- [ ] Referências enviadas são do operador ou autorizadas; pessoa real com consentimento.
- [ ] Custo estimado pelo conector e "ok" explícito do operador com o total.

## Diagnóstico (sintoma → hipótese → mudança → como conferir)

| Sintoma | Hipótese provável | Mude (uma coisa) | Confira |
|---|---|---|---|
| Rosto muda entre quadros | referência fraca, rotação grande | fixe a referência, reduza a órbita, encurte | compare rosto no início e no fim |
| Mãos/dedos deformados | gestos simultâneos, mão em primeiro plano | um gesto só, mão menor no quadro | quadro a quadro na mão |
| Pés deslizando | caminhada sem contato descrito | "each planted foot stays fixed until lifted"; percurso simples | contato com o chão |
| Câmera errática | dois movimentos ou nenhum definido | um movimento, velocidade constante | trajetória do início ao fim |
| Produto deformado / rótulo derrete | oclusão, órbita rápida, texto pequeno | órbita mais lenta, menos oclusão, texto na pós | rótulo legível em todos os quadros |
| Texto ilegível | modelos geram texto mal | texto e logo na pós; para imagem, `nano_banana_pro`/`ideogram` | leitura humana |
| Cintilação de luz | luz não fixada | "constant key light and exposure throughout" | luminância ao longo do tempo |
| Física estranha (líquido, tecido) | força e material não descritos | direção da força, material, atraso | movimento coerente com o peso |
| Sincronia labial ruim | fala longa, rosto mexendo muito | fala mais curta, menos movimento de cabeça | boca nas sílabas fortes |
| Loop com salto | pontas diferentes | alinhar pose, câmera, luz e velocidade | primeiro × último quadro |
| Ignora o pedido | prompt longo demais ou contraditório | encurte; tire o que conflita | cada elemento pedido aparece? |

Duas falhas seguidas na mesma tomada: **replaneje** (outro enquadramento, outro modelo, tomada mais curta) em vez
de acumular restrições. Hipótese não é causa: registre o que mudou e o que aconteceu.

## Ver o resultado

Não dê nota a vídeo que não viu. Para olhar um vídeo gerado, extraia quadros do **início, meio e fim de cada
tomada** (um quadro só do meio esconde defeito de entrada e de saída):

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4
ffmpeg -v error -ss 0.2 -i video.mp4 -frames:v 1 q_inicio.jpg
ffmpeg -v error -ss <meio> -i video.mp4 -frames:v 1 q_meio.jpg
ffmpeg -v error -sseof -0.2 -i video.mp4 -frames:v 1 q_fim.jpg
```

Sem capacidade de ver imagem, peça a descrição ao operador e diga que a avaliação é dele.

## Nota com evidência

`templates/avaliacao.json` → `hfd.py pontuar`. Critérios e pesos (`data/pesos.json`): identidade 20, movimento 15,
câmera 15, briefing 15, luz 10, materiais 10, continuidade 10, áudio 5. Cada critério leva nota 0–10 **e** a
evidência (o que se viu, em que segundo); "não se aplica" exige o motivo. 90+ excelente; 80–89 aprovado com ajustes;
65–79 revisar; abaixo de 65 reprovado. **Falha crítica bloqueia** qualquer média: identidade de pessoa real
alterada, rótulo ou marca do cliente deformado, texto indevido ou marca d'água, conteúdo fora da política.
