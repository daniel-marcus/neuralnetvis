import { CustomCallback, getBackend } from "@tensorflow/tfjs"
import { useTrainingStore, getModelEvaluation } from "./training"
import { useDatasetStore } from "@/data/datasets"
import { useStatusText } from "@/components/status"
import { useLogStore } from "@/ui-components/logs-plot"
import { Params } from "@tensorflow/tfjs-layers/dist/base_callbacks"

interface TypedParams extends Params {
  batchSize: number
  epochs: number
  samples: number
  initialEpoch: number
}

export class UpdateCb extends CustomCallback {
  private silent = useTrainingStore.getState().config.silent
  private next = useDatasetStore.getState().next
  private trainingComplete = false // will be set only if all epochs ran fully without interruption
  declare params: TypedParams
  constructor() {
    super({
      onBatchBegin: () => {
        if (this.silent) return
        this.next(this.params.batchSize) // trigger view update
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
            const processedSamples = this.params.samples - 1
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
  private startTime = Date.now()
  declare params: TypedParams
  constructor() {
    super({
      onTrainBegin: () => {
        this.startTime = Date.now()
      },
      onEpochBegin: (epoch) => {
        this.epoch = epoch
      },
      onBatchEnd: (batchIndex: number) => {
        this.prochessedBatches++
        const epochs = this.params.epochs - this.params.initialEpoch
        const percent = this.prochessedBatches / (epochs * this.epochBatches)
        const data = {
          Epoch: `${this.epoch + 1}/${this.params.epochs}`,
          Batch: `${batchIndex + 1}/${this.epochBatches}`,
        }
        this.setStatus({ title: "Training ...", data }, percent)
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
    return Math.ceil(this.params.samples / this.params.batchSize)
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
