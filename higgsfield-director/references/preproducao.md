# Pré-produção barata: da ideia ao roteiro oficial

Antes do storyboard final e de qualquer vídeo, a ideia amadurece onde errar custa pouco. Aqui o gasto é quase todo
de **tokens**, porque quem escreve a ideia e o roteiro é o agente (o conector não tem modelo de texto), mais uma
fração de crédito no croqui.

## Ordem

1. **Ideia:** uma frase (quem, o quê, a virada), mais formato, duração e destino.
2. **Esboço de roteiro:** tabela curta com tomada, duração, o que se vê e o que se ouve. Sem prosa.
3. **Croqui:** Fase A e depois Fase B (abaixo). Pose, ação, câmera e quem é quem.
4. **Refino:** ideia, roteiro e croqui mudam juntos. Reescreva só o trecho que mudou; refaça só o quadro que mudou.
5. **Roteiro oficial:** o operador trava a versão. Daqui em diante, mudar custa crédito.
6. **Áudio:** pergunte por onde gerar (abaixo) antes de qualquer gasto com voz.
7. **Storyboard final** com fichas e referências (`references/fluxo.md` §4), depois o teste em vídeo e o final.

## Gastar poucos tokens

- Pergunte só o que bloqueia; o resto vira premissa declarada.
- Um arquivo é a fonte (o projeto). A conversa não repete o roteiro inteiro a cada volta: mostre o que mudou.
- Tabela em vez de prosa.
- Olhar imagem gasta tokens: olhe cada folha uma vez e, nessa olhada, já ligue cada quadro a uma tomada e anote a
  caixa de recorte de cada um.
- Croqui é esboço. Não discuta detalhe de desenho nesta fase.

## Croqui

### Regras do desenho

- **Blocos.** Pessoas com cabeça oval, tronco retangular e membros em traço; objetos como caixas e círculos. Desenho
  detalhado faz o modelo inventar, e cada quadro sai com um objeto diferente.
- **Rosto só quando a expressão importa** para a tomada (um grito, um susto). Nas outras, cabeça lisa.
- **Um traço que identifica** cada personagem (um chapéu, o tamanho) e a **mesma descrição de formas** em todos os
  quadros.
- **Escala dita:** "três vezes mais alto que ele". Sem isso, o objeto grande encolhe.
- **Só quem aparece.** Cada quadro descreve só quem está nele, em frase normal. O formato "NOME = descrição" fez o
  modelo desenhar todos em todos os quadros e trocar um pelo outro.
- **Formas, não rótulos.** "Robô" virou um boneco com rosto; "uma caixa sobre esteira com uma lente redonda na
  frente, sem rosto" saiu igual em todos os quadros.
- **Nenhum número no prompt** (proporção, tempo): o modelo escreve o número na imagem. Peça "moldura bem larga".
- **Câmera vai na folha.** Inclinação, câmera baixa e movimento foram ignorados no croqui. Anote a câmera embaixo
  do quadro, na folha de aprovação, em vez de gastar crédito tentando.
- Cor pode escapar no objeto principal; aceite como cor de destaque.

### Fase A: folha única (explorar)

Um modelo de imagem rápido e barato, sem referência, desenha todas as tomadas numa folha só. Dentro da folha, o
desenho se repete; é o menor custo do catálogo e serve bem a quem ainda não sabe o que quer.

Limites: o modelo não obedece contagem nem ordem (pedidos 4 quadros, vieram 6) e às vezes põe a ação no personagem
errado. Ligue cada quadro a uma tomada; o que sobrar fica de fora.

```text
A storyboard sheet on off-white paper with four panels in a two by two grid, each panel a very rough abstract
pencil thumbnail: block figures and block objects, few quick lines, no shading, no background, no text, no numbers.
The same characters appear drawn exactly the same in every panel: <formas de cada um, com a escala>.
Top left: <ação>. Top right: <ação>. Bottom left: <ação>. Bottom right: <ação>.
```

### Fase B: quadros soltos (trabalhar)

1. **Recorte** a folha com as caixas anotadas na olhada (frações de 0 a 1):
   `python3 scripts/hfd.py recortar folha.png quadros/ T01:0.04,0.07,0.33,0.48 T02:0.35,0.07,0.65,0.48`.
   O comando só escreve os comandos do ffmpeg; rode-os. A detecção automática das molduras foi testada e
   descartada: a moldura desenhada é torta e falhada.
2. **Envie** cada recorte ao conector (`media_upload`, PUT, `media_confirm`). Enviar não custa crédito; um erro 5xx
   no PUT passou na segunda tentativa.
3. **Gere um quadro por tomada** num modelo de imagem barato que aceite referência, em qualidade baixa, com o
   recorte da própria tomada como referência e só o que muda no texto.

No teste, os quatro quadros saíram com o mesmo traço, o mesmo objeto e o mesmo personagem, as quatro ações certas,
e corrigiram o que a folha tinha errado. Cada quadro se refaz sozinho, sem refazer a folha.

```text
Redraw the reference panel as one full storyboard frame in exactly the same style: <as mesmas formas de cada um>.
Very rough abstract thumbnail, few lines, no background, no text, no frame border.
Changes: <o que muda nesta tomada>; blank head, no face <quando a expressão não importa>.
```

Os dois moldes foram testados em 25/11/2026 com `z_image` (Fase A) e `gpt_image_2` com `quality: low` (Fase B);
confirme os modelos no catálogo ao vivo. As negações curtas funcionaram neste estilo de rabisco; para vídeo, vale a
regra de descrever o que deve aparecer.

### Custo

Cote sempre; o preço muda. Na cotação do teste, a folha inteira da Fase A custou menos que um quadro da Fase B, e um
quadro da Fase B custou uma fração do quadro do storyboard final. O número exibido pode vir arredondado: o painel
mostrou um valor inteiro e cobrou o `credits_exact`. Mostre o exato ao operador e confira o saldo depois.

## Áudio: pergunte por onde

Com o roteiro oficial travado, e antes de qualquer gasto com voz, pergunte por onde gerar o áudio:

- pelo conector (modelos de voz e música do catálogo; cote);
- por um serviço que o operador já usa (a conta e o custo são dele);
- a própria voz gravada;
- uma voz sintética local e gratuita, só para rascunho (a voz do sistema operacional, por exemplo);
- nenhum: o som entra na pós.

Na fase de ideia, o rascunho gratuito basta. Narração ou voz em off vem antes do vídeo, porque o tempo da voz decide
o tempo das tomadas. Fala em cena sai do modelo de vídeo com som ou de uma etapa de sincronia labial: pergunte qual é
o caso antes de gerar. Anote a escolha nas premissas do projeto.
