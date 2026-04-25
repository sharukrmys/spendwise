import { cn } from '@/core/utils'

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn('animate-spin text-primary-400', className)}
      width={size} height={size}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <Spinner size={32} />
    </div>
  )
}

export function SkeletonLine({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return <div className="shimmer" style={{ width, height, borderRadius: height / 2 }} />
}

// ─── Skeleton page fallback for lazy routes ─────────────────────────
function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="shimmer w-10 h-10 rounded-2xl shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="shimmer h-3 rounded-full" style={{ width: `${60 + (i * 15) % 30}%` }} />
            <div className="shimmer h-2.5 rounded-full" style={{ width: `${40 + (i * 10) % 20}%` }} />
          </div>
          <div className="shimmer h-4 rounded-full w-14 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col min-h-full bg-base">
      <div className="shimmer h-44 w-full" style={{ borderRadius: 0 }} />
      <div className="px-4 py-4 flex flex-col gap-4">
        <SkeletonCard rows={2} />
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  )
}
