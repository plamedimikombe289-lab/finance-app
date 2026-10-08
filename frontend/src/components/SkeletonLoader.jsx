export function SkeletonCard({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} />
}

export function SkeletonRow({ lines = 2 }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="skeleton w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`skeleton h-3 rounded ${i === 0 ? 'w-3/4' : 'w-1/2'}`} />
        ))}
      </div>
      <div className="skeleton h-5 w-16 rounded flex-shrink-0" />
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} className="h-28" />)}
      </div>
      {/* chart placeholder */}
      <SkeletonCard className="h-48" />
      {/* list rows */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}

export function SkeletonListPage({ rows = 6 }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="skeleton h-8 w-24 rounded" />
      </div>
      <SkeletonCard className="h-20" />
      <div className="space-y-2">
        {[...Array(rows)].map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
