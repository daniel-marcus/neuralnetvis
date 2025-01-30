import React from "react"
import { useStatusText } from "./status-text"

interface LoadingSpinnerProps {
  isActive: boolean
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ isActive }) => {
  const percent = useStatusText((s) => s.percent)
  const hasProgressBar = percent !== undefined
  return (
    <div
      className={`absolute z-[1] inset-0 flex items-end justify-start bg-transparent transition-opacity duration-300 ease-in-out p-4 pointer-events-none ${
        isActive ? "opacity-50" : "opacity-0 "
      } ${hasProgressBar ? "pb-12" : ""}`}
    >
      <div
        className="w-10 h-10 border-4 border-t-transparent border-b-transparent border-white rounded-full animate-spin"
        style={{
          animationDuration: "0.8s",
        }}
      />
    </div>
  )
}

export default LoadingSpinner
