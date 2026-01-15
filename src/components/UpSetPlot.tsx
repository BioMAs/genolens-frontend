'use client';

import { useMemo } from 'react';

interface UpSetData {
  sets: string[];
  intersections: {
    sets: string[];
    size: number;
    genes: string[];
  }[];
}

interface UpSetPlotProps {
  data: UpSetData;
  onSetClick?: (sets: string[]) => void;
}

export default function UpSetPlot({ data, onSetClick }: UpSetPlotProps) {
  const { sets, intersections } = data;

  // Sort intersections by size (descending)
  const sortedIntersections = useMemo(() => {
    return [...intersections].sort((a, b) => b.size - a.size).slice(0, 15); // Top 15
  }, [intersections]);

  // Calculate set totals
  const setTotals = useMemo(() => {
    return sets.map(set => {
      const total = intersections
        .filter(i => i.sets.includes(set))
        .reduce((sum, i) => sum + i.size, 0);
      return { set, total };
    });
  }, [sets, intersections]);

  const maxSize = Math.max(...sortedIntersections.map(i => i.size));
  const barWidth = 40;
  const barGap = 10;
  const matrixSize = 20;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Bar Chart */}
        <div className="flex items-end gap-2 px-4 mb-4" style={{ height: '300px' }}>
          {sortedIntersections.map((intersection, idx) => {
            const barHeight = (intersection.size / maxSize) * 250;
            return (
              <div
                key={idx}
                className="flex flex-col items-center cursor-pointer group"
                style={{ width: `${barWidth}px` }}
                onClick={() => onSetClick?.(intersection.sets)}
              >
                {/* Gene count label */}
                <div className="text-xs font-medium text-gray-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {intersection.size}
                </div>

                {/* Bar */}
                <div
                  className="w-full bg-brand-primary rounded-t transition-all group-hover:bg-brand-primary/80"
                  style={{ height: `${barHeight}px` }}
                />

                {/* Bar label (always visible for top 5) */}
                {idx < 5 && (
                  <div className="text-xs font-medium text-gray-900 mt-1">
                    {intersection.size}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Connection Matrix */}
        <div className="border-t-2 border-gray-300 pt-4 px-4">
          <div className="flex gap-2">
            {sortedIntersections.map((intersection, colIdx) => (
              <div
                key={colIdx}
                className="flex flex-col gap-1"
                style={{ width: `${barWidth}px` }}
              >
                {sets.map((set, rowIdx) => {
                  const isInSet = intersection.sets.includes(set);
                  const isConnected = intersection.sets.length > 1 && isInSet;

                  return (
                    <div
                      key={`${colIdx}-${rowIdx}`}
                      className="flex items-center justify-center"
                      style={{ height: `${matrixSize + 4}px` }}
                    >
                      {isConnected && colIdx > 0 && (
                        <div
                          className="absolute bg-gray-400"
                          style={{
                            width: `${barWidth / 2}px`,
                            height: '2px',
                            marginLeft: `-${barWidth / 4}px`
                          }}
                        />
                      )}
                      <div
                        className={`rounded-full ${
                          isInSet
                            ? 'bg-gray-800'
                            : 'bg-gray-200'
                        }`}
                        style={{
                          width: `${matrixSize}px`,
                          height: `${matrixSize}px`
                        }}
                      />
                      {isConnected && colIdx < sortedIntersections.length - 1 && (
                        <div
                          className="absolute bg-gray-400"
                          style={{
                            width: `${barWidth / 2}px`,
                            height: '2px',
                            marginRight: `-${barWidth / 4}px`
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Set Labels and Totals */}
        <div className="mt-6 px-4">
          <div className="grid gap-2">
            {setTotals.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-gray-50 rounded"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full bg-gray-800"
                    style={{ opacity: 0.8 }}
                  />
                  <span className="font-medium text-sm">{item.set}</span>
                </div>
                <span className="text-sm text-gray-600">
                  {item.total} genes
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="mt-4 px-4 text-xs text-gray-500">
          <p>
            Showing top {sortedIntersections.length} intersections out of {intersections.length} total.
            Hover over bars for gene counts.
          </p>
        </div>
      </div>
    </div>
  );
}
