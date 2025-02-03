import * as tf from "@tensorflow/tfjs"
import { useEffect, useState } from "react"

export function useTfBackend() {
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    async function checkReady() {
      await (setBackendIfAvailable("webgl") || tf.ready())
      setIsReady(true)
    }
    checkReady()
  }, [])
  return isReady
}

export async function setBackendIfAvailable(backend: string) {
  await tf.ready()
  return getAvailableBackends().includes(backend) && tf.setBackend(backend)
}

export function getAvailableBackends() {
  // sort backends by priority: [webgpu, webgl, cpu]
  return Object.entries(tf.engine().registryFactory)
    .sort(([, a], [, b]) => b.priority - a.priority)
    .map(([name]) => name)
}
