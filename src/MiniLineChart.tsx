import React from 'react';

interface DataPoint {
  date: string;
  value: number;
}

interface MiniLineChartProps {
  data: DataPoint[];
  color: string;
  unit?: string;
}

export const MiniLineChart: React.FC<MiniLineChartProps> = ({ data, color, unit = '' }) => {
  if (data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-[11px] text-white/30 font-light">
        Not enough data yet
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="h-24 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-white font-mono">{data[0].value}{unit}</span>
        <span className="text-[10px] text-white/40">{data[0].date}</span>
      </div>
    );
  }

  const width = 300;
  const height = 120;
  const paddingX = 12;
  const paddingTop = 26;
  const paddingBottom = 24;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const y = paddingTop + (height - paddingTop - paddingBottom) - ((d.value - minVal) / range) * (height - paddingTop - paddingBottom);
    return { x, y, value: d.value, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Show every point's date if there are few enough to fit without
  // crowding; otherwise thin them out to avoid overlapping text.
  const maxDateLabels = 5;
  const dateLabelStep = Math.max(1, Math.ceil(points.length / maxDateLabels));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
            <text x={p.x} y={p.y - 8} fontSize="8" fill="white" fillOpacity="0.85" textAnchor="middle" fontFamily="monospace">
              {p.value}
            </text>
            {i % dateLabelStep === 0 && (
              <text x={p.x} y={height - 6} fontSize="7" fill="white" fillOpacity="0.35" textAnchor="middle">
                {p.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
