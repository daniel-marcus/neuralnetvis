import { CustomCallback, getBackend, nextFrame } from "@tensorflow/tfjs"
import { useTrainingStore, getModelEvaluation } from "./training"
import { useDatasetStore } from "@/data/datasets"
import { useStatusStore } from "@/components/status"
import { useLogStore } from "@/ui-components/logs-plot"
import { Params } from "@tensorflow/tfjs-layers/dist/base_callbacks"
import throttle from "lodash.throttle"
import {
  resolveScalarsInLogs,
  UnresolvedLogs,
} from "@tensorflow/tfjs-layers/dist/logs"

const THROTTLE = 30

type FitParams = {
  // passed in model.fit()
  epochs: number
  samples: number
  batchSize: number
  initialEpoch: number
  steps: null
}
type FitDatasetParams = {
  // passed in model.fitDataset()
  epochs: number
  samples: null
  batchSize: null
  initialEpoch: null
  steps: number // batchesPerEpoch has to be set
}

type TypedParams = Params & (FitParams | FitDatasetParams)

export class UpdateCb extends CustomCallback {
  private silent = useTrainingStore.getState().config.silent
  private batchSize = useTrainingStore.getState().config.batchSize
  private next = useDatasetStore.getState().next
  private trainingComplete = false // will be set only if all epochs ran fully without interruption
  declare params: TypedParams
  constructor() {
    super({
      onBatchBegin: () => {
        if (this.silent) return
        this.next(this.batchSize) // trigger view update
        useTrainingStore.getState().setBatchCount((prev) => prev + 1) // trigger model update
      },
      onEpochEnd: (epoch) => {
        useTrainingStore.getState().setEpochCount(epoch + 1)
        if (epoch === this.params.epochs - 1) {
          this.trainingComplete = true
        }
      },
      onTrainEnd: () => {
        if (this.trainingComplete) {
          useTrainingStore.setState({
            isTraining: false,
            trainingPromise: null,
          })
          if (this.silent) {
            const { setBatchCount } = useTrainingStore.getState()
            const processedSamples = (this.params.samples ?? 0) - 1
            this.next(processedSamples) // update view
            setBatchCount((c) => c + processedSamples) // update weights
          }
        }
      },
    })
  }
}

export class ProgressCb extends CustomCallback {
  private prochessedBatches = 0
  private epoch = 0
  private setStatus = throttle(
    useStatusStore.getState().setStatusText,
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
        this.setStatus({ title, data }, null)
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
    this.setStatus({ title: "Training ...", data }, totalPercent)
  }
}

export class LogsPlotCb extends CustomCallback {
  private epoch = 0
  private addLogs = throttle(useLogStore.getState().addLogs, THROTTLE)
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
  async onBatchEnd(batchIndex: number, logs: UnresolvedLogs) {
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
        console.log(Date.now() - this.startTime)
        useTrainingStore.getState().setIsTraining(false)
      },
    })
  }
}
