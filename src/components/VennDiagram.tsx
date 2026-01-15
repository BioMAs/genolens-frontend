'use client';

import { useMemo } from 'react';

interface VennData {
  sets: string[];
  intersections: {
    sets: string[];
    size: number;
    genes: string[];
  }[];
}

interface VennDiagramProps {
  data: VennData;
  onSetClick?: (sets: string[]) => void;
}

export default function VennDiagram({ data, onSetClick }: VennDiagramProps) {
  const { sets, intersections } = data;

  // Calculate positions and sizes based on number of sets
  const vennLayout = useMemo(() => {
    if (sets.length === 2) {
      return get2SetLayout(sets, intersections);
    } else if (sets.length === 3) {
      return get3SetLayout(sets, intersections);
    }
    return null;
  }, [sets, intersections]);

  if (!vennLayout) {
    return (
      <div className="text-center text-gray-500 py-8">
        Venn diagram not available for {sets.length} sets
      </div>
    );
  }

  const viewBox = "0 0 600 400";
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="w-full">
      <svg viewBox={viewBox} className="w-full h-auto">
        {/* Circles */}
        {vennLayout.circles.map((circle, idx) => (
          <g key={circle.label}>
            <circle
              cx={circle.x}
              cy={circle.y}
              r={circle.r}
              fill={colors[idx]}
              fillOpacity="0.3"
              stroke={colors[idx]}
              strokeWidth="2"
              className="cursor-pointer hover:fill-opacity-40 transition-all"
              onClick={() => onSetClick?.([circle.label])}
            />
            <text
              x={circle.labelX}
              y={circle.labelY}
              textAnchor="middle"
              className="font-semibold text-sm fill-gray-800 pointer-events-none"
            >
              {circle.label}
            </text>
            <text
              x={circle.labelX}
              y={circle.labelY + 16}
              textAnchor="middle"
              className="text-xs fill-gray-600 pointer-events-none"
            >
              ({circle.total} genes)
            </text>
          </g>
        ))}

        {/* Intersection labels */}
        {vennLayout.labels.map((label, idx) => (
          <g key={idx}>
            <circle
              cx={label.x}
              cy={label.y}
              r="20"
              fill="white"
              fillOpacity="0.9"
              className="cursor-pointer hover:fill-opacity-100"
              onClick={() => onSetClick?.(label.sets)}
            />
            <text
              x={label.x}
              y={label.y + 5}
              textAnchor="middle"
              className="font-bold text-sm fill-gray-900 pointer-events-none"
            >
              {label.count}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-sm">
        {sets.map((set, idx) => (
          <div key={set} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colors[idx], opacity: 0.6 }}
            />
            <span className="font-medium">{set}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Layout for 2 sets
function get2SetLayout(sets: string[], intersections: any[]) {
  const totalA = intersections.find(i => i.sets.length === 1 && i.sets[0] === sets[0])?.size || 0;
  const totalB = intersections.find(i => i.sets.length === 1 && i.sets[0] === sets[1])?.size || 0;
  const common = intersections.find(i => i.sets.length === 2)?.size || 0;

  const r = 100; // radius
  const centerY = 200;

  return {
    circles: [
      {
        label: sets[0],
        x: 200,
        y: centerY,
        r,
        labelX: 150,
        labelY: 100,
        total: totalA + common
      },
      {
        label: sets[1],
        x: 400,
        y: centerY,
        r,
        labelX: 450,
        labelY: 100,
        total: totalB + common
      }
    ],
    labels: [
      { x: 200, y: centerY, count: totalA, sets: [sets[0]] },
      { x: 300, y: centerY, count: common, sets: sets },
      { x: 400, y: centerY, count: totalB, sets: [sets[1]] }
    ]
  };
}

// Layout for 3 sets
function get3SetLayout(sets: string[], intersections: any[]) {
  // Find all intersection sizes
  const getSize = (targetSets: string[]) => {
    const sorted = [...targetSets].sort();
    const intersection = intersections.find(i => {
      const iSorted = [...i.sets].sort();
      return JSON.stringify(iSorted) === JSON.stringify(sorted);
    });
    return intersection?.size || 0;
  };

  const onlyA = getSize([sets[0]]);
  const onlyB = getSize([sets[1]]);
  const onlyC = getSize([sets[2]]);
  const ab = getSize([sets[0], sets[1]]);
  const ac = getSize([sets[0], sets[2]]);
  const bc = getSize([sets[1], sets[2]]);
  const abc = getSize([sets[0], sets[1], sets[2]]);

  const r = 90; // radius
  const centerX = 300;
  const centerY = 220;
  const offset = 70;

  // Triangle arrangement
  const circles = [
    {
      label: sets[0],
      x: centerX,
      y: centerY - offset,
      r,
      labelX: centerX,
      labelY: centerY - offset - r - 10,
      total: onlyA + ab + ac + abc
    },
    {
      label: sets[1],
      x: centerX - offset,
      y: centerY + offset,
      r,
      labelX: centerX - offset - r - 40,
      labelY: centerY + offset,
      total: onlyB + ab + bc + abc
    },
    {
      label: sets[2],
      x: centerX + offset,
      y: centerY + offset,
      r,
      labelX: centerX + offset + r + 40,
      labelY: centerY + offset,
      total: onlyC + ac + bc + abc
    }
  ];

  const labels = [
    // Only in A
    { x: centerX, y: centerY - offset - 30, count: onlyA, sets: [sets[0]] },
    // Only in B
    { x: centerX - offset - 35, y: centerY + offset + 35, count: onlyB, sets: [sets[1]] },
    // Only in C
    { x: centerX + offset + 35, y: centerY + offset + 35, count: onlyC, sets: [sets[2]] },
    // A ∩ B
    { x: centerX - 35, y: centerY - 10, count: ab, sets: [sets[0], sets[1]] },
    // A ∩ C
    { x: centerX + 35, y: centerY - 10, count: ac, sets: [sets[0], sets[2]] },
    // B ∩ C
    { x: centerX, y: centerY + offset + 10, count: bc, sets: [sets[1], sets[2]] },
    // A ∩ B ∩ C (center)
    { x: centerX, y: centerY + 15, count: abc, sets: sets }
  ];

  return { circles, labels };
}
