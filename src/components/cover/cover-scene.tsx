import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { Canvas, useFrame } from "@react-three/fiber"
import { abs, attribute, color, fract, max, mix, normalLocal, positionLocal } from "three/tsl"
import { positionView, smoothstep, uniform, uv, varying, vec3 } from "three/tsl"
import { useGlobalStore } from "@/store"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"
import { createNetwork } from "./network"
import type { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js"

const FOV = 50
const CAMERA_HEIGHT = 4.5

const LAYERS = 12
const LAYER_GAP = 8 // rows between two layers
const DEPTH = LAYERS * LAYER_GAP
const NEURONS = 73 // per layer; odd: one neuron in the middle
const NEURON_SPACING = 2
const NEURON_SIZE = 0.8
const FAN = 2 // every neuron is connected to the 2 * FAN + 1 nearest neurons of the next layer
const CONNECTION_WIDTH = 0.12

const SPEED = 5 // rows per second
const LEAVE_SPEED = 70
const SAMPLE_INTERVAL = 0.6 // seconds between two forward passes
const SIGNAL_DURATION = 0.18 // seconds to reach the next layer, has to be shorter than the interval
const CHANGE_DURATION = 0.1 // seconds for a neuron to change its color
const PULSE_LENGTH = 0.5 // share of a connection

const toColor = ([r, g, b]: number[]) => color(`rgb(${r}, ${g}, ${b})`)

interface CoverSceneProps {
  horizon: number // share of the screen height above the horizon
  isLeaving: boolean
}

// own canvas (not a view of MainCanvas): its render loop would re-render all tiles behind the cover
export default function CoverScene({ horizon, isLeaving }: CoverSceneProps) {
  const gpuDevice = useGlobalStore((s) => s.gpuDevice)
  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )
  if (gpuDevice === null) return null // not initialized yet, undefined: WebGL fallback
  // look slightly upwards to move the horizon below the center of the screen
  const pitch = Math.atan((2 * horizon - 1) * Math.tan(THREE.MathUtils.degToRad(FOV / 2)))
  return (
    <Canvas
      flat // no tone mapping: same colors as in CSS
      frameloop={reducedMotion ? "demand" : "always"}
      dpr={[1, 1.5]}
      camera={{
        fov: FOV,
        near: 0.1,
        far: 2 * DEPTH,
        position: [0, CAMERA_HEIGHT, 0],
        rotation: [pitch, 0, 0],
      }}
      gl={async (renderProps) => {
        const renderer = new THREE.WebGPURenderer({
          ...(renderProps as WebGPURendererParameters),
          device: gpuDevice ? gpuDevice : undefined,
        })
        await renderer.init()
        return renderer
      }}
    >
      <Network isLeaving={isLeaving} />
    </Canvas>
  )
}

function Network({ isLeaving }: Pick<CoverSceneProps, "isLeaving">) {
  const scene = useMemo(() => createScene(), [])
  useEffect(() => scene.dispose, [scene])
  const pointerX = usePointerX()
  useFrame(({ camera }, delta) => {
    scene.update(delta, isLeaving)
    camera.position.x = scene.followPointer(pointerX.current * 1.5, delta)
  })
  return <primitive object={scene.group} />
}

type Float = THREE.Node<"float">

const getActColor = (activation: Float) =>
  mix(
    toColor(ZERO_BASE),
    activation.greaterThanEqual(0).select(toColor(POS_BASE), toColor(NEG_BASE)),
    abs(activation),
  )

/**
 * Endless neural network: layers of neurons with connections to the next layer, seen from the input side.
 * The activations and signals come from the simulation in network.ts, the shaders only animate them.
 * The layers move towards the camera by up to one layer gap, then every layer moves on to the next slot.
 */
