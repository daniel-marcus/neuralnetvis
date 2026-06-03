export interface EpochLog {
  epoch: number
  loss?: number
  acc?: number
  val_loss?: number
  val_acc?: number
}

export interface BatchLog extends EpochLog {
  batch: number
  size: number
}

export type TrainingLog = BatchLog | EpochLog

export const VAL_METRICS: (keyof EpochLog)[] = ["val_loss", "val_acc"]
const METRICS: (keyof TrainingLog)[] = ["loss", "acc", ...VAL_METRICS]
export type Metric = (typeof METRICS)[number]

export function isBatchLog(log: TrainingLog): log is BatchLog {
  return "batch" in log && typeof log.batch === "number"
}
