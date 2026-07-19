// Reads a standard-mapping gamepad (DS4 pairs fine over Bluetooth) each frame
// and turns raw stick axes into shaped RC-style commands.
//
// Stick layout (Mode 2, the RC/FPV convention):
//   left stick  Y -> throttle   (axes[1])
//   left stick  X -> yaw rate   (axes[0])
//   right stick Y -> pitch rate (axes[3])
//   right stick X -> roll rate  (axes[2])

export interface StickInput {
  throttle: number // 0..1
  yaw: number // -1..1
  pitch: number // -1..1
  roll: number // -1..1
}

export interface GamepadFrame {
  connected: boolean
  sticks: StickInput
  armToggled: boolean
  resetPressed: boolean
}

const DEADZONE = 0.08
const EXPO = 0.55

// Deadzone + cubic expo: keeps fine control near center without killing
// authority at full deflection.
function shape(raw: number): number {
  const sign = Math.sign(raw)
  const mag = Math.abs(raw)
  if (mag < DEADZONE) return 0
  const scaled = (mag - DEADZONE) / (1 - DEADZONE)
  const shaped = EXPO * scaled ** 3 + (1 - EXPO) * scaled
  return sign * Math.min(shaped, 1)
}

export class GamepadInput {
  private gamepadIndex: number | null = null
  private prevArmButton = false
  private prevResetButton = false
  lastSticks: StickInput = { throttle: 0, yaw: 0, pitch: 0, roll: 0 }

  constructor() {
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index
    })
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null
    })
  }

  poll(): GamepadFrame {
    const pads = navigator.getGamepads()
    const pad = this.gamepadIndex !== null ? pads[this.gamepadIndex] : null

    if (!pad) {
      return {
        connected: false,
        sticks: { throttle: 0, yaw: 0, pitch: 0, roll: 0 },
        armToggled: false,
        resetPressed: false,
      }
    }

    const leftX = shape(pad.axes[0] ?? 0)
    const leftY = shape(pad.axes[1] ?? 0)
    const rightX = shape(pad.axes[2] ?? 0)
    const rightY = shape(pad.axes[3] ?? 0)

    // Left stick Y is -1 (up) .. 1 (down). Only the upper half of travel (center
    // to full up) produces thrust, so a released/centered stick means 0 throttle.
    const throttle = Math.max(0, -leftY)

    const armButton = pad.buttons[9]?.pressed ?? false // Options
    const armToggled = armButton && !this.prevArmButton
    this.prevArmButton = armButton

    const resetButton = pad.buttons[8]?.pressed ?? false // Share/Touchpad-click area
    const resetPressed = resetButton && !this.prevResetButton
    this.prevResetButton = resetButton

    const sticks: StickInput = { throttle, yaw: leftX, pitch: -rightY, roll: rightX }
    this.lastSticks = sticks

    return { connected: true, sticks, armToggled, resetPressed }
  }
}
