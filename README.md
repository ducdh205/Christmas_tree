# ASCII Christmas

A slowly turning Christmas tree drawn entirely in ASCII characters. A golden comet
spirals up from the ground and leaves the tinsel behind it, and the needles
crystallise in its wake. When it reaches the tip the star ignites with a flash and a
shockwave. A wave of light then runs down the tree, switching on 170 twinkling bulbs,
and "Merry Christmas" decodes itself into place.

Built with **Vite + TypeScript + Canvas 2D**. There's no framework and no runtime dependencies besides the self-hosted fonts.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview   # serve the build
```

## Interact

- **Drag** to spin the tree (it keeps its momentum, then eases back to a slow turn).
- **Tap / click** anywhere for a burst of golden sparks.
- **Music** (top right) plays a synthesised music-box "Jingle Bells". It's public domain and generated with WebAudio, so no audio files are loaded. The lights and star pulse with the notes.
- Respects `prefers-reduced-motion` (shorter intro, slower spin and snow).

## The gift for dilahn

Everything personal is in `src/gifts/content.ts`: the name and the portrait caption.

The four boxes under the tree, from left to right:

| Box | Opens |
|---|---|
| small blue | an ASCII portrait made from `public/gift/dilahn.png` (tap it to see the real photo) |
| big red | an aurora: curtains of green, blue and pink light sway across the sky for about 15 s |
| red | a meteor shower: around 30 shooting stars, some of which burn out in sparkles |
| small gold | fireworks whose last burst spells the name |

The page opens on a "Gửi dilahn · chạm để mở quà" screen. That first tap also starts the music.
Which boxes have been opened is remembered in the browser.

The photo in `public/gift/` is **git-ignored on purpose** because it's a picture of a real person.
If you deploy from the repo and want the portrait on the live site, remove the `public/gift/*` lines
from `.gitignore` (and keep the repo private if you prefer).

## How it works

- `src/grid.ts`: a character frame buffer (glyph, colour, opacity, glow per cell).
- `src/renderer.ts`: blits glyphs from a pre-rendered atlas (one row per palette colour). Emissive cells are also drawn to a low-res canvas that CSS blurs and screens on top for bloom. The title uses a finer grid and is baked into a snapshot once it settles.
- `src/scene/tree.ts`: the tree is computed analytically per cell. It's a tiered cone lit from the upper left, rotated around its axis. Garland, lights and ornaments are points on the cone, projected and depth-faded.
- `src/scene/title.ts`: the title is rendered in Playfair Display italic, sampled into cells, and redrawn with glyphs. Outlines follow the stroke direction (`/ \ | _ -`) and interiors use a density ramp.
- `src/scene/snow.ts`, `ground.ts`, `sparkles.ts`, `src/audio.ts`: the rest.

`?t=<seconds>` jumps straight to a moment of the intro (e.g. `?t=3.6`).
`scripts/shots.mjs`, `scripts/moments.mjs` and `scripts/interact.mjs` take Playwright screenshots and run
smoke tests against `npm run preview` (run `npx playwright install chromium` first).
