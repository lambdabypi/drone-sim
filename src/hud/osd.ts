import { Euler } from 'three'
import type { DroneState } from '../physics/drone'

// Simulated 4S LiPo -- drains faster under load, purely cosmetic for now.
const BATTERY_FULL = 16.8
const BATTERY_EMPTY = 13.2
const BATTERY_LOW_THRESHOLD = 14.8
const DRAIN_PER_SECOND_IDLE = 0.01
const DRAIN_PER_SECOND_FULL_THROTTLE = 0.045

const eulerScratch = new Euler(0, 0, 0, 'YXZ')

export class Osd {
  private batteryVoltage = BATTERY_FULL
  private armedSeconds = 0
  private wasArmed = false
  private statusEl: HTMLElement
  private horizonEl: HTMLElement
  private telemetryEl: HTMLElement

  constructor(statusEl: HTMLElement, horizonEl: HTMLElement, telemetryEl: HTMLElement) {
    this.statusEl = statusEl
    this.horizonEl = horizonEl
    this.telemetryEl = telemetryEl
  }

  update(dt: number, drone: DroneState, throttle: number, connected: boolean) {
    if (!connected) {
      this.statusEl.textContent = 'Pair a DS4 over Bluetooth, then press a button to connect.'
      this.horizonEl.style.opacity = '0'
      this.telemetryEl.innerHTML = ''
      return
    }
    this.horizonEl.style.opacity = '1'

    if (drone.armed && !this.wasArmed) this.armedSeconds = 0
    this.wasArmed = drone.armed

    if (drone.armed) {
      this.armedSeconds += dt
      const drain =
        DRAIN_PER_SECOND_IDLE + throttle * (DRAIN_PER_SECOND_FULL_THROTTLE - DRAIN_PER_SECOND_IDLE)
      this.batteryVoltage = Math.max(BATTERY_EMPTY, this.batteryVoltage - drain * dt)
    }

    eulerScratch.setFromQuaternion(drone.orientation)
    const pitchDeg = (eulerScratch.x * 180) / Math.PI
    const rollDeg = (eulerScratch.z * 180) / Math.PI
    const pitchPx = Math.max(-120, Math.min(120, pitchDeg * 4))
    this.horizonEl.style.transform = `translateY(${pitchPx}px) rotate(${-rollDeg}deg)`

    this.statusEl.innerHTML = drone.armed
      ? '<span class="armed">ARMED</span>'
      : 'disarmed (Options to arm)'

    const speed = drone.velocity.length()
    const mm = Math.floor(this.armedSeconds / 60)
    const ss = Math.floor(this.armedSeconds % 60)
    const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`
    const lowBatt = this.batteryVoltage < BATTERY_LOW_THRESHOLD

    this.telemetryEl.innerHTML = `
      <span>throttle</span><span>${throttle.toFixed(2)}</span>
      <span>alt</span><span>${drone.position.y.toFixed(1)} m</span>
      <span>speed</span><span>${speed.toFixed(1)} m/s</span>
      <span>timer</span><span>${timeStr}</span>
      <span>batt</span><span class="${lowBatt ? 'low-batt' : ''}">${this.batteryVoltage.toFixed(1)} V</span>
    `
  }
}
