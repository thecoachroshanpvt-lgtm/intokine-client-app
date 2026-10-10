import React, { useEffect, useState } from 'react';

export type ChartRangeKey = '6' | '12' | 'all';

/**
 * Shared by every progress chart: shows the latest 6 updates by default so numbers and dates
 * never pile up, with chips to look further back (Last 12 / All) once there is more history.
 */
export function useChartRange<T>(data: T[]) {
  const [range, setRange] = useState<ChartRangeKey>('6');
  const [selected, setSelected] = useState<number | null>(null);
  const limit = range === '6' ? 6 : range === '12' ? 12 : data.length;
  const visible = data.length > limit ? data.slice(data.length - limit) : data;

  // Changing the range or receiving new data clears a tapped dot, so it can never point at the wrong item.
  useEffect(() => {
    setSelected(null);
  }, [range, data.length]);

  const options: { key: ChartRangeKey; label: string }[] = [{ key: '6', label: 'Last 6' }];
  if (data.length > 6) options.push({ key: '12', label: 'Last 12' });
  if (data.length > 12) options.push({ key: 'all', label: 'All' });
  // With 7-12 updates, "Last 12" already shows everything, so there is nothing else to pick.
  const showChips = data.length > 6;

  const chips = showChips ? (
    <div className="flex justify-end gap-1 mb-1">
      {options
        .filter((o) => (data.length <= 12 ? o.key !== 'all' : true))
        .map((o) => {
          const active = range === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setRange(o.key)}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition ${
                active ? 'bg-[#6ccbde]/20 text-[#6ccbde] border-[#6ccbde]/50' : 'bg-transparent text-white/40 border-white/10'
              }`}
            >
              {o.label}
            </button>
          );
        })}
    </div>
  ) : null;

  return { visible, chips, selected, setSelected };
}
