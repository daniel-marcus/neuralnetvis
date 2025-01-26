import React from "react"

interface LoadingSpinnerProps {
  isActive: boolean
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ isActive }) => {
  return (
    <div
      className={`absolute z-[1] inset-0 flex items-center justify-center bg-black bg-opacity-80 transition-opacity duration-300 ease-in-out ${
        isActive
          ? "opacity-50 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="w-12 h-12 border-4 border-t-transparent border-b-transparent border-white rounded-full animate-spin"
        style={{
          animationDuration: "0.8s",
        }}
      />
    </div>
  )
}

export default LoadingSpinner
