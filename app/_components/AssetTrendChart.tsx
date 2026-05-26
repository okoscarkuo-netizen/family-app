'use client'

import { useState, useRef, useCallback } from 'react'

type Coordinate = {
  x: number
  y: number
  value: number
  dateKey: string
}

type MonthTick = {
  label: string
  position: number
}

type Props = {
  coordinates: Coordinate[]
  linePath: string
  areaPath: string
  monthTicks: MonthTick[]
  svgWidth: number
  svgHeight: number
  paddingX: number
}

function formatCurrency(value: number) {
  return `NT$${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value)}`
}

function formatDateLabel(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey)
  if (!match) return ''
  return `${match[1]}/${Number(match[2])}/${Number(match[3])}`
}

export function AssetTrendChart({ coordinates, linePath, areaPath, monthTicks, svgWidth, svgHeight, paddingX }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const findNearestIndex = useCallback((clientX: number): number => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || !coordinates.length) return coordinates.length - 1

    const svgX = ((clientX - rect.left) / rect.width) * svgWidth
    let nearest = 0
    let minDist = Infinity

    for (let i = 0; i < coordinates.length; i++) {
      const dist = Math.abs(coordinates[i].x - svgX)
      if (dist < minDist) {
        minDist = dist
        nearest = i
      }
    }
    return nearest
  }, [coordinates, svgWidth])

  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    setSelectedIndex(findNearestIndex(e.touches[0].clientX))
  }, [findNearestIndex])

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    e.preventDefault()
    setSelectedIndex(findNearestIndex(e.touches[0].clientX))
  }, [findNearestIndex])

  const handleTouchEnd = useCallback(() => {
    setSelectedIndex(null)
  }, [])

  const selected = selectedIndex !== null ? coordinates[selectedIndex] : null
  const latestPoint = coordinates[coordinates.length - 1]

  return (
    <div>
      <div className="relative">
        {selected && (
          <div className="absolute left-1 top-2 z-10 flex items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1 shadow-sm ring-1 ring-slate-100">
            <span className="text-[0.68rem] font-medium text-slate-400">{formatDateLabel(selected.dateKey)}</span>
            <span className="text-[0.9rem] font-bold text-slate-800">{formatCurrency(selected.value)}</span>
          </div>
        )}
        <svg
          ref={svgRef}
          aria-label="資產走勢圖"
          className="block h-60 w-full touch-none"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <defs>
            <linearGradient id="asset-trend-fill-home" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#17b79c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#17b79c" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#asset-trend-fill-home)" />
          <path d={linePath} fill="none" stroke="#15957d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <line
            x1={paddingX}
            x2={svgWidth - paddingX}
            y1={svgHeight - 24}
            y2={svgHeight - 24}
            stroke="#dfe7e3"
            strokeWidth="0.8"
          />

          {selected ? (
            <>
              <line
                x1={selected.x}
                x2={selected.x}
                y1={18}
                y2={svgHeight - 24}
                stroke="#15957d"
                strokeDasharray="3 3"
                strokeWidth="1.2"
                opacity="0.5"
              />
              <circle cx={selected.x} cy={selected.y} fill="#ffffff" r="4.5" stroke="#15957d" strokeWidth="2" />
            </>
          ) : (
            <circle cx={latestPoint.x} cy={latestPoint.y} fill="#ffffff" r="3.25" stroke="#15957d" strokeWidth="1.6" />
          )}
        </svg>
      </div>

      <div className="relative mt-1 h-6 px-1 text-[0.72rem] font-medium text-slate-400">
        {monthTicks.map((tick, index) => (
          <span
            key={tick.label}
            className="absolute whitespace-nowrap"
            style={{
              left: index === 0 ? 0 : index === monthTicks.length - 1 ? '100%' : `${tick.position * 100}%`,
              transform: index === 0 ? 'translateX(0)' : index === monthTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </div>
  )
}
