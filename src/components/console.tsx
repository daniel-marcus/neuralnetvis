import { useState } from "react"

export const Console = () => {
  const [entries] = useState<string[]>([])
  return (
    <div className="fixed top-0 left-0 p-4 text-gray-600">
      <div>Neuro Vis 0.1.0</div>
      {entries.slice(-5).map((entry, i) => (
        <div key={i} dangerouslySetInnerHTML={{ __html: entry }}></div>
      ))}
    </div>
  )
}
