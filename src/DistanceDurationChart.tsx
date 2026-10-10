import React from 'react';
import { useChartRange, TrendLine } from './ChartRange';

interface Row {
  date: string;
  distance?: number; // km
  duration?: number; // min
}

const DIST_COLOR = '#ec2226';
const DUR_COLOR = '#6ccbde';

/**
 * One chart for distance + duration cardio: bars show how long each session was (minutes),
 * the line and dots show how far (km). Each measure has its own scale, so both stay readable.
 */
export const DistanceDurationChart: React.FC<{ data: Row[] }> = ({ data }) => {
  const { visible: rows, chips, selected, setSelected, trend } = useChartRange(data);
  if (rows.length === 0) {
    return <div className="h-24 flex items-center justify-center text-[11px] text-white/30 font-light">Not enough data yet</div>;
  }
  if (trend) {
    return (
      <div>
        {chips}
        <div className="flex items-center gap-4 mb-1">
          <span className="text-[10px] text-white/50"><span style={{ color: DUR_COLOR }}>●</span> Duration (min)</span>
          <span className="text-[10px] text-white/50"><span style={{ color: DIST_COLOR }}>●</span> Distance (km)</span>
        </div>
        <TrendLine
          dates={rows.map((r) => r.date)}
          series={[
            { values: rows.map((r) => r.duration), color: DUR_COLOR },
            { values: rows.map((r) => r.distance), color: DIST_COLOR },
          ]}
        />
      </div>
    );
  }

  const W = 300;
  const H = 150;
  const padX = 14;
  const top = 24;
  const bottom = 24;
  const plotH = H - top - bottom;
  const maxDur = Math.max(1, ...rows.map((r) => r.duration ?? 0)) * 1.1;
  const maxDist = Math.max(0.1, ...rows.map((r) => r.distance ?? 0)) * 1.1;
  const slot = (W - padX * 2) / rows.length;
  const barW = Math.min(26, slot * 0.6);
  const cx = (i: number) => padX + slot * i + slot / 2;
  const base = top + plotH;
  const yDur = (v: number) => base - (v / maxDur) * plotH;
  const yDist = (v: number) => base - (v / maxDist) * plotH;
  const linePts = rows.map((r, i) => (r.distance !== undefined ? { x: cx(i), y: yDist(r.distance), v: r.distance } : null)).filter(Boolean) as { x: number; y: number; v: number }[];
  const path = linePts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const step = Math.max(1, Math.ceil(rows.length / 6));
  const crowded = rows.length > 8;

  return (
    <div>
      {chips}
      <div className="flex items-center gap-4 mb-1">
        <span className="flex items-center gap-1.5 text-[10px] text-white/50">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: DUR_COLOR, opacity: 0.45 }} /> Duration (min)
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-white/50">
          <span className="w-2.5 h-0.5 rounded" style={{ background: DIST_COLOR }} /> Distance (km)
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: `${H}px` }}>
        <line x1={padX} x2={W - padX} y1={base} y2={base} stroke="white" strokeOpacity="0.12" />
        {rows.map((r, i) =>
          r.duration !== undefined ? (
            <g key={`b${i}`} onClick={() => setSelected(selected === i ? null : i)} style={{ cursor: 'pointer' }}>
              <rect x={cx(i) - slot / 2} y={top - 10} width={slot} height={plotH + 10} fill="transparent" />
              <rect x={cx(i) - barW / 2} y={yDur(r.duration)} width={barW} height={base - yDur(r.duration)} rx="3" fill={DUR_COLOR} fillOpacity="0.35" />
              {(!crowded || i === selected || i === rows.length - 1) && (
                <text x={cx(i)} y={base - 4} fontSize="8" fill="white" fillOpacity="0.8" textAnchor="middle" fontFamily="monospace">{r.duration}</text>
              )}
            </g>
          ) : null
        )}
        {linePts.length > 1 && <path d={path} fill="none" stroke={DIST_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {linePts.map((p, k) => {
          const idx = rows.findIndex((r, i) => r.distance !== undefined && cx(i) === p.x);
          return (
            <g key={`d${k}`} onClick={() => setSelected(selected === idx ? null : idx)} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r="9" fill="transparent" />
              <circle cx={p.x} cy={p.y} r="3" fill={DIST_COLOR} stroke="#242426" strokeWidth="1.5" />
              {(!crowded || idx === selected || k === linePts.length - 1) && (
                <text x={p.x} y={p.y - 8} fontSize="8" fill={DIST_COLOR} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{p.v}</text>
              )}
            </g>
          );
        })}
        {rows.map((r, i) =>
          i % step === 0 || i === rows.length - 1 || i === selected ? (
            <text key={`t${i}`} x={cx(i)} y={H - 8} fontSize="7" fill="white" fillOpacity="0.4" textAnchor="middle">{r.date.slice(5)}</text>
          ) : null
        )}
      </svg>
    </div>
  );
};
