import React from 'react';

interface DataPoint {
  date: string;
  value: number;
}

interface MiniBarChartProps {
  data: DataPoint[];
  color: string;
  unit?: string;
  maxValue?: number;
}

/**
 * Bar chart variant of MiniLineChart, used for discrete score-based
 * assessments (like posture, scored 1-10 per visit) where each data
 * point is its own distinct event rather than a continuous trend -
 * bars represent this more honestly than a connected line would.
 * Shares the same dimensions, font, and color conventions as
 * MiniLineChart so it feels like part of the same design system.
 */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({ data, color, unit = '', maxValue }) => {
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
  const chartHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => d.value);
  const scaleMax = maxValue ?? Math.max(...values, 1);

  const slotWidth = (width - paddingX * 2) / data.length;
  const barWidth = Math.min(28, slotWidth * 0.55);

  const bars = data.map((d, i) => {
    const cx = paddingX + slotWidth * (i + 0.5);
    const barHeight = Math.max(2, (d.value / scaleMax) * chartHeight);
    const y = paddingTop + (chartHeight - barHeight);
    return { x: cx - barWidth / 2, y, barHeight, value: d.value, date: d.date, cx };
  });

  const maxDateLabels = 5;
  const dateLabelStep = Math.max(1, Math.ceil(bars.length / maxDateLabels));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }} preserveAspectRatio="none">
        {bars.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={barWidth} height={b.barHeight} rx="3" fill={color} fillOpacity="0.85" />
            <text x={b.cx} y={b.y - 6} fontSize="8" fill="white" fillOpacity="0.85" textAnchor="middle" fontFamily="monospace">
              {b.value}
            </text>
            {i % dateLabelStep === 0 && (
              <text x={b.cx} y={height - 6} fontSize="7" fill="white" fillOpacity="0.35" textAnchor="middle">
                {b.date.slice(5)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
