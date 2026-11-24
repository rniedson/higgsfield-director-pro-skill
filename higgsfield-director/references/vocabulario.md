# Vocabulário de direção

Termos para escrever no prompt (em inglês). São vocabulário de trabalho, não parâmetros de API: um nome só é
"controle" quando o catálogo do modelo mostra o parâmetro (ex.: Cinema Studio 4.0 tem `camera_lens_id`).

## Movimento de câmera

- **Definições que os modelos respeitam:** dolly = a câmera anda; zoom = a lente muda o campo (Veo: "zoom não é
  dolly"); pan/tilt = gira na horizontal/vertical; roll = gira no eixo da lente; orbit/arc = anda em volta do sujeito;
  truck = anda de lado; pedestal = sobe/desce reta; crane/jib = sobe/desce em arco; dolly zoom = anda para um lado e
  dá zoom para o outro (o sujeito fica do mesmo tamanho e o fundo muda).
- **Aproximar/afastar:** push in, pull back, dolly in/out, zoom in/out, crash zoom, dolly zoom (vertigo effect).
- **Lateral e giro:** pan left/right, whip pan, tilt up/down, truck left/right, arc left/right, 360 orbit, camera roll.
- **Altura:** crane up/down, jib up/down, pedestal up/down, rise and reveal, overhead, bird's-eye.
- **Seguir:** tracking shot, leading shot, following shot, side tracking, reverse tracking, steadicam, gimbal.
- **Estilo:** static / locked-off, handheld, micro camera movement, floating camera, snorricam, POV, hero cam.
- **Aéreo e veículo:** FPV drone, aerial pullback, fly-through, fly-over, car chase, car grip.
- **Passagem:** through-object transition, focus change (rack focus), dive shot.
- **Tempo:** bullet time, hyperlapse, timelapse, slow motion look, speed ramp.
- **Modificadores:** ultra slow, slow and smooth, gradual, subtle, controlled, accelerating, decelerating, sudden,
  constant speed, ease in, ease out, clockwise, counterclockwise.

Higgsfield mantém a lista oficial de *camera controls* (≈70 nomes: Dolly In, Crash Zoom In, Robo Arm, FPV Drone,
360 Orbit, Whip Pan, Snorricam, Hero Cam, Jib Up...) em https://higgsfield.ai/camera-controls. Esses nomes são
**presets** (modelo `higgsfield_preset`, escolhidos pelo `get_presets`), não palavras mágicas no texto de outros
modelos. No Cinema Studio 4.0, o movimento vai no texto.

MiniMax Hailuo aceita comandos entre colchetes (até 3): `[Truck left]`, `[Truck right]`, `[Pan left]`, `[Pan right]`,
`[Push in]`, `[Pull out]`, `[Pedestal up]`, `[Pedestal down]`, `[Tilt up]`, `[Tilt down]`, `[Zoom in]`, `[Zoom out]`,
`[Shake]`, `[Tracking shot]`, `[Static shot]`.

## Plano, ângulo e composição

- **Planos:** extreme wide, wide, full shot (corpo inteiro), medium wide, cowboy (coxas), medium (cintura), medium
  close-up (peito), close-up (rosto), extreme close-up (detalhe), insert, two shot, establishing, reaction, cutaway.
- **Ângulos:** eye level, low angle, high angle, bird's-eye, worm's-eye, ground level, over the shoulder, first-person
  POV, profile, frontal, rear, three-quarter view, Dutch angle.
- **Composição:** rule of thirds, symmetrical, center framing, negative space, leading lines, frame within a frame,
  layered foreground, foreground occlusion, vanishing point, headroom, lead room, tight/loose framing, silhouette.

## Lente e foco

- **Distância focal (full-frame):** 14 mm ultra-angular; 24 mm angular; 35 mm ambiente; 50 mm normal; 85 mm retrato;
  135–400 mm tele. A perspectiva vem da posição da câmera, a lente muda o recorte. `hfd.py otica` calcula campo e foco.
- **Abertura:** f/1.4 fundo bem desfocado; f/4 meio-termo; f/11 tudo nítido.
- **Foco:** rack focus, focus pull, selective focus, deep focus, shallow depth of field, cinematic bokeh.
- **Tipos e efeitos:** anamorphic (flare horizontal, bokeh oval), macro, tilt-shift, fisheye, split diopter, lens flare,
  halation, bloom, vignetting, chromatic aberration, light leak, black pro-mist diffusion.

## Luz

- **Esquemas:** three-point, key/fill/rim, Rembrandt, butterfly, split, loop, clamshell, high key, low key,
  chiaroscuro, silhouette, contre-jour, backlight, rim light, negative fill, bounce.
- **Fontes:** window light, practicals, candlelight, firelight, moonlight, streetlight, neon, tungsten, fluorescent,
  golden hour, blue hour, overcast, god rays, dappled light, caustics.
- **Temperatura (descreve a fonte, não garante a cor):** vela 1800–2400 K; tungstênio 3200 K; dia 5600 K; sombra 7000 K+.

## Cor e textura

- **Grades:** teal and orange, bleach bypass, monochrome noir, pastel, desaturated, warm/cool, crushed blacks, lifted
  blacks, filmic highlight roll-off, split toning, day for night, natural skin tones.
- **Películas (aparência, não LUT):** Kodak Vision3 500T/250D, Portra 400, Ektar 100, CineStill 800T, Tri-X 400,
  Fujifilm Velvia 50, Super 16mm, Super 8, VHS, MiniDV.

## Estilos visuais (os 20 do manual ilustrado, parte 05)

O operador pode escolher olhando o manual; use os descritores no prompt, não só o nome.
Photorealism: natural light, plausible materials, restrained grading · Neo Noir: low-key lighting, rain, deep shadows
· Cyberpunk: neon, dense futuristic city · Solarpunk: green architecture, daylight · Steampunk: brass, industrial
machinery · Dark Fantasy: gothic silhouettes, mist · Luxury Editorial: controlled reflections, premium materials ·
Surrealism: impossible scale and spatial logic · Analog Horror: muted green, VHS texture · Claymation: handmade forms,
soft texture · 2D Anime: cel shading, graphic contours · Brutalism: concrete, monumental geometry · Retrofuturism:
space-age curves, vintage palette · Dreamcore: pastel haze, liminal spaces · Art Deco: symmetry, gold geometry ·
Vaporwave: pastel neon, digital nostalgia · Space Opera: epic scale, cosmic contrast · Post-Apocalyptic: weathered
ruins, vegetation · German Expressionism: angular sets, distorted shadows · Miniature Diorama: small-scale sets,
selective focus.

## Atmosfera e física

- **Atmosfera:** haze, ground fog, morning mist, dust particles, floating embers, drizzle, heavy rain, snowfall,
  sandstorm, heat distortion, wet pavement, condensation, atmospheric perspective.
- **Física (ajuda o modelo a não "derreter" a cena):** natural inertia, weight shift, foot-ground contact, follow-through,
  overlapping action, cloth simulation, hair in the wind, secondary motion, realistic collision, fluid dynamics,
  contact shadows, rigid body stays rigid.

## Atuação

- **Rosto:** subtle smile, genuine smile, smirk, soft gaze, intense stare, side glance, looking away, slow blink,
  raised eyebrow, furrowed brow, clenched jaw, trembling lips, watery eyes, microexpressions, natural breathing.
- **Corpo:** slow walk, confident walk, turn around, look over the shoulder, reach forward, lean in, step back, kneel,
  sit down, stand up, shrug, nod, idle movement, restrained performance.
- Prefira **estímulo → reação observável → pausa** a nomes de emoção ("she hears the door, freezes, then exhales").

## Montagem e transição (entre tomadas geradas)

hard cut, match cut, match on action, jump cut, smash cut, cross dissolve, fade to black, whip pan transition,
occlusion transition, light flash, seamless loop, J-cut, L-cut. A transição se faz na montagem; no prompt, descreva
o quadro final de uma tomada e o inicial da seguinte.

## Áudio

ambient sound, room tone, foley, diegetic sound, atmospheric drone, sub bass impact, whoosh, rising tension,
footsteps, fabric rustle, distant echo, hall reverb, muffled, underwater, sudden silence, no music, no dialogue.
Voz: calm, soft-spoken, whisper, confident delivery, conversational tone, documentary narration, natural pauses.
