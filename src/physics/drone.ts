import { Quaternion, Vector3 } from 'three'
import type { StickInput } from '../input/gamepad'

// Rate-mode ("acro") quadcopter physics. Sticks command body angular rates
// directly -- there is no auto-leveling. We simulate an idealized rate
// controller (angular velocity chases the commanded rate) rather than a real
// flight-controller PID loop, which is the right fidelity level for a sim.

const GRAVITY = 9.81
const MASS = 0.5 // kg
const MAX_RATE_ROLL_PITCH = (400 * Math.PI) / 180 // rad/s
const MAX_RATE_YAW = (180 * Math.PI) / 180 // rad/s
const RATE_RESPONSIVENESS = 12 // how fast angular velocity chases the commanded rate
const ANGULAR_DRAG = 2
const LINEAR_DRAG = 0.25
const THRUST_TO_WEIGHT = 2.2 // full throttle thrust / weight
const MAX_THRUST = MASS * GRAVITY * THRUST_TO_WEIGHT

export class DroneState {
  position = new Vector3(0, 1, 0)
  velocity = new Vector3()
  orientation = new Quaternion()
  angularVelocity = new Vector3() // body frame, rad/s
  armed = false

  reset() {
    this.position.set(0, 1, 0)
    this.velocity.set(0, 0, 0)
    this.orientation.identity()
    this.angularVelocity.set(0, 0, 0)
  }

  step(dt: number, sticks: StickInput) {
    if (!this.armed) {
      // Still fall under gravity if disarmed mid-air, but no control authority.
      this.integrateFreeBody(dt, 0)
      return
    }

    const desiredRate = new Vector3(
      -sticks.pitch * MAX_RATE_ROLL_PITCH,
      -sticks.yaw * MAX_RATE_YAW,
      -sticks.roll * MAX_RATE_ROLL_PITCH,
    )

    // Chase the commanded rate (simulated motor/controller response) and apply drag.
    const rateError = desiredRate.clone().sub(this.angularVelocity)
    const angularAccel = rateError.multiplyScalar(RATE_RESPONSIVENESS)
    angularAccel.addScaledVector(this.angularVelocity, -ANGULAR_DRAG)
    this.angularVelocity.addScaledVector(angularAccel, dt)

    this.integrateOrientation(dt)
    this.integrateFreeBody(dt, sticks.throttle * MAX_THRUST)
  }

  private integrateOrientation(dt: number) {
    // dq/dt = 0.5 * q * omega (as a pure quaternion), integrated then re-normalized.
    const omega = this.angularVelocity
    const q = this.orientation
    const dq = q.clone().multiply(new Quaternion(omega.x, omega.y, omega.z, 0))
    q.x += 0.5 * dq.x * dt
    q.y += 0.5 * dq.y * dt
    q.z += 0.5 * dq.z * dt
    q.w += 0.5 * dq.w * dt
    q.normalize()
  }

  private integrateFreeBody(dt: number, thrustMagnitude: number) {
    const bodyUp = new Vector3(0, 1, 0).applyQuaternion(this.orientation)
    const thrust = bodyUp.multiplyScalar(thrustMagnitude / MASS)

    const drag = this.velocity.clone().multiplyScalar(-LINEAR_DRAG)
    const accel = thrust.add(drag)
    accel.y -= GRAVITY

    this.velocity.addScaledVector(accel, dt)
    this.position.addScaledVector(this.velocity, dt)

    if (this.position.y < 0) {
      this.position.y = 0
      this.velocity.set(0, 0, 0)
      this.angularVelocity.set(0, 0, 0)
      this.orientation.identity() // self-right on landing/crash
    }
  }
}
