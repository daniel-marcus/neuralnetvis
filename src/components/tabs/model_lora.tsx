import { useRef } from "react"
import { CollapsibleWithTitle, Button, InputRowsWrapper } from "@/components/ui-elements"
import { getScene, setStatus, useCurrScene } from "@/store"
import { exportLora, importLora } from "@/model/lora/training"
import { PEFT_CONFIG_FILE, PEFT_WEIGHTS_FILE } from "@/model/lora/peft"
import type { ChangeEvent } from "react"

const STATUS_ID = "lora_adapter"

// fine-tuned LoRA adapter (see train tab) as files of Hugging Face PEFT
export function LoraAdapterControl() {
  const hasModel = useCurrScene((s) => !!s.model)
  const hasLora = useCurrScene((s) => !!s.lora)
  const isTraining = useCurrScene((s) => s.isTraining)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <CollapsibleWithTitle title="lora adapter" border={false} collapsed>
      <InputRowsWrapper>
        <div className="text-sm opacity-75">
          Fine-tuned weights as Hugging Face PEFT files ({PEFT_WEIGHTS_FILE} + {PEFT_CONFIG_FILE}).
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={!hasModel || isTraining}
          >
            import
          </Button>
          <Button onClick={onExport} disabled={!hasLora}>
            export
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".safetensors,.json"
          className="hidden"
          onChange={onImport}
        />
      </InputRowsWrapper>
    </CollapsibleWithTitle>
  )
}

async function onExport() {
  const { lora, ds } = getScene().getState()
  if (!lora) return
  try {
    const files = await exportLora(lora.adapter, ds)
    files.forEach(download)
  } catch (err) {
    setStatus(`Export failed: ${(err as Error).message}`, null, { id: STATUS_ID })
  }
}

async function onImport(e: ChangeEvent<HTMLInputElement>) {
  const files = [...(e.target.files ?? [])]
  e.target.value = "" // the same files can be selected again
  const { model } = getScene().getState()
  if (!model || !files.length) return
  try {
    await importLora(model, files)
    setStatus("LoRA adapter imported", null, { id: STATUS_ID })
  } catch (err) {
    setStatus(`Import failed: ${(err as Error).message}`, null, { id: STATUS_ID })
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // two downloads in a row
}
