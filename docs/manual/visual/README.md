# Ilustrações do manual

185 imagens esquemáticas usadas no [manual ilustrado](../README.md). São geradas por código (formas, gradientes e
projeções geométricas): não são fotografias nem renders do Higgsfield e não provam como um modelo se comporta.

| Pasta | Conteúdo | Quantidade |
|---|---|:---:|
| `assets/` | 20 diagramas de movimento de câmera (`CAM`), 20 animações (`GIF`), 8 esquemas de luz (`LGT`), 4 de óptica (`OPT`), 10 fichas (`SHT`) e 3 pranchas (`BOARD`) | 65 |
| `atlas/` | estudos do mesmo objeto variando lente, distância e paleta | 100 |
| `style/` | estudos de paleta de 20 estilos visuais, em SVG | 20 |

Cada pasta tem um catálogo com id, título, descrição e prompt de cada imagem: `index.json` (para `assets/`),
`atlas.json` e `style/index.json`.

Limites: as fichas são exemplos esquemáticos, não referências de identidade; luz e óptica são aproximações didáticas;
as animações simplificam as trajetórias (principalmente roll e crane). O cálculo exato de campo de visão e foco está em
`hfd.py otica`.

Direitos de uso: [VISUAL-RIGHTS.md](VISUAL-RIGHTS.md).
