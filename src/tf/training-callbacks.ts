import { CustomCallback, getBackend } from "@tensorflow/tfjs"
import { useTrainingStore, getModelEvaluation } from "./training"
import { useDatasetStore } from "@/data/datasets"
import { useStatusText } from "@/components/status"
import { useLogStore } from "@/ui-components/logs-plot"
import { Params } from "@tensorflow/tfjs-layers/dist/base_callbacks"

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
  private setStatus = useStatusText.getState().setStatusText
  private startTime = 0
  private firstRun = true
  private initialEpoch = 0
  declare params: TypedParams
  constructor() {
    super({
      onTrainBegin: () => {
        this.startTime = performance.now()
        // console.log(this.params)
      },
      onEpochBegin: (epoch) => {
        this.epoch = epoch
        if (this.firstRun) {
          this.firstRun = false
          this.initialEpoch = epoch
        }
      },
      onBatchEnd: (batchIndex: number) => {
        this.prochessedBatches++
        const epochs = this.params.epochs - this.initialEpoch
        const sessionEpoch = this.epoch - this.initialEpoch
        const totalPercent =
          this.prochessedBatches / (epochs * this.epochBatches)
        const epochPercent = (batchIndex + 1) / this.epochBatches
        const elapsedTime = performance.now() - this.startTime
        const secPerEpoch = elapsedTime / (sessionEpoch + epochPercent) / 1000
        const data = {
          Epoch: `${this.epoch + 1}/${this.params.epochs}`,
          Batch: `${batchIndex + 1}/${this.epochBatches}`,
          "": `${secPerEpoch.toFixed(1)}s/epoch`,
        }
        this.setStatus({ title: "Training ...", data }, totalPercent)
      },
      onTrainEnd: async () => {
        const { accuracy, loss } = await getModelEvaluation()
        const totalTime = (performance.now() - this.startTime) / 1000
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
}

export class LogsPlotCb extends CustomCallback {
  private epoch = 0
  private setLogs = useLogStore.getState().setLogs
  constructor() {
    super({
      onEpochBegin: (epoch) => {
        this.epoch = epoch
      },
      onBatchEnd: (_, log) => {
        const { epoch } = this
        if (log) this.setLogs((prev) => [...prev, { epoch, ...log }])
      },
      onEpochEnd: (epoch, log) => {
        if (log) this.setLogs((prev) => [...prev, { epoch, ...log }])
      },
    })
  }
}
