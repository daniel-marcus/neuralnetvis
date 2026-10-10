export const GRID_STYLE = {
  "--grid-width": "calc(4 * 1em * 1.5 - 0.6em)",
  "--grid-width-sm": "199px",
} as React.CSSProperties

interface ViewerSlotProps {
  children: React.ReactNode
  footer?: React.ReactNode
}

// same size for all views, so that the table below doesn't move: square content + footer row
export const ViewerSlot = ({ children, footer }: ViewerSlotProps) => (
  <>
    <div className="aspect-square flex items-center overflow-hidden">{children}</div>
    <div className="relative h-6 flex items-center justify-center gap-4">{footer}</div>
  </>
)

// as ProgressBar / Slider: clipped rows of block characters instead of measuring the available width
export const AsciiProgress = ({ progress }: { progress: number }) => (
  <div
    className="absolute top-1 inset-x-0 overflow-hidden whitespace-nowrap leading-none select-none"
    role="progressbar"
    aria-valuenow={Math.round(progress * 100)}
  >
    {"░".repeat(100)}
    <span
      className="absolute top-0 left-0 overflow-hidden text-marker"
      style={{ width: `${progress * 100}%` }}
    >
      {"█".repeat(100)}
    </span>
  </div>
)

interface PagerProps {
  page: number // 0-based
  numPages: number
  setPage: (page: number) => void
  label?: React.ReactNode // default: page number
}

export const Pager = ({ page, numPages, setPage, label = page + 1 }: PagerProps) => (
  <div className="w-full flex justify-between">
    <button
      disabled={page === 0}
      className="hover:text-white disabled:opacity-0"
      onClick={() => setPage(page - 1)}
      aria-label="previous"
    >
      &lt;--
    </button>
    <div>{label}</div>
    <button
      disabled={page === numPages - 1}
      className="hover:text-white disabled:opacity-0"
      onClick={() => setPage(page + 1)}
      aria-label="next"
    >
      --&gt;
    </button>
  </div>
)
