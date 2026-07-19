# FPV Drone Sim

A browser-based FPV drone flight simulator built with [Three.js](https://threejs.org/) and TypeScript.

## Controls

Requires a standard-mapping gamepad (e.g. DS4 over Bluetooth). Uses Mode 2 RC stick layout:

| Input | Action |
| --- | --- |
| Left stick Y | Throttle |
| Left stick X | Yaw rate |
| Right stick Y | Pitch rate |
| Right stick X | Roll rate |
| Options | Arm / disarm |
| Share | Reset |

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in a browser and connect a gamepad.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally

## Project structure

```
src/
  main.ts             entry point / game loop
  physics/drone.ts     drone flight dynamics
  input/gamepad.ts     gamepad polling and stick shaping
  scene/scene.ts       Three.js scene setup
  scene/environment.ts environment/world geometry
  hud/osd.ts           HUD overlay (horizon, crosshair, telemetry)
```
