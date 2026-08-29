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
  const height = 96;
  const paddingX = 8;
  const paddingY = 14;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((d.value - minVal) / range) * (height - paddingY * 2);
    return { x, y, value: d.value, date: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const first = data[0].value;
  const last = data[data.length - 1].value;
  const delta = last - first;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} />
        ))}
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-white/40">{data[0].date}</span>
        <span
          className="text-[10px] font-semibold"
          style={{ color: delta === 0 ? '#ffffff80' : delta < 0 ? '#6ccbde' : '#ec2226' }}
        >
          {delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${unit}`}
        </span>
        <span className="text-[10px] text-white/40">{data[data.length - 1].date}</span>
      </div>
    </div>
  );
};
