# Fly Through Toroid

An interactive 3D toroid made of smaller toroids. The small toroids sit along the centre line of the big ring with their holes aligned to it, so flying along the ring takes you through every one of them.

**Live page:** https://d57udy.github.io/fly-through-toroid/

Plain HTML, CSS and JavaScript with [three.js](https://threejs.org) 0.170 loaded from the jsDelivr CDN. There is no build step, so it runs as-is on the free tier of GitHub Pages.

## Run locally

ES modules do not load from `file://`, so serve the folder:

```sh
cd "Fly Through Toroid"
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish on GitHub Pages

1. Create a new public repository, for example `fly-through-toroid`.
2. Push the contents of this folder to the `main` branch (with `index.html` at the repository root).
3. In the repository, go to **Settings → Pages**, set **Source** to "Deploy from a branch", pick `main` and `/ (root)`, and save.
4. After a minute the site is live at `https://<your-user>.github.io/fly-through-toroid/`.

The empty `.nojekyll` file tells Pages to serve the files as they are.

## Controls

| Mode | How |
|---|---|
| Orbit (`1`) | Drag to rotate, right drag to pan, scroll to zoom |
| Fly (`2`) | Drag to look, `W` `A` `S` `D` to move, `Q` / `E` down and up, `Shift` to boost, scroll to change speed |
| Ride through (`3`) | Automatic flight along the ring through every toroid. Drag or use the arrow keys to look around; the view stays turned relative to the direction of travel until you press `C` or double click to face forward again |

Other keys: `R` reset view, `H` hide the panel, `P` save a screenshot, `Esc` back to orbit.

Double click any slider to reset it. Click a slider's number to type an exact value. The current settings are kept in the URL, so **Copy link** shares an exact configuration.

## Saved configurations

**Save current** stores the current settings in this browser (`localStorage`), under the name you type or an automatic one such as "Copper, Dark studio". Saving under an existing name updates it. Click a saved name to load it; the × button deletes it after a second click to confirm. Saved configurations never leave the browser, so they are not shared between browsers or devices (use **Copy link** for that).

The page also remembers your last settings and restores them when you open it again. A shared link always takes priority over the remembered settings.

## Settings

- **Toroid:** ring diameter, small toroid diameter (centre line), tube thickness, number of toroids. The readout shows hole and outer diameter and the gap between neighbours, and warns when toroids overlap.
- **Arrangement:** tilt of each toroid, twist (the tilt direction turns around the ring), and a vertical wave along the ring.
- **Material:** 15 presets (metals, glass, gems, ceramic, car paint, velvet, iridescent, neon) plus fine tuning of colour, metalness, roughness, clear coat, transmission, iridescence and glow. Colour patterns: uniform, alternating, gradient, rainbow.
- **Scene and lighting:** dark studio, white studio, sunset sky or deep space; exposure, environment light, key light direction and strength, bloom, vignette, shadows, ground, ambient occlusion, tone mapping, render quality.
- **Motion and camera:** ride speed, toroid flow along the ring, ring spin, field of view.

## Rendering

Physically based materials (`MeshPhysicalMaterial`) lit by image based lighting, a shadow casting key light, screen space ambient occlusion (GTAO), bloom, 4x MSAA and filmic tone mapping. All toroids are drawn as one instanced mesh, so a few hundred of them stay fast.

If a machine struggles, set **Render quality** to Fast or switch off ambient occlusion.

## Files

```
index.html          page layout and import map
css/style.css       layout and panel styling
js/main.js          renderer, post-processing, lighting, wiring
js/toroid.js        ring path and instanced toroids
js/environments.js  backdrops and lighting environments
js/camera.js        orbit, fly and ride camera modes
js/ui.js            settings panel
js/storage.js       saved configurations and last session (localStorage)
js/config.js        defaults and presets
```

Add `?debug` to the URL to expose the scene as `window.toroidApp` in the browser console.
