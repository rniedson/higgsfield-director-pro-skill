# Directing vocabulary

Terms to write in the prompt (in English). They are working vocabulary, not API parameters: a name is a "control" only
when the model's catalog shows the parameter (e.g., Cinema Studio 4.0 has `camera_lens_id`).

## Camera movement

- **Definitions the models respect:** dolly = the camera moves; zoom = the lens changes the field of view (Veo: "zoom
  is not dolly"); pan/tilt = turns horizontally/vertically; roll = turns on the lens axis; orbit/arc = moves around the
  subject; truck = moves sideways; pedestal = rises/lowers straight; crane/jib = rises/lowers in an arc; dolly zoom =
  moves one way and zooms the other (the subject stays the same size and the background changes).
- **Moving in/out:** push in, pull back, dolly in/out, zoom in/out, crash zoom, dolly zoom (vertigo effect).
- **Sideways and rotation:** pan left/right, whip pan, tilt up/down, truck left/right, arc left/right, 360 orbit, camera
  roll.
- **Height:** crane up/down, jib up/down, pedestal up/down, rise and reveal, overhead, bird's-eye.
- **Following:** tracking shot, leading shot, following shot, side tracking, reverse tracking, steadicam, gimbal.
- **Style:** static / locked-off, handheld, micro camera movement, floating camera, snorricam, POV, hero cam.
- **Aerial and vehicle:** FPV drone, aerial pullback, fly-through, fly-over, car chase, car grip.
- **Passing through:** through-object transition, focus change (rack focus), dive shot.
- **Time:** bullet time, hyperlapse, timelapse, slow motion look, speed ramp.
- **Modifiers:** ultra slow, slow and smooth, gradual, subtle, controlled, accelerating, decelerating, sudden,
  constant speed, ease in, ease out, clockwise, counterclockwise.

Higgsfield keeps the official list of *camera controls* (≈70 names: Dolly In, Crash Zoom In, Robo Arm, FPV Drone,
360 Orbit, Whip Pan, Snorricam, Hero Cam, Jib Up...) at https://higgsfield.ai/camera-controls. These names are
**presets** (model `higgsfield_preset`, chosen through `get_presets`), not magic words in the text of other models. In
Cinema Studio 4.0, the movement goes in the text.

MiniMax Hailuo accepts commands in square brackets (up to 3): `[Truck left]`, `[Truck right]`, `[Pan left]`,
`[Pan right]`, `[Push in]`, `[Pull out]`, `[Pedestal up]`, `[Pedestal down]`, `[Tilt up]`, `[Tilt down]`, `[Zoom in]`,
`[Zoom out]`, `[Shake]`, `[Tracking shot]`, `[Static shot]`.

## Shot size, angle and composition

- **Shot sizes:** extreme wide, wide, full shot (whole body), medium wide, cowboy (thighs), medium (waist), medium
  close-up (chest), close-up (face), extreme close-up (detail), insert, two shot, establishing, reaction, cutaway.
- **Angles:** eye level, low angle, high angle, bird's-eye, worm's-eye, ground level, over the shoulder, first-person
  POV, profile, frontal, rear, three-quarter view, Dutch angle.
- **Composition:** rule of thirds, symmetrical, center framing, negative space, leading lines, frame within a frame,
  layered foreground, foreground occlusion, vanishing point, headroom, lead room, tight/loose framing, silhouette.

## Lens and focus

- **Focal length (full-frame):** 14 mm ultra-wide; 24 mm wide; 35 mm environmental; 50 mm normal; 85 mm portrait;
  135–400 mm telephoto. Perspective comes from the camera position; the lens changes the crop. `hfd.py optics`
  computes field of view and focus.
- **Aperture:** f/1.4 very blurred background; f/4 middle ground; f/11 everything sharp.
- **Focus:** rack focus, focus pull, selective focus, deep focus, shallow depth of field, cinematic bokeh.
- **Types and effects:** anamorphic (horizontal flare, oval bokeh), macro, tilt-shift, fisheye, split diopter, lens
  flare, halation, bloom, vignetting, chromatic aberration, light leak, black pro-mist diffusion.

## Lighting

- **Setups:** three-point, key/fill/rim, Rembrandt, butterfly, split, loop, clamshell, high key, low key,
  chiaroscuro, silhouette, contre-jour, backlight, rim light, negative fill, bounce.
- **Sources:** window light, practicals, candlelight, firelight, moonlight, streetlight, neon, tungsten, fluorescent,
  golden hour, blue hour, overcast, god rays, dappled light, caustics.
- **Temperature (describes the source, does not guarantee the color):** candle 1800–2400 K; tungsten 3200 K; daylight
  5600 K; shade 7000 K+.

## Color and texture

- **Grades:** teal and orange, bleach bypass, monochrome noir, pastel, desaturated, warm/cool, crushed blacks, lifted
  blacks, filmic highlight roll-off, split toning, day for night, natural skin tones.
- **Film stocks (look, not LUT):** Kodak Vision3 500T/250D, Portra 400, Ektar 100, CineStill 800T, Tri-X 400,
  Fujifilm Velvia 50, Super 16mm, Super 8, VHS, MiniDV.

## Visual styles (the 20 in the illustrated manual, part 05)

The operator can choose by looking at the manual; use the descriptors in the prompt, not only the name.
Photorealism: natural light, plausible materials, restrained grading · Neo Noir: low-key lighting, rain, deep shadows
· Cyberpunk: neon, dense futuristic city · Solarpunk: green architecture, daylight · Steampunk: brass, industrial
machinery · Dark Fantasy: gothic silhouettes, mist · Luxury Editorial: controlled reflections, premium materials ·
Surrealism: impossible scale and spatial logic · Analog Horror: muted green, VHS texture · Claymation: handmade forms,
soft texture · 2D Anime: cel shading, graphic contours · Brutalism: concrete, monumental geometry · Retrofuturism:
space-age curves, vintage palette · Dreamcore: pastel haze, liminal spaces · Art Deco: symmetry, gold geometry ·
Vaporwave: pastel neon, digital nostalgia · Space Opera: epic scale, cosmic contrast · Post-Apocalyptic: weathered
ruins, vegetation · German Expressionism: angular sets, distorted shadows · Miniature Diorama: small-scale sets,
selective focus.

## Atmosphere and physics

- **Atmosphere:** haze, ground fog, morning mist, dust particles, floating embers, drizzle, heavy rain, snowfall,
  sandstorm, heat distortion, wet pavement, condensation, atmospheric perspective.
- **Physics (helps the model not "melt" the scene):** natural inertia, weight shift, foot-ground contact,
  follow-through, overlapping action, cloth simulation, hair in the wind, secondary motion, realistic collision, fluid
  dynamics, contact shadows, rigid body stays rigid.

## Acting

- **Face:** subtle smile, genuine smile, smirk, soft gaze, intense stare, side glance, looking away, slow blink,
  raised eyebrow, furrowed brow, clenched jaw, trembling lips, watery eyes, microexpressions, natural breathing.
- **Body:** slow walk, confident walk, turn around, look over the shoulder, reach forward, lean in, step back, kneel,
  sit down, stand up, shrug, nod, idle movement, restrained performance.
- Prefer **stimulus → observable reaction → pause** to emotion names ("she hears the door, freezes, then exhales").

## Editing and transitions (between generated shots)

hard cut, match cut, match on action, jump cut, smash cut, cross dissolve, fade to black, whip pan transition,
occlusion transition, light flash, seamless loop, J-cut, L-cut. The transition is made in the edit; in the prompt,
describe the final frame of one shot and the opening frame of the next.

A whip pan inside one shot, from one subject to another: give its length (`0.5 seconds`), label the subjects
(`from Subject A … to Subject B`), and end on the same shot size it started on; a whip from a medium shot to a
close-up read as a mistake (one tutorial; to test).

## Audio

ambient sound, room tone, foley, diegetic sound, atmospheric drone, sub bass impact, whoosh, rising tension,
footsteps, fabric rustle, distant echo, hall reverb, muffled, underwater, sudden silence, no music, no dialogue.
Voice: calm, soft-spoken, whisper, confident delivery, conversational tone, documentary narration, natural pauses.