function createScene() {
  const network = createNetwork({
    layers: LAYERS,
    neurons: NEURONS,
    fan: FAN,
    sampleInterval: SAMPLE_INTERVAL,
    signalDuration: SIGNAL_DURATION,
  })
  const scroll = uniform(0) // in rows
  const leave = uniform(0) // 0 - 1
  const now = uniform(0) // seconds, as the times of the network

  // layer slots: 0 is behind the camera
  const slotOffset = fract(scroll.div(LAYER_GAP)).mul(LAYER_GAP)
  const getZ = (slot: Float) => slotOffset.sub(slot.mul(LAYER_GAP))
  const getX = (idx: Float) => idx.sub((NEURONS - 1) / 2).mul(NEURON_SPACING)
  const fog = smoothstep(DEPTH * 0.3, DEPTH * 0.95, positionView.z.negate())
  const visibility = fog.oneMinus().mul(leave.oneMinus()) // fade into the glow of the horizon

  // neurons: slots from far to near for blending
  const neurons: number[] = []
  for (let slot = LAYERS - 1; slot >= 0; slot--) {
    for (let idx = 0; idx < NEURONS; idx++) neurons.push(slot, idx)
  }
  const neuronStates = new THREE.InstancedBufferAttribute(new Float32Array(neurons.length * 1.5), 3)
  const neuronMesh = (() => {
    const geometry = toInstanced(new THREE.BoxGeometry(1, 1, 1), neurons.length / 2)
    geometry.setAttribute(
      "neuron",
      new THREE.InstancedBufferAttribute(new Float32Array(neurons), 2),
    )
    geometry.setAttribute("neuronState", neuronStates)
    const neuron = attribute<"vec2">("neuron", "vec2") // slot, idx
    const state = attribute<"vec3">("neuronState", "vec3") // previous activation, activation, changed at
    const progress = smoothstep(0, CHANGE_DURATION, now.sub(state.z))
    const activation = varying(mix(state.x, state.y, progress))

    const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
    material.positionNode = vec3(
      positionLocal.x.mul(NEURON_SIZE).add(getX(neuron.y)),
      positionLocal.y.add(0.5).mul(NEURON_SIZE),
      positionLocal.z.mul(NEURON_SIZE).add(getZ(neuron.x)),
    )
    const shade = max(normalLocal.y, normalLocal.z.mul(0.55), 0.3) // top, front, sides
    material.colorNode = getActColor(activation).mul(shade)
    material.opacityNode = visibility
    return toMesh(geometry, material)
  })()

  // connections: flat ribbons to the next layer, the signals run along them as pulses
  const connections: number[] = []
  for (let slot = LAYERS - 2; slot >= 0; slot--) {
    for (let from = 0; from < NEURONS; from++) {
      for (let to = Math.max(0, from - FAN); to <= Math.min(NEURONS - 1, from + FAN); to++) {
        connections.push(slot, from, to)
      }
    }
  }
  const signals = new THREE.InstancedBufferAttribute(
    new Float32Array((connections.length / 3) * 2),
    2,
  )
  const connectionMesh = (() => {
    const geometry = toInstanced(new THREE.PlaneGeometry(1, 1), connections.length / 3)
    const connectionAttr = new THREE.InstancedBufferAttribute(new Float32Array(connections), 3)
    geometry.setAttribute("connection", connectionAttr)
    geometry.setAttribute("connectionSignal", signals)
    const connection = attribute<"vec3">("connection", "vec3") // slot, from, to
    const signalAttr = attribute<"vec2">("connectionSignal", "vec2") // signal, sent at
    const signal = varying(signalAttr.x)
    const pulsePos = varying(now.sub(signalAttr.y).div(SIGNAL_DURATION))
    const pulse = smoothstep(PULSE_LENGTH, 0, abs(uv().y.sub(pulsePos)))
      .mul(abs(signal))
      .mul(6)
      .min(1)

    const material = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const along = positionLocal.y.add(0.5) // 0: source, 1: target
    material.positionNode = vec3(
      mix(getX(connection.y), getX(connection.z), along).add(positionLocal.x.mul(CONNECTION_WIDTH)),
      NEURON_SIZE / 2,
      getZ(connection.x).sub(along.mul(LAYER_GAP)),
    )
    material.colorNode = mix(toColor(ZERO_BASE).mul(3), getActColor(signal.sign()), pulse)
    material.opacityNode = pulse.mul(0.55).add(0.45).mul(visibility)
    const mesh = toMesh(geometry, material)
    mesh.renderOrder = 1 // after the neurons
    return mesh
  })()

  // same order as the instances
  function syncNetwork() {
    let i = 0
    for (let n = 0; n < neurons.length; n += 2) {
      const layer = network.layers[neurons[n]]
      const idx = neurons[n + 1]
      neuronStates.array[i++] = layer.prevValues[idx]
      neuronStates.array[i++] = layer.values[idx]
      neuronStates.array[i++] = layer.changedAt[idx]
    }
    neuronStates.needsUpdate = true
    i = 0
    for (let c = 0; c < connections.length; c += 3) {
      const layer = network.layers[connections[c]]
      const [from, to] = [connections[c + 1], connections[c + 2]]
      const idx = from * network.fanSize + (to - from + FAN)
      signals.array[i++] = layer.signals[idx]
      signals.array[i++] = layer.sentAt[idx]
    }
    signals.needsUpdate = true
  }
  syncNetwork()

  const group = new THREE.Group().add(neuronMesh, connectionMesh)
  let speed = SPEED
  let passedLayers = 0
  let pointerOffset = 0
  return {
    group,
    update(delta: number, isLeaving: boolean) {
      const dt = Math.min(delta, 0.1) // main thread is busy while the models are loading
      speed += ((isLeaving ? LEAVE_SPEED : SPEED) - speed) * Math.min(1, dt * 3)
      scroll.value += dt * speed
      leave.value = Math.min(1, leave.value + (isLeaving ? dt * 1.5 : 0))
      now.value += dt
      let hasChanged = network.update(now.value)
      for (; passedLayers < Math.floor(scroll.value / LAYER_GAP); passedLayers++) {
        network.shift()
        hasChanged = true
      }
      if (hasChanged) syncNetwork()
    },
    followPointer(target: number, delta: number) {
      pointerOffset += (target - pointerOffset) * Math.min(1, delta * 2)
      return pointerOffset
    },
    dispose() {
      for (const mesh of [neuronMesh, connectionMesh]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
    },
  }
}

function toInstanced(source: THREE.BufferGeometry, instanceCount: number) {
  const geometry = new THREE.InstancedBufferGeometry().copy(
    source as unknown as THREE.InstancedBufferGeometry,
  )
  geometry.instanceCount = instanceCount
  return geometry
}

function toMesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false // positions are set in the shader
  return mesh
}

function usePointerX() {
  const pointerX = useRef(0) // -1 to 1
  useEffect(() => {
    const onMove = (e: PointerEvent) => (pointerX.current = (e.clientX / window.innerWidth) * 2 - 1)
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [])
  return pointerX
}
