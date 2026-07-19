import './style.css'
import { GamepadInput } from './input/gamepad'
import { DroneState } from './physics/drone'
import { Osd } from './hud/osd'
import { SceneManager } from './scene/scene'

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!
const statusEl = document.querySelector<HTMLDivElement>('#hud-status')!
const horizonEl = document.querySelector<HTMLDivElement>('#horizon-wrap')!
const telemetryEl = document.querySelector<HTMLDivElement>('#hud-telemetry')!

const scene = new SceneManager(canvas)
const input = new GamepadInput()
const drone = new DroneState()
const osd = new Osd(statusEl, horizonEl, telemetryEl)

// Physics runs on a fixed step, decoupled from render/vsync rate, so
// behavior stays consistent regardless of display refresh rate.
const FIXED_DT = 1 / 240
const MAX_FRAME_TIME = 0.25 // clamp so a tab switch doesn't cause a physics explosion
let accumulator = 0
let lastTime = performance.now()

function frame(now: number) {
  requestAnimationFrame(frame)

  const frameTime = Math.min((now - lastTime) / 1000, MAX_FRAME_TIME)
  lastTime = now
  accumulator += frameTime

  const gp = input.poll()
  if (gp.armToggled) drone.armed = !drone.armed
  if (gp.resetPressed) drone.reset()

  while (accumulator >= FIXED_DT) {
    drone.step(FIXED_DT, gp.sticks)
    accumulator -= FIXED_DT
  }

  scene.syncToDrone(drone, gp.sticks.throttle, frameTime)
  scene.render()
  osd.update(frameTime, drone, gp.sticks.throttle, gp.connected)
}

requestAnimationFrame(frame)
