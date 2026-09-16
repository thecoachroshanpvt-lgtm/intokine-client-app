import React from 'react';

interface SegmentMeterProps {
  value: number;
  max?: number;
}

/**
 * A 10-segment progress meter for discrete, destination-based scores
 * (like posture, scored 1-10 with a fixed ceiling) rather than
 * open-ended progression. Filled segments blend from the app's red
 * to its cyan brand color as they approach the destination, so the
 * color itself communicates "getting close" the way a gauge would.
 */
export const SegmentMeter: React.FC<SegmentMeterProps> = ({ value, max = 10 }) => {
  const filledCount = Math.max(0, Math.min(max, Math.round(value)));

  // Interpolates between the brand red (#ec2226) and brand cyan
  // (#6ccbde) based on how far along the full 1..max range a given
  // segment sits, so the color itself reads as "closing in on 10".
  const colorForSegment = (index: number) => {
    const t = max > 1 ? index / (max - 1) : 1;
    const r = Math.round(0xec + (0x6c - 0xec) * t);
    const g = Math.round(0x22 + (0xcb - 0x22) * t);
    const b = Math.round(0x26 + (0xde - 0x26) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xl font-black text-white font-mono">
          {value}<span className="text-xs text-white/40"> / {max}</span>
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-2.5 rounded-sm"
            style={{ background: i < filledCount ? colorForSegment(i) : 'rgba(255,255,255,0.08)' }}
          />
        ))}
      </div>
    </div>
  );
};
