import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { DroneState } from '../physics/drone'
import { buildEnvironment } from './environment'

// FPV cams are physically tilted up relative to the frame so that level
// forward flight (which pitches the frame down) still looks roughly ahead.
const CAMERA_TILT_DEG = 25
const FOV_DEG = 130
// Mount offset from the drone's center, in the drone's own local frame
// (forward = -Z, up = +Y), so the lens sits ahead of/above the frame instead
// of exactly at its center -- otherwise the arms fill most of the view.
const CAMERA_MOUNT_OFFSET = new Vector3(0, 0.05, -0.08)
const PROP_SPIN_SPEED = 55 // rad/s at full throttle

interface DroneMesh {
  group: Group
  props: { mesh: Mesh; direction: 1 | -1 }[]
}

function buildDroneMesh(): DroneMesh {
  const group = new Group()
  const props: { mesh: Mesh; direction: 1 | -1 }[] = []

  const body = new Mesh(
    new BoxGeometry(0.18, 0.05, 0.18),
    new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 }),
  )
  body.castShadow = true
  group.add(body)

  const canopy = new Mesh(
    new BoxGeometry(0.09, 0.03, 0.09),
    new MeshStandardMaterial({ color: 0xdd2222, roughness: 0.3, metalness: 0.1 }),
  )
  canopy.position.set(0, 0.04, -0.03)
  canopy.castShadow = true
  group.add(canopy)

  const armMat = new MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.4 })
  const propMat = new MeshStandardMaterial({
    color: 0x99aaff,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  })
  const armPositions: [number, number, 1 | -1][] = [
    [0.13, 0.13, 1],
    [0.13, -0.13, -1],
    [-0.13, 0.13, -1],
    [-0.13, -0.13, 1],
  ]
  for (const [x, z, direction] of armPositions) {
    const arm = new Mesh(new BoxGeometry(0.02, 0.02, 0.18), armMat)
    arm.position.set(x, 0, z)
    arm.rotation.y = Math.atan2(x, z)
    arm.castShadow = true
    group.add(arm)

    const propGroup = new Group()
    propGroup.position.set(x * 1.6, 0.025, z * 1.6)
    const prop = new Mesh(new CylinderGeometry(0.09, 0.09, 0.005, 16), propMat)
    propGroup.add(prop)
    group.add(propGroup)
    props.push({ mesh: prop, direction })

    const armTip = new Mesh(
      new CylinderGeometry(0.015, 0.015, 0.03, 8),
      new MeshStandardMaterial({
        color: x > 0 ? 0x33ff55 : 0xff3333,
        emissive: x > 0 ? 0x115522 : 0x551111,
      }),
    )
    armTip.position.set(x * 1.6, 0.01, z * 1.6)
    group.add(armTip)
  }

  return { group, props }
}

export class SceneManager {
  readonly renderer: WebGLRenderer
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(FOV_DEG, 1, 0.05, 2000)
  private readonly drone = buildDroneMesh()
  private readonly cameraTilt = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    (-CAMERA_TILT_DEG * Math.PI) / 180,
  )

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = SRGBColorSpace

    this.scene.fog = new Fog(0xdcefff, 40, 500)

    const hemi = new HemisphereLight(0xbfd9ff, 0x3a4a2f, 1.1)
    this.scene.add(hemi)

    const sun = new DirectionalLight(0xfff3e0, 2.2)
    sun.position.set(60, 90, 30)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -80
    sun.shadow.camera.right = 80
    sun.shadow.camera.top = 80
    sun.shadow.camera.bottom = -80
    sun.shadow.camera.near = 10
    sun.shadow.camera.far = 250
    sun.shadow.bias = -0.0015
    this.scene.add(sun)

    this.scene.add(buildEnvironment())
    this.scene.add(this.drone.group)

    this.handleResize()
    window.addEventListener('resize', () => this.handleResize())
  }

  handleResize() {
    const { clientWidth, clientHeight } = this.renderer.domElement.parentElement!
    this.renderer.setSize(clientWidth, clientHeight)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
  }

  syncToDrone(drone: DroneState, throttle: number, dt: number) {
    this.drone.group.position.copy(drone.position)
    this.drone.group.quaternion.copy(drone.orientation)

    const spin = (drone.armed ? Math.max(throttle, 0.15) : 0.15) * PROP_SPIN_SPEED * dt
    for (const { mesh, direction } of this.drone.props) {
      mesh.rotation.y += spin * direction
    }

    const mountOffset = CAMERA_MOUNT_OFFSET.clone().applyQuaternion(drone.orientation)
    this.camera.position.copy(drone.position).add(mountOffset)
    this.camera.quaternion.copy(drone.orientation).multiply(this.cameraTilt)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}
