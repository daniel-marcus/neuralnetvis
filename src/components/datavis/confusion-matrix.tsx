import React, { useEffect, useMemo, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { clearStatus, setStatus, useGlobalStore, useSceneStore } from "@/store"
import { getDbDataAsTensors } from "@/data/dataset"
import { getHighlightColor } from "@/utils/colors"
import { setBackend } from "@/model/tf-backend"

const DUMMY_CELL: ConfusionCell = {
  count: undefined,
  normalized: 0,
  sampleIdxs: [],
}

export const ConfusionMatrix = () => {
  const labels = useSceneStore((s) => s.ds?.outputLabels ?? [])
  const cells = useConfusionCells()
  const numClasses = labels.length
  const length = numClasses * numClasses

  const maxChars = labels.reduce((acc, label) => {
    const length = Array.from(label).length // bc emojis count as 2
    return length > acc ? length : acc
  }, 0)
  const long = maxChars > 2

  const [selected, setSelected] = useState<ConfusionCell | null>(null)
  const [hovered, setHovered] = useState<ConfusionCell | null>(null)
  const sel = useMemo(() => selected ?? hovered, [selected, hovered])

  const setSampleViewerIdxs = useSceneStore((s) => s.setSampleViewerIdxs)
  useEffect(() => {
    setSampleViewerIdxs(sel?.sampleIdxs ?? [])
  }, [sel, setSampleViewerIdxs])

  const createGroupedCell = (
    prop: "actualClass" | "predictedClass",
    val: number,
    cb?: (cell: ConfusionCell) => void
  ) => {
    const filteredCells = cells.filter((cell) => cell[prop] === val)
    const groupedCell = filteredCells.reduce(
      (acc, cell) => ({
        ...acc,
        count: (acc.count ?? 0) + (cell.count ?? 0),
        sampleIdxs: [...acc.sampleIdxs, ...cell.sampleIdxs],
      }),
      { ...DUMMY_CELL, [prop]: val, groupProp: prop }
    )
    cb?.(groupedCell)
    return groupedCell
  }

  const handleLabelClick = (
    prop: "actualClass" | "predictedClass",
    val: number
  ) => {
    setSelected((s) =>
      s?.groupProp === prop && s[prop] === val
        ? null
        : createGroupedCell(prop, val)
    )
  }

  return (
    <div
      className={`grid grid-cols-[auto_1fr] gap-[var(--gap)] text-xs sm:text-base [--gap:0.5px] sm:[--gap:0.1em] [--label-padding:0.5em] sm:[--label-padding:1em] overflow-hidden pointer-events-auto [--grid-base:450px] xl:[--grid-base:500px]`}
      style={
        {
          "--num-classes": numClasses,
          "--grid-size":
            "min(var(--grid-base), calc(100vw - 2 * var(--padding-main) - var(--label-max-w) - var(--axis-label-height) - var(--gap)))",
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
        highlighted={sel?.actualClass}
        highlightedIsSelected={!!selected}
        onClick={(val) => handleLabelClick("actualClass", val)}
        onMouseEnter={(actualClass) => {
          createGroupedCell("actualClass", actualClass, setHovered)
        }}
        onMouseLeave={() => setHovered(null)}
      />
      <Labels
        name="predicted"
        labels={labels}
        position="left"
        long={long}
        highlighted={sel?.predictedClass}
        highlightedIsSelected={!!selected}
        onClick={(val) => handleLabelClick("predictedClass", val)}
        onMouseEnter={(predictedClass) => {
          createGroupedCell("predictedClass", predictedClass, setHovered)
        }}
        onMouseLeave={() => setHovered(null)}
      />
      <div className="w-[var(--grid-size)] aspect-square grid grid-cols-[repeat(var(--num-classes),var(--cell-size))] grid-rows-[repeat(var(--num-classes),var(--cell-size))] gap-[var(--gap)]">
        {Array.from({ length }, (_, i) => {
          const rowIdx = Math.floor(i / numClasses)
          const colIdx = i % numClasses
          const isCorrect = rowIdx === colIdx
          const cell = cells[i] ?? DUMMY_CELL
          const backgroundColor = getCellColor(cell.normalized, isCorrect)
          const isSelected = cell !== DUMMY_CELL && selected === cell
          const isHighlighted =
            (cell !== DUMMY_CELL && hovered === cell) ||
            (sel?.groupProp && sel[sel.groupProp] === cell[sel.groupProp])
          return (
            <div
              key={i}
              className={`flex items-center justify-center cursor-pointer ${
                isCorrect ? "text-white" : ""
              } border-2 ${
                isSelected || isHighlighted
                  ? "border-marker"
                  : "border-transparent"
              } ${isSelected ? "rounded-sm" : ""}`}
              style={{ backgroundColor }}
              onClick={() => setSelected((c) => (c === cell ? null : cell))}
              onMouseEnter={() => setHovered(cell)}
              onMouseLeave={() => setHovered(null)}
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
  highlighted?: number
  highlightedIsSelected?: boolean
  onClick?: (i: number) => void
  onMouseEnter?: (i: number) => void
  onMouseLeave?: (i: number) => void
}

function Labels({
  name,
  labels,
  position,
  long,
  highlighted,
  highlightedIsSelected,
  className = "",
  onClick,
  onMouseEnter,
  onMouseLeave,
}: LabelProps) {
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
            ? "grid-rows-[repeat(var(--num-classes),var(--cell-size))] min-w-[var(--label-max-w)] _sm:min-w-[var(--cell-size)]"
            : `grid-cols-[repeat(var(--num-classes),var(--cell-size))] ${
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
            className={`${
              highlighted === i
                ? `bg-marker text-black ${
                    highlightedIsSelected ? "rounded-sm" : ""
                  }`
                : "bg-box-dark"
            } ${
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
            } ${typeof onClick === "function" ? "cursor-pointer" : ""}`}
            onClick={() => onClick?.(i)}
            onMouseEnter={() => onMouseEnter?.(i)}
            onMouseLeave={() => onMouseLeave?.(i)}
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

export interface ConfusionCell {
  count?: number
  normalized: number
  sampleIdxs: number[]
  actualClass?: number
  predictedClass?: number
  groupProp?: "actualClass" | "predictedClass"
}

function useConfusionCells() {
  const [cells, setCells] = useState<ConfusionCell[]>([])
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const backendReady = useGlobalStore((s) => s.backendReady)

  useEffect(() => {
    async function getCells() {
      if (!model || !ds || !backendReady) return
      const statusId = setStatus("Calculating confusion matrix ...", -1)
      const numClasses = ds.outputLabels.length
      const res = await getDbDataAsTensors(ds, subset, { noOneHot: true })
      if (!res) return
      await setBackend("webgl")
      try {
        const cm = tf.tidy(() => {
          const { X, y } = res
          const yTrue = y as tf.Tensor1D
          const yPred = (model.predict(X) as tf.Tensor).argMax(1) as tf.Tensor1D

          const cm = tf.math
            .confusionMatrix(yTrue, yPred, numClasses)
            .transpose()

          const cmValues = cm.flatten().arraySync()
          const maxPerCol = cm.max(0).arraySync() as number[]
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
            const sampleIdxs = getSampleIdxs(colIdx, rowIdx)
            return {
              count,
              sampleIdxs,
              normalized: count / (maxPerCol[colIdx] || Infinity),
              actualClass: colIdx,
              predictedClass: rowIdx,
            }
          })
        })
        setCells(cm)
      } catch (e) {
        console.warn(e)
      } finally {
        clearStatus(statusId)
        Object.values(res).forEach((t) => t?.dispose())
        setBackend() // reset to default backend
      }
    }
    getCells()
    return () => setCells([])
  }, [model, ds, subset, backendReady])

  return cells
}

function getCellColor(normalized: number, isCorrect: boolean) {
  const val = isCorrect ? normalized : -normalized
  return getHighlightColor(val)?.style
}
