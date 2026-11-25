<div align="center">

<img src="../assets/emblem.svg" alt="Higgsfield Director PRO emblem" width="360">

# HIGGSFIELD DIRECTOR PRO

### Illustrated direction manual · 11 parts

**Camera · Framing · Optics · Light · Color · Acting · Physics · Time · Audio · Continuity · Production**

![Parts](https://img.shields.io/badge/parts-11-475569)
![Illustrations](https://img.shields.io/badge/illustrations-185-bca271)
![Type](https://img.shields.io/badge/images-schematic-6d8b9c)
![License](https://img.shields.io/badge/license-CC%20BY--SA%204.0-6d8b9c)

[Main README](../../README.md) · [Skill vocabulary](../../higgsfield-director/references/vocabulary.md) ·
[Optical atlas](#optical-atlas--100-studies) · [Camera diagrams](#camera-diagrams) ·
[License](#license-and-origin)

</div>

> **Unofficial project.** This manual is part of an independent project, not affiliated with or approved by
> Higgsfield. The name Higgsfield appears only to say which service the skill works with.

> **Schematic images.** Diagrams, spheres, sheets and geometric projections made to explain direction. They are
> not photographs or Higgsfield renders, and they do not prove how any model behaves. Text and images under
> [CC BY-SA 4.0](LICENSE-DOCS.md).

## How to read each part

Each part gives the rule, a **positive prompt**, what to **avoid** and the illustrations. The check is the same
in all of them: does the image or the sequence keep the intent, the geometry and the continuity? A good prompt
does not guarantee the render. To write the actual prompt, the skill uses
[`references/prompt.md`](../../higgsfield-director/references/prompt.md).

| Part | Topic | Illustrations |
|:---:|---|:---:|
| 01 | [Camera and movement](#part-01--camera-and-movement) | 21 |
| 02 | [Framing and composition](#part-02--framing-and-composition) | — |
| 03 | [Cameras, lenses and optics](#part-03--cameras-lenses-and-optics) | 5 |
| 04 | [Cinematic lighting](#part-04--cinematic-lighting) | 9 |
| 05 | [Color and visual styles](#part-05--color-and-visual-styles) | 22 |
| 06 | [Acting and emotions](#part-06--acting-and-emotions) | 2 |
| 07 | [Physics, materials and VFX](#part-07--physics-materials-and-vfx) | 2 |
| 08 | [Time, transitions and editing](#part-08--time-transitions-and-editing) | — |
| 09 | [Audio and sound direction](#part-09--audio-and-sound-direction) | 1 |
| 10 | [Continuity and diagnostics](#part-10--continuity-and-diagnostics) | 2 |
| 11 | [Prompt engineering and production](#part-11--prompt-engineering-and-production) | 3 |
| — | [Optical atlas — 100 studies](#optical-atlas--100-studies) | 100 |
| — | [Camera diagrams](#camera-diagrams) | 20 |

## Part 01 — Camera and movement

A physical dolly changes position; a zoom changes the field of view. Use one dominant movement per shot.

| Positive prompt | Avoid |
|---|---|
| `Slow dolly in, fixed focal length, smooth ease-out.` | `Static camera with continuous physical dolly.` |

|   |   |   |   |
|:---:|:---:|:---:|:---:|
| <img src="visual/assets/GIF001.gif" width="190" alt="Dolly In"><br><b>Dolly In</b> | <img src="visual/assets/GIF002.gif" width="190" alt="Dolly Out"><br><b>Dolly Out</b> | <img src="visual/assets/GIF003.gif" width="190" alt="Truck Left"><br><b>Truck Left</b> | <img src="visual/assets/GIF004.gif" width="190" alt="Truck Right"><br><b>Truck Right</b> |
| <img src="visual/assets/GIF005.gif" width="190" alt="Orbit Clockwise"><br><b>Orbit Clockwise</b> | <img src="visual/assets/GIF006.gif" width="190" alt="Orbit Counterclockwise"><br><b>Orbit Counterclockwise</b> | <img src="visual/assets/GIF007.gif" width="190" alt="Crane Up"><br><b>Crane Up</b> | <img src="visual/assets/GIF008.gif" width="190" alt="Crane Down"><br><b>Crane Down</b> |
| <img src="visual/assets/GIF009.gif" width="190" alt="Pan Left"><br><b>Pan Left</b> | <img src="visual/assets/GIF010.gif" width="190" alt="Pan Right"><br><b>Pan Right</b> | <img src="visual/assets/GIF011.gif" width="190" alt="Tilt Up"><br><b>Tilt Up</b> | <img src="visual/assets/GIF012.gif" width="190" alt="Tilt Down"><br><b>Tilt Down</b> |
| <img src="visual/assets/GIF013.gif" width="190" alt="Zoom In"><br><b>Zoom In</b> | <img src="visual/assets/GIF014.gif" width="190" alt="Zoom Out"><br><b>Zoom Out</b> | <img src="visual/assets/GIF015.gif" width="190" alt="Static"><br><b>Static</b> | <img src="visual/assets/GIF016.gif" width="190" alt="Arc Left"><br><b>Arc Left</b> |
| <img src="visual/assets/GIF017.gif" width="190" alt="Arc Right"><br><b>Arc Right</b> | <img src="visual/assets/GIF018.gif" width="190" alt="Pedestal Up"><br><b>Pedestal Up</b> | <img src="visual/assets/GIF019.gif" width="190" alt="Pedestal Down"><br><b>Pedestal Down</b> | <img src="visual/assets/GIF020.gif" width="190" alt="Camera Roll"><br><b>Camera Roll</b> |

<p align="center"><img src="visual/assets/BOARD_camera.png" width="640" alt="Camera board"><br><b>Camera board</b></p>

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 02 — Framing and composition

An extreme wide establishes the scene; a full shot shows the body; a medium shows the action; a close-up stresses
emotion; an extreme close-up isolates a detail.

| Positive prompt | Avoid |
|---|---|
| `Medium close-up, eyes on upper third, clean headroom.` | `Extreme close-up showing the entire landscape.` |



<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 03 — Cameras, lenses and optics

14 mm widens the field; 35 mm gives context; 50 mm balances; 85 mm isolates; 200 mm narrows the field. Perspective
depends on position.

| Positive prompt | Avoid |
|---|---|
| `85mm look, shallow depth of field, focus on eyes.` | `Everything sharp with extreme shallow focus.` |

|   |   |   |   |
|:---:|:---:|:---:|:---:|
| <img src="visual/assets/OPT001.png" width="190" alt="Deep focus"><br><b>Deep focus</b> | <img src="visual/assets/OPT002.png" width="190" alt="Moderate depth"><br><b>Moderate depth</b> | <img src="visual/assets/OPT003.png" width="190" alt="Shallow depth"><br><b>Shallow depth</b> | <img src="visual/assets/OPT004.png" width="190" alt="Extreme shallow depth"><br><b>Extreme shallow depth</b> |

<p align="center"><img src="visual/assets/BOARD_optics.png" width="640" alt="Optics board"><br><b>Optics board</b></p>

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 04 — Cinematic lighting

Rembrandt: a lit triangle; butterfly: high front light; split: half in shadow; rim: outline; volumetric: scattering
in a medium.

| Positive prompt | Avoid |
|---|---|
| `Soft key at 45 degrees, controlled rim, stable exposure.` | `Randomly changing light direction every frame.` |

|   |   |   |   |
|:---:|:---:|:---:|:---:|
| <img src="visual/assets/LGT001.png" width="190" alt="Front lighting"><br><b>Front lighting</b> | <img src="visual/assets/LGT002.png" width="190" alt="Side lighting"><br><b>Side lighting</b> | <img src="visual/assets/LGT003.png" width="190" alt="Top lighting"><br><b>Top lighting</b> | <img src="visual/assets/LGT004.png" width="190" alt="Under lighting"><br><b>Under lighting</b> |
| <img src="visual/assets/LGT005.png" width="190" alt="Cross lighting"><br><b>Cross lighting</b> | <img src="visual/assets/LGT006.png" width="190" alt="Back lighting"><br><b>Back lighting</b> | <img src="visual/assets/LGT007.png" width="190" alt="Soft lighting"><br><b>Soft lighting</b> | <img src="visual/assets/LGT008.png" width="190" alt="Hard lighting"><br><b>Hard lighting</b> |

<p align="center"><img src="visual/assets/BOARD_lighting.png" width="640" alt="Lighting board"><br><b>Lighting board</b></p>

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 05 — Color and visual styles

Keep palette, contrast, texture and aesthetic separate. A LUT does not fix exposure automatically.

| Positive prompt | Avoid |
|---|---|
| `Neo noir, restrained cyan shadows, warm practicals.` | `Unmotivated color shifts between frames.` |


|   |   |   |   |
|:---:|:---:|:---:|:---:|
| <img src="visual/style/ST01.svg" width="190" alt="Photorealism"><br><b>Photorealism</b><br><sub>Natural light, plausible materials, restrained grading</sub><br><sub><code>Photorealism, natural light, plausible materials, restrained grading, coherent visual direction.</code></sub> | <img src="visual/style/ST02.svg" width="190" alt="Neo Noir"><br><b>Neo Noir</b><br><sub>Low-key lighting, rain, deep shadows</sub><br><sub><code>Neo Noir, low-key lighting, rain, deep shadows, coherent visual direction.</code></sub> | <img src="visual/style/ST03.svg" width="190" alt="Cyberpunk"><br><b>Cyberpunk</b><br><sub>Neon, dense futuristic city</sub><br><sub><code>Cyberpunk, neon, dense futuristic city, coherent visual direction.</code></sub> | <img src="visual/style/ST04.svg" width="190" alt="Solarpunk"><br><b>Solarpunk</b><br><sub>Green architecture, daylight</sub><br><sub><code>Solarpunk, green architecture, daylight, coherent visual direction.</code></sub> |
| <img src="visual/style/ST05.svg" width="190" alt="Steampunk"><br><b>Steampunk</b><br><sub>Brass, industrial machinery</sub><br><sub><code>Steampunk, brass, industrial machinery, coherent visual direction.</code></sub> | <img src="visual/style/ST06.svg" width="190" alt="Dark Fantasy"><br><b>Dark Fantasy</b><br><sub>Gothic silhouettes, mist</sub><br><sub><code>Dark Fantasy, gothic silhouettes, mist, coherent visual direction.</code></sub> | <img src="visual/style/ST07.svg" width="190" alt="Luxury Editorial"><br><b>Luxury Editorial</b><br><sub>Controlled reflections, premium materials</sub><br><sub><code>Luxury Editorial, controlled reflections, premium materials, coherent visual direction.</code></sub> | <img src="visual/style/ST08.svg" width="190" alt="Surrealism"><br><b>Surrealism</b><br><sub>Impossible scale and spatial logic</sub><br><sub><code>Surrealism, impossible scale and spatial logic, coherent visual direction.</code></sub> |
| <img src="visual/style/ST09.svg" width="190" alt="Analog Horror"><br><b>Analog Horror</b><br><sub>Muted green, VHS texture</sub><br><sub><code>Analog Horror, muted green, vhs texture, coherent visual direction.</code></sub> | <img src="visual/style/ST10.svg" width="190" alt="Claymation"><br><b>Claymation</b><br><sub>Handmade forms, soft texture</sub><br><sub><code>Claymation, handmade forms, soft texture, coherent visual direction.</code></sub> | <img src="visual/style/ST11.svg" width="190" alt="2D Anime"><br><b>2D Anime</b><br><sub>Cel shading, graphic contours</sub><br><sub><code>2D Anime, cel shading, graphic contours, coherent visual direction.</code></sub> | <img src="visual/style/ST12.svg" width="190" alt="Brutalism"><br><b>Brutalism</b><br><sub>Concrete, monumental geometry</sub><br><sub><code>Brutalism, concrete, monumental geometry, coherent visual direction.</code></sub> |
| <img src="visual/style/ST13.svg" width="190" alt="Retrofuturism"><br><b>Retrofuturism</b><br><sub>Space-age curves, vintage palette</sub><br><sub><code>Retrofuturism, space-age curves, vintage palette, coherent visual direction.</code></sub> | <img src="visual/style/ST14.svg" width="190" alt="Dreamcore"><br><b>Dreamcore</b><br><sub>Pastel haze, liminal spaces</sub><br><sub><code>Dreamcore, pastel haze, liminal spaces, coherent visual direction.</code></sub> | <img src="visual/style/ST15.svg" width="190" alt="Art Deco"><br><b>Art Deco</b><br><sub>Symmetry, gold geometry</sub><br><sub><code>Art Deco, symmetry, gold geometry, coherent visual direction.</code></sub> | <img src="visual/style/ST16.svg" width="190" alt="Vaporwave"><br><b>Vaporwave</b><br><sub>Pastel neon, digital nostalgia</sub><br><sub><code>Vaporwave, pastel neon, digital nostalgia, coherent visual direction.</code></sub> |
| <img src="visual/style/ST17.svg" width="190" alt="Space Opera"><br><b>Space Opera</b><br><sub>Epic scale, cosmic contrast</sub><br><sub><code>Space Opera, epic scale, cosmic contrast, coherent visual direction.</code></sub> | <img src="visual/style/ST18.svg" width="190" alt="Post-Apocalyptic"><br><b>Post-Apocalyptic</b><br><sub>Weathered ruins, vegetation</sub><br><sub><code>Post-Apocalyptic, weathered ruins, vegetation, coherent visual direction.</code></sub> | <img src="visual/style/ST19.svg" width="190" alt="German Expressionism"><br><b>German Expressionism</b><br><sub>Angular sets, distorted shadows</sub><br><sub><code>German Expressionism, angular sets, distorted shadows, coherent visual direction.</code></sub> | <img src="visual/style/ST20.svg" width="190" alt="Miniature Diorama"><br><b>Miniature Diorama</b><br><sub>Small-scale sets, selective focus</sub><br><sub><code>Miniature Diorama, small-scale sets, selective focus, coherent visual direction.</code></sub> |

|   |   |
|:---:|:---:|
| <img src="visual/assets/SHT007.png" width="400" alt="Warm luxury moodboard"><br><b>Warm luxury moodboard</b> | <img src="visual/assets/SHT008.png" width="400" alt="Cool noir moodboard"><br><b>Cool noir moodboard</b> |

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 06 — Acting and emotions

Describe observable intent: gaze, breathing, pause, gesture and weight shift.

| Positive prompt | Avoid |
|---|---|
| `Subtle inhale, gaze shifts left, relaxed shoulders.` | `Multiple conflicting facial expressions simultaneously.` |


|   |   |
|:---:|:---:|
| <img src="visual/assets/SHT001.png" width="400" alt="Character turnaround"><br><b>Character turnaround</b> | <img src="visual/assets/SHT002.png" width="400" alt="Expression sheet"><br><b>Expression sheet</b> |

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 07 — Physics, materials and VFX

Define mass, contact, inertia, rigidity, reflection and end state.

| Positive prompt | Avoid |
|---|---|
| `Rigid glass bottle, stable label, realistic reflections.` | `Rigid glass bends randomly without motivation.` |


|   |   |
|:---:|:---:|
| <img src="visual/assets/SHT003.png" width="400" alt="Product orthographic views"><br><b>Product orthographic views</b> | <img src="visual/assets/SHT004.png" width="400" alt="Material and label zones"><br><b>Material and label zones</b> |

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 08 — Time, transitions and editing

A match cut connects shapes; a whip pan uses blur; bullet time stylizes time; a speed ramp varies speed.

| Positive prompt | Avoid |
|---|---|
| `Match cut between circular silhouettes, preserve screen direction.` | `Unmotivated jump cuts in a continuous single shot.` |



<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 09 — Audio and sound direction

Keep dialogue, ambience, foley, effects and music separate; plan the sync.

| Positive prompt | Avoid |
|---|---|
| `Quiet room tone, synchronized footsteps, no music.` | `Unmotivated loud effects masking dialogue.` |



```mermaid

flowchart LR

  D[Dialogue] --> M[Mix]

  A[Ambience] --> M

  F[Foley] --> M

  S[SFX] --> M

  U[Music] --> M

  M --> Q[Review]

```

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 10 — Continuity and diagnostics

Lock identity, geometry, wardrobe, axis, light direction and start/end states.

| Positive prompt | Avoid |
|---|---|
| `Preserve facial features, wardrobe and screen direction.` | `Change face and wardrobe between matching shots.` |


|   |   |
|:---:|:---:|
| <img src="visual/assets/SHT005.png" width="400" alt="World floor plan"><br><b>World floor plan</b> | <img src="visual/assets/SHT006.png" width="400" alt="World day and night"><br><b>World day and night</b> |

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Part 11 — Prompt engineering and production

Briefing → references → shot list → prompt → cost and ok → generation through the connector → QA → post.

| Positive prompt | Avoid |
|---|---|
| `Luxury perfume bottle, slow orbit, soft rim, preserve label.` | `Random camera moves, conflicting lighting, changing product.` |


|   |   |
|:---:|:---:|
| <img src="visual/assets/SHT009.png" width="400" alt="Editorial lookbook"><br><b>Editorial lookbook</b> | <img src="visual/assets/SHT010.png" width="400" alt="Minimal product lookbook"><br><b>Minimal product lookbook</b> |

```mermaid
flowchart TD
  B[Brief] --> R[References] --> P[Shot list] --> C[Compile<br/>hfd.py] --> K[Cost + ok] --> G[Generate<br/>Higgsfield MCP] --> Q[QA] --> E[Edit]
  Q --> C
```

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Optical atlas — 100 studies

Geometric projections of the same object, varying lens, distance and palette. They are for comparing field of view
and framing; they are not photographs. The exact field-of-view and focus calculation is in `hfd.py optics`.

|   |   |   |   |   |
|:---:|:---:|:---:|:---:|:---:|
| <img src="visual/atlas/AT001.png" width="150" alt="24mm 2m Noir"><br><b>24mm 2m Noir</b> | <img src="visual/atlas/AT002.png" width="150" alt="24mm 2m Amber"><br><b>24mm 2m Amber</b> | <img src="visual/atlas/AT003.png" width="150" alt="24mm 2m Arctic"><br><b>24mm 2m Arctic</b> | <img src="visual/atlas/AT004.png" width="150" alt="24mm 2m Pastel"><br><b>24mm 2m Pastel</b> | <img src="visual/atlas/AT005.png" width="150" alt="24mm 2m Forest"><br><b>24mm 2m Forest</b> |
| <img src="visual/atlas/AT006.png" width="150" alt="24mm 4m Noir"><br><b>24mm 4m Noir</b> | <img src="visual/atlas/AT007.png" width="150" alt="24mm 4m Amber"><br><b>24mm 4m Amber</b> | <img src="visual/atlas/AT008.png" width="150" alt="24mm 4m Arctic"><br><b>24mm 4m Arctic</b> | <img src="visual/atlas/AT009.png" width="150" alt="24mm 4m Pastel"><br><b>24mm 4m Pastel</b> | <img src="visual/atlas/AT010.png" width="150" alt="24mm 4m Forest"><br><b>24mm 4m Forest</b> |
| <img src="visual/atlas/AT011.png" width="150" alt="24mm 6m Noir"><br><b>24mm 6m Noir</b> | <img src="visual/atlas/AT012.png" width="150" alt="24mm 6m Amber"><br><b>24mm 6m Amber</b> | <img src="visual/atlas/AT013.png" width="150" alt="24mm 6m Arctic"><br><b>24mm 6m Arctic</b> | <img src="visual/atlas/AT014.png" width="150" alt="24mm 6m Pastel"><br><b>24mm 6m Pastel</b> | <img src="visual/atlas/AT015.png" width="150" alt="24mm 6m Forest"><br><b>24mm 6m Forest</b> |
| <img src="visual/atlas/AT016.png" width="150" alt="24mm 8m Noir"><br><b>24mm 8m Noir</b> | <img src="visual/atlas/AT017.png" width="150" alt="24mm 8m Amber"><br><b>24mm 8m Amber</b> | <img src="visual/atlas/AT018.png" width="150" alt="24mm 8m Arctic"><br><b>24mm 8m Arctic</b> | <img src="visual/atlas/AT019.png" width="150" alt="24mm 8m Pastel"><br><b>24mm 8m Pastel</b> | <img src="visual/atlas/AT020.png" width="150" alt="24mm 8m Forest"><br><b>24mm 8m Forest</b> |
| <img src="visual/atlas/AT021.png" width="150" alt="35mm 2m Noir"><br><b>35mm 2m Noir</b> | <img src="visual/atlas/AT022.png" width="150" alt="35mm 2m Amber"><br><b>35mm 2m Amber</b> | <img src="visual/atlas/AT023.png" width="150" alt="35mm 2m Arctic"><br><b>35mm 2m Arctic</b> | <img src="visual/atlas/AT024.png" width="150" alt="35mm 2m Pastel"><br><b>35mm 2m Pastel</b> | <img src="visual/atlas/AT025.png" width="150" alt="35mm 2m Forest"><br><b>35mm 2m Forest</b> |
| <img src="visual/atlas/AT026.png" width="150" alt="35mm 4m Noir"><br><b>35mm 4m Noir</b> | <img src="visual/atlas/AT027.png" width="150" alt="35mm 4m Amber"><br><b>35mm 4m Amber</b> | <img src="visual/atlas/AT028.png" width="150" alt="35mm 4m Arctic"><br><b>35mm 4m Arctic</b> | <img src="visual/atlas/AT029.png" width="150" alt="35mm 4m Pastel"><br><b>35mm 4m Pastel</b> | <img src="visual/atlas/AT030.png" width="150" alt="35mm 4m Forest"><br><b>35mm 4m Forest</b> |
| <img src="visual/atlas/AT031.png" width="150" alt="35mm 6m Noir"><br><b>35mm 6m Noir</b> | <img src="visual/atlas/AT032.png" width="150" alt="35mm 6m Amber"><br><b>35mm 6m Amber</b> | <img src="visual/atlas/AT033.png" width="150" alt="35mm 6m Arctic"><br><b>35mm 6m Arctic</b> | <img src="visual/atlas/AT034.png" width="150" alt="35mm 6m Pastel"><br><b>35mm 6m Pastel</b> | <img src="visual/atlas/AT035.png" width="150" alt="35mm 6m Forest"><br><b>35mm 6m Forest</b> |
| <img src="visual/atlas/AT036.png" width="150" alt="35mm 8m Noir"><br><b>35mm 8m Noir</b> | <img src="visual/atlas/AT037.png" width="150" alt="35mm 8m Amber"><br><b>35mm 8m Amber</b> | <img src="visual/atlas/AT038.png" width="150" alt="35mm 8m Arctic"><br><b>35mm 8m Arctic</b> | <img src="visual/atlas/AT039.png" width="150" alt="35mm 8m Pastel"><br><b>35mm 8m Pastel</b> | <img src="visual/atlas/AT040.png" width="150" alt="35mm 8m Forest"><br><b>35mm 8m Forest</b> |
| <img src="visual/atlas/AT041.png" width="150" alt="50mm 2m Noir"><br><b>50mm 2m Noir</b> | <img src="visual/atlas/AT042.png" width="150" alt="50mm 2m Amber"><br><b>50mm 2m Amber</b> | <img src="visual/atlas/AT043.png" width="150" alt="50mm 2m Arctic"><br><b>50mm 2m Arctic</b> | <img src="visual/atlas/AT044.png" width="150" alt="50mm 2m Pastel"><br><b>50mm 2m Pastel</b> | <img src="visual/atlas/AT045.png" width="150" alt="50mm 2m Forest"><br><b>50mm 2m Forest</b> |
| <img src="visual/atlas/AT046.png" width="150" alt="50mm 4m Noir"><br><b>50mm 4m Noir</b> | <img src="visual/atlas/AT047.png" width="150" alt="50mm 4m Amber"><br><b>50mm 4m Amber</b> | <img src="visual/atlas/AT048.png" width="150" alt="50mm 4m Arctic"><br><b>50mm 4m Arctic</b> | <img src="visual/atlas/AT049.png" width="150" alt="50mm 4m Pastel"><br><b>50mm 4m Pastel</b> | <img src="visual/atlas/AT050.png" width="150" alt="50mm 4m Forest"><br><b>50mm 4m Forest</b> |
| <img src="visual/atlas/AT051.png" width="150" alt="50mm 6m Noir"><br><b>50mm 6m Noir</b> | <img src="visual/atlas/AT052.png" width="150" alt="50mm 6m Amber"><br><b>50mm 6m Amber</b> | <img src="visual/atlas/AT053.png" width="150" alt="50mm 6m Arctic"><br><b>50mm 6m Arctic</b> | <img src="visual/atlas/AT054.png" width="150" alt="50mm 6m Pastel"><br><b>50mm 6m Pastel</b> | <img src="visual/atlas/AT055.png" width="150" alt="50mm 6m Forest"><br><b>50mm 6m Forest</b> |
| <img src="visual/atlas/AT056.png" width="150" alt="50mm 8m Noir"><br><b>50mm 8m Noir</b> | <img src="visual/atlas/AT057.png" width="150" alt="50mm 8m Amber"><br><b>50mm 8m Amber</b> | <img src="visual/atlas/AT058.png" width="150" alt="50mm 8m Arctic"><br><b>50mm 8m Arctic</b> | <img src="visual/atlas/AT059.png" width="150" alt="50mm 8m Pastel"><br><b>50mm 8m Pastel</b> | <img src="visual/atlas/AT060.png" width="150" alt="50mm 8m Forest"><br><b>50mm 8m Forest</b> |
| <img src="visual/atlas/AT061.png" width="150" alt="85mm 2m Noir"><br><b>85mm 2m Noir</b> | <img src="visual/atlas/AT062.png" width="150" alt="85mm 2m Amber"><br><b>85mm 2m Amber</b> | <img src="visual/atlas/AT063.png" width="150" alt="85mm 2m Arctic"><br><b>85mm 2m Arctic</b> | <img src="visual/atlas/AT064.png" width="150" alt="85mm 2m Pastel"><br><b>85mm 2m Pastel</b> | <img src="visual/atlas/AT065.png" width="150" alt="85mm 2m Forest"><br><b>85mm 2m Forest</b> |
| <img src="visual/atlas/AT066.png" width="150" alt="85mm 4m Noir"><br><b>85mm 4m Noir</b> | <img src="visual/atlas/AT067.png" width="150" alt="85mm 4m Amber"><br><b>85mm 4m Amber</b> | <img src="visual/atlas/AT068.png" width="150" alt="85mm 4m Arctic"><br><b>85mm 4m Arctic</b> | <img src="visual/atlas/AT069.png" width="150" alt="85mm 4m Pastel"><br><b>85mm 4m Pastel</b> | <img src="visual/atlas/AT070.png" width="150" alt="85mm 4m Forest"><br><b>85mm 4m Forest</b> |
| <img src="visual/atlas/AT071.png" width="150" alt="85mm 6m Noir"><br><b>85mm 6m Noir</b> | <img src="visual/atlas/AT072.png" width="150" alt="85mm 6m Amber"><br><b>85mm 6m Amber</b> | <img src="visual/atlas/AT073.png" width="150" alt="85mm 6m Arctic"><br><b>85mm 6m Arctic</b> | <img src="visual/atlas/AT074.png" width="150" alt="85mm 6m Pastel"><br><b>85mm 6m Pastel</b> | <img src="visual/atlas/AT075.png" width="150" alt="85mm 6m Forest"><br><b>85mm 6m Forest</b> |
| <img src="visual/atlas/AT076.png" width="150" alt="85mm 8m Noir"><br><b>85mm 8m Noir</b> | <img src="visual/atlas/AT077.png" width="150" alt="85mm 8m Amber"><br><b>85mm 8m Amber</b> | <img src="visual/atlas/AT078.png" width="150" alt="85mm 8m Arctic"><br><b>85mm 8m Arctic</b> | <img src="visual/atlas/AT079.png" width="150" alt="85mm 8m Pastel"><br><b>85mm 8m Pastel</b> | <img src="visual/atlas/AT080.png" width="150" alt="85mm 8m Forest"><br><b>85mm 8m Forest</b> |
| <img src="visual/atlas/AT081.png" width="150" alt="135mm 2m Noir"><br><b>135mm 2m Noir</b> | <img src="visual/atlas/AT082.png" width="150" alt="135mm 2m Amber"><br><b>135mm 2m Amber</b> | <img src="visual/atlas/AT083.png" width="150" alt="135mm 2m Arctic"><br><b>135mm 2m Arctic</b> | <img src="visual/atlas/AT084.png" width="150" alt="135mm 2m Pastel"><br><b>135mm 2m Pastel</b> | <img src="visual/atlas/AT085.png" width="150" alt="135mm 2m Forest"><br><b>135mm 2m Forest</b> |
| <img src="visual/atlas/AT086.png" width="150" alt="135mm 4m Noir"><br><b>135mm 4m Noir</b> | <img src="visual/atlas/AT087.png" width="150" alt="135mm 4m Amber"><br><b>135mm 4m Amber</b> | <img src="visual/atlas/AT088.png" width="150" alt="135mm 4m Arctic"><br><b>135mm 4m Arctic</b> | <img src="visual/atlas/AT089.png" width="150" alt="135mm 4m Pastel"><br><b>135mm 4m Pastel</b> | <img src="visual/atlas/AT090.png" width="150" alt="135mm 4m Forest"><br><b>135mm 4m Forest</b> |
| <img src="visual/atlas/AT091.png" width="150" alt="135mm 6m Noir"><br><b>135mm 6m Noir</b> | <img src="visual/atlas/AT092.png" width="150" alt="135mm 6m Amber"><br><b>135mm 6m Amber</b> | <img src="visual/atlas/AT093.png" width="150" alt="135mm 6m Arctic"><br><b>135mm 6m Arctic</b> | <img src="visual/atlas/AT094.png" width="150" alt="135mm 6m Pastel"><br><b>135mm 6m Pastel</b> | <img src="visual/atlas/AT095.png" width="150" alt="135mm 6m Forest"><br><b>135mm 6m Forest</b> |
| <img src="visual/atlas/AT096.png" width="150" alt="135mm 8m Noir"><br><b>135mm 8m Noir</b> | <img src="visual/atlas/AT097.png" width="150" alt="135mm 8m Amber"><br><b>135mm 8m Amber</b> | <img src="visual/atlas/AT098.png" width="150" alt="135mm 8m Arctic"><br><b>135mm 8m Arctic</b> | <img src="visual/atlas/AT099.png" width="150" alt="135mm 8m Pastel"><br><b>135mm 8m Pastel</b> | <img src="visual/atlas/AT100.png" width="150" alt="135mm 8m Forest"><br><b>135mm 8m Forest</b> |

<p align="right"><a href="#higgsfield-director-pro">back to top ↑</a></p>

## Camera diagrams

Static versions, seen from above, of the animated movements in part 01.

|   |   |   |   |
|:---:|:---:|:---:|:---:|
| <img src="visual/assets/CAM001.png" width="190" alt="Dolly In"><br><b>Dolly In</b> | <img src="visual/assets/CAM002.png" width="190" alt="Dolly Out"><br><b>Dolly Out</b> | <img src="visual/assets/CAM003.png" width="190" alt="Truck Left"><br><b>Truck Left</b> | <img src="visual/assets/CAM004.png" width="190" alt="Truck Right"><br><b>Truck Right</b> |
| <img src="visual/assets/CAM005.png" width="190" alt="Orbit Clockwise"><br><b>Orbit Clockwise</b> | <img src="visual/assets/CAM006.png" width="190" alt="Orbit Counterclockwise"><br><b>Orbit Counterclockwise</b> | <img src="visual/assets/CAM007.png" width="190" alt="Crane Up"><br><b>Crane Up</b> | <img src="visual/assets/CAM008.png" width="190" alt="Crane Down"><br><b>Crane Down</b> |
| <img src="visual/assets/CAM009.png" width="190" alt="Pan Left"><br><b>Pan Left</b> | <img src="visual/assets/CAM010.png" width="190" alt="Pan Right"><br><b>Pan Right</b> | <img src="visual/assets/CAM011.png" width="190" alt="Tilt Up"><br><b>Tilt Up</b> | <img src="visual/assets/CAM012.png" width="190" alt="Tilt Down"><br><b>Tilt Down</b> |
| <img src="visual/assets/CAM013.png" width="190" alt="Zoom In"><br><b>Zoom In</b> | <img src="visual/assets/CAM014.png" width="190" alt="Zoom Out"><br><b>Zoom Out</b> | <img src="visual/assets/CAM015.png" width="190" alt="Static"><br><b>Static</b> | <img src="visual/assets/CAM016.png" width="190" alt="Arc Left"><br><b>Arc Left</b> |
| <img src="visual/assets/CAM017.png" width="190" alt="Arc Right"><br><b>Arc Right</b> | <img src="visual/assets/CAM018.png" width="190" alt="Pedestal Up"><br><b>Pedestal Up</b> | <img src="visual/assets/CAM019.png" width="190" alt="Pedestal Down"><br><b>Pedestal Down</b> | <img src="visual/assets/CAM020.png" width="190" alt="Camera Roll"><br><b>Camera Roll</b> |

## License and origin

- **Text:** adapted from the v4.1 illustrated README (AAA edition), which declares it under
  [CC BY-SA 4.0](LICENSE-DOCS.md). Changes in this version: the illustrations were rearranged into grids; the
  repeated "advantage" and "QA" line of each part became the section "How to read each part"; the part 11 flow
  now includes cost, "ok" and generation through the connector; left out are the copy of the RC4 README and the
  encyclopedia of the 116 commands and of the old scripts, which do not exist in v5.
- **Images** (`visual/`): schematic illustrations drawn by code, under [CC BY-SA 4.0](LICENSE-DOCS.md), like the
  text. See [`visual/VISUAL-RIGHTS.md`](visual/VISUAL-RIGHTS.md).
- An independent, unofficial project, not affiliated with Higgsfield, which did not make, approve or review this
  manual.

<div align="center">

[Back to top](#higgsfield-director-pro) · [Main README](../../README.md)

</div>
