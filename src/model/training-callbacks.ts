import { CustomCallback, getBackend, nextFrame } from "@tensorflow/tfjs"
import throttle from "lodash.throttle"
import { useGlobalStore, isDebug } from "@/store"
import { getModelEvaluation } from "./training"
import {
  resolveScalarsInLogs,
  type UnresolvedLogs,
} from "@tensorflow/tfjs-layers/dist/logs"
import type { TypedParams } from "./types"

const THROTTLE = 30

export class UpdateCb extends CustomCallback {
  private silent = useGlobalStore.getState().trainConfig.silent
  private batchSize = useGlobalStore.getState().trainConfig.batchSize
  private next = useGlobalStore.getState().nextSample
  private trainingComplete = false // will be set only if all epochs ran fully without interruption
  declare params: TypedParams
  constructor() {
    super({
      onBatchBegin: () => {
        if (this.silent) return
        this.next(this.batchSize) // trigger view update
        useGlobalStore.getState().setBatchCount((prev) => prev + 1) // trigger model update
      },
      onEpochEnd: (epoch) => {
        useGlobalStore.getState().setEpochCount(epoch + 1)
        if (epoch === this.params.epochs - 1) {
          this.trainingComplete = true
        }
      },
      onTrainEnd: () => {
        if (this.trainingComplete) {
          useGlobalStore.setState({
            isTraining: false,
            trainingPromise: null,
          })
        }
        if (this.silent) {
          const setBatchCount = useGlobalStore.getState().setBatchCount
          const processedSamples = (this.params.samples ?? 0) - 1
          this.next(processedSamples) // update view
          setBatchCount((c) => c + processedSamples) // update weights
        }
      },
    })
  }
}

export class ProgressCb extends CustomCallback {
  private prochessedBatches = 0
  private epoch = 0
  private statusId = "training_progress"
  private setStatus = throttle(
    useGlobalStore.getState().status.update,
    THROTTLE
  )
  private startTime = 0
  private firstRun = true
  private initialEpoch = 0
  declare params: TypedParams

  constructor() {
    super({
      onTrainBegin: () => {
        this.startTime = Date.now()
        // console.log(this.params)
      },
      onEpochBegin: (epoch) => {
        this.epoch = epoch
        if (this.firstRun) {
          this.firstRun = false
          this.initialEpoch = epoch
        }
      },
      onTrainEnd: async () => {
        const { accuracy, loss } = await getModelEvaluation()
        const totalTime = (Date.now() - this.startTime) / 1000
        const title = `Training finished (${getBackend()})`
        const data = {
          Loss: loss?.toFixed(3),
          Accuracy: accuracy?.toFixed(3),
          Time: `${totalTime.toFixed(2)}s`,
        }
        this.setStatus({ title, data }, null, { id: this.statusId })
      },
    })
  }

  get epochBatches() {
    return (
      this.params.steps ??
      Math.ceil(this.params.samples / this.params.batchSize)
    )
  }

  async onBatchEnd(batchIndex: number) {
    this.prochessedBatches++
    const epochs = this.params.epochs - this.initialEpoch
    const sessionEpoch = this.epoch - this.initialEpoch
    const totalPercent = this.prochessedBatches / (epochs * this.epochBatches)
    const epochPercent = (batchIndex + 1) / this.epochBatches
    const elapsedTime = Date.now() - this.startTime
    const secPerEpoch = elapsedTime / (sessionEpoch + epochPercent) / 1000
    const data = {
      Epoch: `${this.epoch + 1}/${this.params.epochs}`,
      Batch: `${batchIndex + 1}/${this.epochBatches}`,
      "": `${secPerEpoch.toFixed(1)}s/epoch`,
    }
    this.setStatus({ title: "Training ...", data }, totalPercent, {
      id: this.statusId,
    })
  }
}

export class LogsPlotCb extends CustomCallback {
  private epoch = 0
  private addLogs = throttle(useGlobalStore.getState().addLogs, THROTTLE)
  private lastLogTime = 0
  private updEvery = 50 // ms
  constructor() {
    super({
      onEpochBegin: (epoch) => {
        this.epoch = epoch
      },
      onEpochEnd: (epoch, logs) => {
        if (!logs) return
        this.addLogs([{ epoch, ...logs }])
      },
    })
  }
  async onBatchEnd(_: number, logs: UnresolvedLogs) {
    if (!logs) return
    if (Date.now() - this.lastLogTime > this.updEvery) {
      this.lastLogTime = Date.now()
      await nextFrame()
      await resolveScalarsInLogs(logs)
      this.addLogs([{ epoch: this.epoch, ...logs }])
    }
  }
}

export class DebugCb extends CustomCallback {
  private startTime = 0
  constructor() {
    super({
      onTrainBegin: () => {
        this.startTime = Date.now()
      },
      onTrainEnd: () => {
        if (isDebug()) console.log(Date.now() - this.startTime)
      },
    })
  }
}
