'use client';

/* ── Skeleton primitives for loading states ── */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div className={`h-4 bg-gray-200 rounded-md animate-pulse ${className}`} />
  );
}

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-200 rounded-xl animate-pulse ${className}`} />
  );
}

export function SkeletonAvatar({ className = '' }: { className?: string }) {
  return (
    <div className={`w-9 h-9 rounded-full bg-gray-200 animate-pulse flex-shrink-0 ${className}`} />
  );
}

/* ── Prebuilt skeleton patterns ── */

export function StatCardSkeleton() {
  return (
    <div className="card !p-5 space-y-3">
      <div className="flex items-start justify-between">
        <SkeletonBlock className="w-10 h-10 !rounded-xl" />
      </div>
      <SkeletonLine className="w-16 h-6" />
      <SkeletonLine className="w-24 h-3" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonLine className={i === 0 ? 'w-48' : 'w-20'} />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card !p-0 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="table-header border-b border-border">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="table-cell">
                <SkeletonLine className="w-16 h-3" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-4">
          <SkeletonLine className="w-20 h-5" />
          <SkeletonLine className="w-full h-5" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonLine className="h-4" />
            <SkeletonLine className="h-4" />
            <SkeletonLine className="h-4" />
            <SkeletonLine className="h-4" />
          </div>
          <div className="pt-3 border-t border-border flex justify-between">
            <SkeletonLine className="w-24 h-3" />
            <SkeletonLine className="w-12 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
