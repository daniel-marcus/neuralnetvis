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
  const long = maxChars > 2

  return (
    <div
      className="grid grid-cols-[auto_1fr] gap-[var(--gap)] text-xs sm:text-base [--gap:0.5px] sm:[--gap:0.1em] [--label-padding:0.5em] sm:[--label-padding:1em] w-full overflow-hidden"
      style={
        {
          "--num-classes": numClasses,
          "--grid-size":
            "min(500px, calc(100vw - 2 * var(--padding-main) - var(--label-max-w) - var(--axis-label-height) - var(--gap)))",
          "--cell-size": `calc(var(--grid-size) / var(--num-classes) - var(--gap))`,
          "--label-width": long
            ? `calc(${maxChars}ch + 2 * var(--label-padding))`
            : "var(--axis-label-height)",
          "--label-max-w": "min(var(--label-width), 4em)",
          "--axis-label-height": "1.5em",
        } as React.CSSProperties
      }
    >
      <Labels
        name="actual"
        labels={labels}
        position="top"
        long={long}
        className="col-start-2"
      />
      <Labels name="predicted" labels={labels} position="left" long={long} />
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
  name: string
  labels: string[]
  position: "top" | "bottom" | "left" | "right"
  long?: boolean
  className?: string
}

function Labels({ name, labels, position, long, className = "" }: LabelProps) {
  const orient = position === "top" || position === "bottom" ? "row" : "column"
  return (
    <div
      className={`flex gap-[var(--gap)] ${
        position === "top"
          ? "flex-col"
          : position === "bottom"
          ? "flex-col-reverse"
          : position === "right"
          ? "flex-row-reverse"
          : "flex-row"
      } text-secondary ${className}`}
    >
      <div
        className={`flex items-center justify-center bg-box-dark ${
          orient === "column" ? "w-[var(--axis-label-height)]" : ""
        }`}
      >
        <div className={orient === "column" ? "-rotate-90" : ""}>{name}</div>
      </div>
      <div
        className={`grid gap-[var(--gap)] ${
          orient === "column"
            ? "h-full grid-rows-[repeat(var(--num-classes),var(--cell-size))] min-w-[var(--label-max-w)] _sm:min-w-[var(--cell-size)]"
            : `w-full grid-cols-[repeat(var(--num-classes),var(--cell-size))] ${
                long
                  ? "min-h-[var(--label-width)]"
                  : "min-h-[var(--axis-label-height)]"
              }`
        }`}
        style={{} as React.CSSProperties}
      >
        {labels.map((label, i) => (
          <div
            key={i}
            className={`bg-box-dark ${
              long ? "px-[var(--label-padding)]" : ""
            } leading-none flex items-center ${
              long
                ? orient === "row"
                  ? "h-[var(--cell-size)] w-[var(--label-width)] -rotate-90 origin-top-left translate-y-[var(--label-width)]"
                  : "max-w-[var(--label-max-w)] sm:max-w-none"
                : ""
            } ${
              long
                ? position === "left" || position === "bottom"
                  ? "sm:justify-end"
                  : "justify-start"
                : "justify-center"
            }`}
          >
            <div className={long && orient === "column" ? "truncate" : ""}>
              {label}
            </div>
          </div>
        ))}
      </div>
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
