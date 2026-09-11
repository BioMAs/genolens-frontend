export function CardSkeleton() {
  return (
    <div className="bg-surface shadow rounded-card p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded-sm w-1/3 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded-sm w-full"></div>
        <div className="h-4 bg-gray-200 rounded-sm w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded-sm w-4/6"></div>
      </div>
    </div>
  );
}

export function ComparisonCardSkeleton() {
  return (
    <div className="block p-6 bg-surface shadow rounded-card border border-line animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="h-6 bg-gray-200 rounded-sm w-2/3"></div>
        <div className="h-5 w-5 bg-gray-200 rounded-sm"></div>
      </div>
      <div className="h-4 bg-gray-200 rounded-sm w-1/2 mb-4"></div>
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-gray-200 rounded-sm"></div>
        <div className="h-6 w-20 bg-gray-200 rounded-sm"></div>
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface shadow rounded-control overflow-hidden animate-pulse">
      <div className="px-4 py-5 sm:px-6 border-b border-line">
        <div className="h-6 bg-gray-200 rounded-sm w-1/4"></div>
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div className="h-6 w-6 bg-gray-200 rounded-sm"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-sm w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded-sm w-1/4"></div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-5 w-20 bg-gray-200 rounded-sm"></div>
                <div className="flex gap-2">
                  <div className="h-4 w-4 bg-gray-200 rounded-sm"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded-sm"></div>
                  <div className="h-4 w-4 bg-gray-200 rounded-sm"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlotSkeleton({ height = 'h-96' }: { height?: string }) {
  return (
    <div className={`bg-surface shadow rounded-card p-6 animate-pulse${height}`}>
      <div className="h-6 bg-gray-200 rounded-sm w-1/4 mb-6"></div>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="h-8 w-8 bg-gray-200 rounded-pill mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 rounded-sm w-32"></div>
        </div>
      </div>
    </div>
  );
}

export function QCDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface shadow rounded-card p-6">
          <div className="h-6 bg-gray-200 rounded-sm w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-sm"></div>
        </div>
        <div className="bg-surface shadow rounded-card p-6">
          <div className="h-6 bg-gray-200 rounded-sm w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-sm"></div>
        </div>
      </div>
    </div>
  );
}

export function SampleTableSkeleton() {
  return (
    <div className="bg-surface shadow rounded-card p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded-sm w-1/4 mb-4"></div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded-sm w-20"></div></th>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded-sm w-20"></div></th>
              <th className="px-6 py-3"><div className="h-4 bg-gray-200 rounded-sm w-20"></div></th>
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-line">
            {Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded-sm w-24"></div></td>
                <td className="px-6 py-4"><div className="h-5 bg-gray-200 rounded-pill w-20"></div></td>
                <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded-sm w-8"></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DEGTableSkeleton() {
  return (
    <div className="mt-6 animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="h-6 bg-gray-200 rounded-sm w-1/4"></div>
        <div className="h-4 bg-gray-200 rounded-sm w-32"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-control">
          <div className="h-4 bg-gray-200 rounded-sm w-20 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded-sm w-16"></div>
        </div>
        <div className="bg-green-50 p-4 rounded-control">
          <div className="h-4 bg-gray-200 rounded-sm w-20 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded-sm w-16"></div>
        </div>
        <div className="bg-red-50 p-4 rounded-control">
          <div className="h-4 bg-gray-200 rounded-sm w-20 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded-sm w-16"></div>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-control">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-surface-2">
            <tr>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="px-6 py-3">
                  <div className="h-4 bg-gray-200 rounded-sm w-20"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-line">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 rounded-sm w-full"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div className="py-6 animate-pulse">
      <div className="page-container">
        <div className="mb-6">
          <div className="h-4 bg-gray-200 rounded-sm w-32 mb-3"></div>
        </div>
        <div className="bg-surface shadow rounded-card p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded-sm w-64"></div>
              <div className="h-4 bg-gray-200 rounded-sm w-96"></div>
              <div className="h-3 bg-gray-200 rounded-sm w-40"></div>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded-sm w-28"></div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface-2 p-4 rounded-card">
                <div className="h-3 bg-gray-200 rounded-sm w-20 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded-sm w-16"></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface shadow rounded-control">
          <div className="border-b border-line flex">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-6 py-3">
                <div className="h-4 bg-gray-200 rounded-sm w-20"></div>
              </div>
            ))}
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface-2 rounded-control"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
