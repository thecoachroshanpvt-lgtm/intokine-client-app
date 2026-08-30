import React from 'react';

interface DataPoint {
  date: string;
  value: number;
}

interface MiniBarChartProps {
  data: DataPoint[];
  color: string;
  unit?: string;
}

export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data, color, unit = '' }) => {
  if (data.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-[11px] text-white/30 font-light">
        Not enough data yet
      </div>
    );
  }

  const width = 300;
  const height = 120;
  const paddingX = 12;
  const paddingTop = 26;
  const paddingBottom = 24;
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);

  const barSlot = (width - paddingX * 2) / data.length;
  const barWidth = Math.min(28, barSlot * 0.55);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = (d.value / maxVal) * chartHeight;
          const x = paddingX + i * barSlot + (barSlot - barWidth) / 2;
          const y = paddingTop + (chartHeight - barHeight);
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={color} fillOpacity="0.85" />
              <text x={x + barWidth / 2} y={y - 6} fontSize="8" fill="white" fillOpacity="0.85" textAnchor="middle" fontFamily="monospace">
                {d.value}
              </text>
              <text x={x + barWidth / 2} y={height - 6} fontSize="7" fill="white" fillOpacity="0.35" textAnchor="middle">
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
