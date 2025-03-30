import React, { useEffect, useMemo, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { clearStatus, setStatus, useGlobalStore, useSceneStore } from "@/store"
import { getDbDataAsTensors } from "@/data/dataset"
import { getHighlightColor } from "@/utils/colors"
import { setBackend } from "@/model/tf-backend"
import { isTouch } from "@/utils/screen"
import { Evaluation } from "../evaluation"

export const ConfusionMatrix = () => {
  const labels = useSceneStore((s) => s.ds?.outputLabels ?? [])
  const cells = useConfusionCells()
  const numClasses = labels.length
  const maxChars = getMaxChars(labels)
  const long = maxChars > 2

  const [selected, setSelected] = useState<ConfusionCell | null>(null)
  const [hovered, setHovered] = useState<ConfusionCell | null>(null)
  const sel = useMemo(() => selected ?? hovered, [selected, hovered])
  const setSampleIdxs = useSceneStore((s) => s.setSampleViewerIdxs)
  useEffect(() => setSampleIdxs(sel?.sampleIdxs ?? []), [sel, setSampleIdxs])

  const labelProps = (prop: GroupProp) => ({
    name: prop,
    labels: labels,
    long,
    highlighted: sel?.[prop],
    highlightedIsSelected: !!selected,
    ...labelHandlers(prop, setSelected, setHovered, cells),
  })

  const groupProp = sel?.groupProp

  return (
    <OuterGrid numClasses={numClasses} long={long} maxChars={maxChars}>
      <div />
      <Labels position="top" {...labelProps("actual")} />
      <Labels position="left" {...labelProps("predicted")} />
      <InnerGrid>
        {cells.map((cell, i) => {
          const isCorrect = cell.actual === cell.predicted
          const isInSelGroup = groupProp && cell[groupProp] === sel[groupProp]
          return (
            <Cell
              key={i}
              isSelected={cell === selected}
              isHighlighted={cell === hovered || isInSelGroup}
              isCorrect={isCorrect}
              color={getCellColor(cell.normalized ?? 0, isCorrect)}
              onClick={() => setSelected((c) => (c === cell ? null : cell))}
              onMouseEnter={!isTouch() ? () => setHovered(cell) : undefined}
              onMouseLeave={() => setHovered(null)}
            >
              {cell.count}
            </Cell>
          )
        })}
      </InnerGrid>
      <Evaluation className="col-start-2 text-base" />
    </OuterGrid>
  )
}

type DivProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLDivElement
>

const Cell = (
  props: {
    isHighlighted?: boolean
    isSelected?: boolean
    isCorrect?: boolean
    color?: string
  } & DivProps
) => {
  const { isHighlighted, isSelected, isCorrect, color, ...otherProps } = props
  return (
    <div
      className={`flex items-center justify-center cursor-pointer border-2 ${
        isHighlighted ? "border-marker" : "border-transparent"
      } ${isSelected ? "rounded-sm" : ""} ${isCorrect ? "text-white" : ""}`}
      style={{ backgroundColor: color }}
      {...otherProps}
    />
  )
}

function labelHandlers(
  prop: GroupProp,
  setSelected: React.Dispatch<React.SetStateAction<ConfusionCell | null>>,
  setHovered: React.Dispatch<React.SetStateAction<ConfusionCell | null>>,
  cells: ConfusionCell[]
) {
  const groupedCell = (val: number) => {
    return cells
      .filter((cell) => cell[prop] === val)
      .reduce(
        (acc, cell) => ({
          ...acc,
          count: (acc.count ?? 0) + (cell.count ?? 0),
          sampleIdxs: [...acc.sampleIdxs, ...cell.sampleIdxs],
        }),
        { sampleIdxs: [], [prop]: val, groupProp: prop } as ConfusionCell
      )
  }

  const onClick = (val: number) =>
    setSelected((s) =>
      s?.groupProp === prop && s[prop] === val ? null : groupedCell(val)
    )
  const onMouseEnter = (val: number) => setHovered(groupedCell(val))
  const onMouseLeave = () => setHovered(null)

  return { onClick, onMouseEnter, onMouseLeave }
}

interface GridProps {
  numClasses: number
  long?: boolean
  maxChars: number
  children: React.ReactNode
}

const OuterGrid = ({ numClasses, long, maxChars, children }: GridProps) => (
  <div
    className={`grid grid-cols-[auto_1fr] gap-[var(--gap)] text-xs mg:text-sm lg:text-base [--gap:0.5px] sm:[--gap:0.1em] [--label-padding:0.5em] sm:[--label-padding:1em] overflow-hidden pointer-events-auto [--grid-base:400px] xl:[--grid-base:500px]`}
    style={
      {
        "--num-classes": numClasses,
        "--grid-size":
          "min(var(--grid-base), calc(100vw - 2 * var(--padding-main) - var(--label-max-w) - var(--axis-label-size) - var(--gap)))",
        "--cell-size": `calc(var(--grid-size) / var(--num-classes) - var(--gap))`,
        "--label-width": long
          ? `calc(${maxChars}ch + 2 * var(--label-padding))`
          : "var(--axis-label-size)",
        "--label-max-w": "min(var(--label-width), 4em)",
        "--axis-label-size": "1.5em",
      } as React.CSSProperties
    }
  >
    {children}
  </div>
)

const InnerGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[var(--grid-size)] aspect-square grid grid-cols-[repeat(var(--num-classes),var(--cell-size))] grid-rows-[repeat(var(--num-classes),var(--cell-size))] gap-[var(--gap)]">
    {children}
  </div>
)

const LABEL_FLEX_MAP = {
  top: "flex-col",
  bottom: "flex-col-reverse",
  left: "flex-row",
  right: "flex-row-reverse",
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

function Labels(props: LabelProps) {
  const { name, labels, position } = props
  const { long, highlighted, highlightedIsSelected, className = "" } = props
  const { onClick, onMouseEnter, onMouseLeave } = props
  const orient = position === "top" || position === "bottom" ? "row" : "column"
  return (
    <div
      className={`flex gap-[var(--gap)] ${LABEL_FLEX_MAP[position]} text-secondary ${className}`}
    >
      <div
        className={`flex items-center justify-center bg-box-dark ${
          orient === "column" ? "w-[var(--axis-label-size)]" : ""
        }`}
      >
        <div className={orient === "column" ? "-rotate-90" : ""}>{name}</div>
      </div>
      <div
        className={`grid gap-[var(--gap)] ${
          orient === "column"
            ? "grid-rows-[repeat(var(--num-classes),var(--cell-size))] min-w-[var(--label-max-w)]"
            : `grid-cols-[repeat(var(--num-classes),var(--cell-size))] ${
                long
                  ? "min-h-[var(--label-width)]"
                  : "min-h-[var(--axis-label-size)]"
              }`
        }`}
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
            onMouseEnter={!isTouch() ? () => onMouseEnter?.(i) : undefined}
            onMouseLeave={!isTouch() ? () => onMouseLeave?.(i) : undefined}
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

type GroupProp = "actual" | "predicted"

interface ConfusionCell {
  count?: number
  normalized?: number
  sampleIdxs: number[]
  actual?: number
  predicted?: number
  groupProp?: GroupProp
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
              actual: colIdx,
              predicted: rowIdx,
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

function getMaxChars(arr: string[]) {
  return arr.reduce((acc, label) => {
    const length = Array.from(label).length // bc emojis count as 2
    return length > acc ? length : acc
  }, 0)
}
