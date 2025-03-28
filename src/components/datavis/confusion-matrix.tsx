import { getDbDataAsTensors } from "@/data/dataset"
import { clearStatus, setStatus, useSceneStore } from "@/store"
import React, { useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { setBackendIfAvailable } from "@/model/tf-backend"
import { getHighlightColor } from "@/utils/colors"

const DUMMY_CELL: CellProps = {
  count: undefined,
  normalized: 0,
  sampleIdxs: [],
}

export const ConfusionMatrix = () => {
  const labels = useSceneStore((s) => s.ds?.outputLabels ?? [])
  const values = useCellValues()
  const numClasses = labels.length
  const length = numClasses * numClasses

  const maxChars = labels.reduce((acc, label) => {
    return label.length > acc ? label.length : acc
  }, 0)
  const longLabels = maxChars > 2

  return (
    <div
      className="relative grid grid-cols-[auto_1fr] gap-[var(--gap)] text-sm sm:text-base"
      style={
        {
          "--num-classes": numClasses,
          "--cell-size": `calc(min(500px, calc(100vw - 2 * var(--padding-main) - var(--label-width))) / (var(--num-classes)))`, // TODO ...
          "--gap": "0.1em",
          "--label-padding": "1em",
          "--label-width": `calc(${maxChars}ch + 2 * var(--label-padding))`,
        } as React.CSSProperties
      }
    >
      <div></div>
      <Labels labels={labels} position="top" longLabels={longLabels} />
      <Labels labels={labels} position="left" longLabels={longLabels} />
      <div className="aspect-square grid grid-cols-[repeat(var(--num-classes),var(--cell-size))] grid-rows-[repeat(var(--num-classes),var(--cell-size))] gap-[var(--gap)]">
        {Array.from({ length }, (_, i) => {
          const rowIdx = Math.floor(i / numClasses)
          const colIdx = i % numClasses
          const isCorrect = rowIdx === colIdx
          const cell = values[i] ?? DUMMY_CELL
          const backgroundColor = getCellColor(cell.normalized, isCorrect)
          return (
            <div
              key={i}
              className={`flex items-center justify-center cursor-pointer ${
                isCorrect ? "text-white" : ""
              }`}
              style={{ backgroundColor }}
              onClick={() => console.log(cell.sampleIdxs)}
            >
              {cell.count ?? "-"}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface LabelProps {
  labels: string[]
  position: "top" | "bottom" | "left" | "right"
  longLabels?: boolean
}

function Labels({ labels, position, longLabels }: LabelProps) {
  const orient = position === "top" || position === "bottom" ? "row" : "column"
  return (
    <div
      className={`grid gap-[var(--gap)] text-secondary ${
        orient === "column"
          ? "h-full grid-rows-[repeat(var(--num-classes),var(--cell-size))] min-w-[var(--cell-size)]"
          : "w-full grid-cols-[repeat(var(--num-classes),var(--cell-size))] min-h-[max(var(--label-width),var(--cell-size))]"
      }`}
      style={{} as React.CSSProperties}
    >
      {labels.map((label, i) => (
        <div
          key={i}
          className={`text-secondary bg-box-bg px-[var(--label-padding)] flex items-center whitespace-nowrap ${
            longLabels && orient === "row"
              ? "h-[var(--cell-size)] w-[var(--label-width)] -rotate-90 origin-top-left translate-y-[var(--label-width)]"
              : ""
          } ${
            longLabels
              ? position === "left" || position === "bottom"
                ? "justify-end"
                : "justify-start"
              : "justify-center"
          }`}
        >
          {label}
        </div>
      ))}
    </div>
  )
}

interface CellProps {
  count?: number
  normalized: number
  sampleIdxs: number[]
}

function useCellValues() {
  const [values, setValues] = useState<CellProps[]>([])
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)

  useEffect(() => {
    async function getValues() {
      if (!model || !ds) return
      const statusId = setStatus("Calculating confusion matrix...", -1)
      const numClasses = ds.outputLabels.length
      await setBackendIfAvailable("webgl") // wasm doesn't support confusionMatrix
      const res = await getDbDataAsTensors(ds, subset)
      if (!res) return
      try {
        const { X, y } = res
        const cm = tf.tidy(() => {
          const yTrue = y.argMax(-1) as tf.Tensor1D
          const yPred = (model.predict(X) as tf.Tensor).argMax(
            -1
          ) as tf.Tensor1D
          const cm = tf.math
            .confusionMatrix(yTrue, yPred, numClasses)
            .transpose()
          const maxPerCol = cm.max(0).arraySync() as number[]
          const cmValues = cm.flatten().arraySync()

          function getSampleIdxs(trueClass: number, predClass: number) {
            const trueMask = yTrue.equal(trueClass)
            const predMask = yPred.equal(predClass)
            const mask = trueMask.logicalAnd(predMask).arraySync() as number[]
            const indices = mask.reduce((acc, val, idx) => {
              if (val) acc.push(idx)
              return acc
            }, [] as number[])
            return indices
          }

          return cmValues.map((count, i) => {
            const rowIdx = Math.floor(i / numClasses)
            const colIdx = i % numClasses
            return {
              count,
              normalized: count / (maxPerCol[colIdx] || Infinity),
              sampleIdxs: getSampleIdxs(colIdx, rowIdx),
            }
          })
        })
        console.log({ cm })
        setValues(cm)
      } catch (e) {
        console.warn(e)
      } finally {
        clearStatus(statusId)
        Object.values(res).forEach((t) => t?.dispose())
        await setBackendIfAvailable() // reset to default backend
      }
    }
    getValues()
    return () => setValues([])
  }, [model, ds, subset])

  return values
}

function getCellColor(normalized: number, isCorrect: boolean) {
  const val = isCorrect ? normalized : -normalized
  return getHighlightColor(val)?.style
}
