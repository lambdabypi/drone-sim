import {
  BackSide,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Mesh,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'

// Flat launch pad radius: physics only models a flat ground plane at y=0, so
// keep the terrain height near zero close to spawn to avoid visual clipping.
const FLAT_RADIUS = 15
const WORLD_SIZE = 800

// Cheap rolling-hills height field -- sines instead of real noise, good
// enough to break up a flat plane without a noise dependency.
export function heightAt(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z)
  const falloff = Math.min(1, Math.max(0, (dist - FLAT_RADIUS) / 25))
  return falloff * (Math.sin(x * 0.04) * Math.cos(z * 0.05) * 3 + Math.sin((x + z) * 0.02) * 2)
}

function buildSky(): Mesh {
  const geometry = new SphereGeometry(900, 32, 16)
  const material = new ShaderMaterial({
    uniforms: {
      topColor: { value: new Color(0x2f7cd6) },
      bottomColor: { value: new Color(0xdcefff) },
      offset: { value: 60 },
      exponent: { value: 0.6 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: BackSide,
  })
  return new Mesh(geometry, material)
}

function buildTerrain(): Mesh {
  const segments = 140
  const geometry = new PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments)
  geometry.rotateX(-Math.PI / 2)

  const pos = geometry.attributes.position
  const colors: number[] = []
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = heightAt(x, z)
    pos.setY(i, y)

    const shade = 0.55 + Math.random() * 0.12 + y * 0.015
    colors.push(0.24 * shade, 0.5 * shade, 0.22 * shade)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  const mesh = new Mesh(geometry, material)
  mesh.receiveShadow = true
  return mesh
}

function scatterInstances(
  geometry: ConeGeometry | CylinderGeometry | DodecahedronGeometry,
  material: MeshStandardMaterial,
  count: number,
  scaleRange: [number, number],
  yOffset: number,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const dummy = new Object3D()
  let placed = 0
  let attempts = 0
  while (placed < count && attempts < count * 20) {
    attempts++
    const angle = Math.random() * Math.PI * 2
    const radius = FLAT_RADIUS + 10 + Math.random() * (WORLD_SIZE / 2 - FLAT_RADIUS - 10)
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const y = heightAt(x, z)

    const scale = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0])
    dummy.position.set(x, y + yOffset * scale, z)
    dummy.rotation.y = Math.random() * Math.PI * 2
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(placed, dummy.matrix)
    placed++
  }
  mesh.count = placed
  mesh.instanceMatrix.needsUpdate = true
  return mesh
}

function buildTrees(): Group {
  const group = new Group()

  const trunkGeo = new CylinderGeometry(0.15, 0.22, 1, 6)
  const trunkMat = new MeshStandardMaterial({ color: 0x6b4a30, roughness: 1 })
  const trunks = scatterInstances(trunkGeo, trunkMat, 90, [1.5, 3.5], 0.5)
  group.add(trunks)

  // Re-derive the same instance transforms for the foliage so each cone sits
  // on top of its matching trunk.
  const foliageGeo = new ConeGeometry(1, 2.2, 7)
  const foliageMat = new MeshStandardMaterial({ color: 0x2e6b3a, roughness: 1 })
  const foliage = new InstancedMesh(foliageGeo, foliageMat, trunks.count)
  foliage.castShadow = true
  const m = new Matrix4()
  for (let i = 0; i < trunks.count; i++) {
    trunks.getMatrixAt(i, m)
    m.multiply(new Matrix4().makeTranslation(0, 1.3, 0))
    foliage.setMatrixAt(i, m)
  }
  foliage.instanceMatrix.needsUpdate = true
  group.add(foliage)

  return group
}

function buildRocks(): InstancedMesh {
  const geo = new DodecahedronGeometry(1, 0)
  const mat = new MeshStandardMaterial({ color: 0x777777, roughness: 0.9, flatShading: true })
  return scatterInstances(geo, mat, 40, [0.4, 1.2], 0.4)
}

function buildGateCourse(): Group {
  const group = new Group()
  const gateCount = 6
  const courseRadius = 35
  const ringMat = new MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.5, metalness: 0.1 })
  const poleMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })

  for (let i = 0; i < gateCount; i++) {
    const angle = (i / gateCount) * Math.PI * 2
    const x = Math.cos(angle) * courseRadius
    const z = Math.sin(angle) * courseRadius
    const groundY = heightAt(x, z)
    const gateHeight = 4

    const gate = new Group()
    const ring = new Mesh(new TorusGeometry(1.6, 0.12, 12, 24), ringMat)
    ring.castShadow = true
    ring.position.y = gateHeight
    gate.add(ring)

    for (const side of [-1, 1]) {
      const pole = new Mesh(new CylinderGeometry(0.08, 0.08, gateHeight, 8), poleMat)
      pole.position.set(side * 1.6, gateHeight / 2, 0)
      pole.castShadow = true
      gate.add(pole)
    }

    gate.position.set(x, groundY, z)
    gate.lookAt(0, groundY + gateHeight, 0)
    group.add(gate)
  }

  return group
}

export function buildEnvironment(): Group {
  const group = new Group()
  group.add(buildSky())
  group.add(buildTerrain())
  group.add(buildTrees())
  group.add(buildRocks())
  group.add(buildGateCourse())
  return group
}
