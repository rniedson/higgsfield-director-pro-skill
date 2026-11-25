# Calibração às cegas: com e sem a skill

A pergunta que importa é "**para mim**, a skill faz diferença?". A resposta honesta vem de um teste às cegas: o mesmo
pedido, feito com e sem a skill, e a pessoa escolhe sem saber qual é qual. Se ela não escolhe a skill, a skill
precisa melhorar, e o resultado mostra onde.

A calibração é **opcional**: ofereça no primeiro uso (`references/modos.md`) e quando o operador pedir. Ela gasta
créditos (as tomadas das duas condições), cotados antes e com o "ok" dele.

## Passo a passo

1. **O pedido.** Um pedido real, do tipo que o operador costuma fazer (anúncio de produto, cena com personagem,
   trailer...). Fixe o modelo, a duração, a resolução e o som no próprio pedido, para as duas condições custarem o
   mesmo. Salve em `pedido.txt`.
2. **As duas condições, sem gastar.**
   - No Claude Code: `scripts/calibrar_claude_code.sh pedido.txt <pasta-nova>`. O roteiro abre duas sessões novas,
     uma com a skill e outra sem, com as ferramentas de gerar bloqueadas, e cada uma grava o seu `params.json`. Ele
     recusa rodar se a skill estiver instalada para o usuário inteiro, porque aí a sessão "sem" a veria.
   - Em outro ambiente: abra duas conversas novas, uma onde a skill não está instalada, cole o mesmo pedido e peça os
     parâmetros em JSON, sem gerar.
3. **Sorteio.** `hfd.py cego --com com/params.json --sem sem/params.json --saida <pasta>/cego`. O comando confere que
   as duas condições pedem o mesmo formato (modelo, duração, proporção, resolução, som), sorteia quem é X e quem é Y,
   grava `pedidos-cegos.json` e a chave (`chave-cega.json`, que só o dono do arquivo lê) **sem mostrá-la**. À parte,
   sorteia qual das duas aparece primeiro (`mostrar_primeiro`).
4. **Gerar.** Se alguma condição pediu uma imagem de referência, gere-a antes, com a cotação incluída. Cote o total,
   peça o "ok" e gere os pedidos de `pedidos-cegos.json` como estão.
5. **Votar.** Mostre primeiro a versão sorteada em `mostrar_primeiro` (à esquerda, ou tocando antes) e depois as duas
   juntas, lado a lado. Quem vê primeiro tende a escolher o primeiro; o sorteio separado espalha esse efeito, e o
   registro guarda a ordem (`--primeiro`) para o placar medi-lo. A pessoa escolhe X, Y ou empate e diz o motivo em
   poucas palavras. Registre o voto **antes** de abrir a chave.
6. **Notas (opcional).** Um avaliador que só vê o pedido e os vídeos (um subagente, sem acesso à chave nem aos
   prompts) preenche um `templates/avaliacao.json` para X e outro para Y.
7. **Registro.** `hfd.py resultado --chave <pasta>/cego/chave-cega.json --voto X --categoria anuncio-produto
   --modelo <id> --tomadas 3 --custo 90 --versao <versão>+<commit> [--referencia] [--motivo "..."]
   [--primeiro X] [--avaliacao-x x.json --avaliacao-y y.json] --saida calibracao/AAAA-MM-DD-<categoria>-<sufixo>.json`.
   O comando traduz o voto e a ordem pela chave e recusa campo fora da lista branca. `avaliador` diz quem deu as
   notas (`cego-automatico`, `pessoa` ou `nenhum`); o voto é sempre da pessoa.
8. **Mostre o registro inteiro** à pessoa. Só com o "pode" dela ele vira contribuição.

## Contribuir com o repositório

O registro vai para a pasta `calibracao/` do repositório por pull request (veja o CONTRIBUTING). O CI confere cada
arquivo pela mesma lista branca, e `tools/agregar_calibracao.py` soma tudo na tabela do README. Assim o placar
mostra, por tipo de pedido, onde a skill ganha e onde perde, e cada derrota vira correção.

| Entra no registro | Nunca entra |
|---|---|
| data, versão da skill, tipo de pedido, modelo, número de tomadas, créditos gastos, se usou imagem de referência | o texto do pedido, os prompts, as imagens e os vídeos |
| o voto (com, sem ou empate), qual versão foi vista primeiro e, se a pessoa quiser, o motivo em até 160 caracteres | nomes, clientes, marcas, links, e-mails, caminhos de arquivo |
| as notas do avaliador por critério | a chave do sorteio e os ids das gerações |

## Lições das primeiras calibrações

- Na primeira rodada, a versão sem a skill ganhou "pelo movimento, ação, emoção, som". A correção (impacto por
  tomada, movimento que cabe no estado final, imagem de referência do produto) virou regra em `references/prompt.md`.
- Na revanche, com as correções, a pessoa e o avaliador cego escolheram a versão com a skill nas duas rodadas, "pelo
  conjunto: a ligação de uma cena com outra". A própria pessoa lembrou que a versão com a skill tinha aparecido
  primeiro nas duas; daí o sorteio separado da ordem.
- Uma tomada pode ser recusada pelo filtro de direitos autorais do conector nas duas condições ao mesmo tempo. Não
  tente de novo sem o "ok": compare as tomadas que sobraram dos dois lados.
