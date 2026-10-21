// Time-based exercises are stored in minutes (a decimal), so 45 seconds is 0.75 and 2 min 30 sec is 2.5.
// These helpers turn that number into minutes + seconds for typing, and into readable text for showing.
export const splitDuration = (m?: number): { min: number; sec: number } => {
  const total = Math.round((m || 0) * 60);
  return { min: Math.floor(total / 60), sec: total % 60 };
};
export const joinDuration = (min: number, sec: number): number => Math.round(((min || 0) + (sec || 0) / 60) * 10000) / 10000;
/** "10 min", "45 sec" or "2 min 30 sec" */
export const fmtDuration = (m?: number): string => {
  const { min, sec } = splitDuration(m);
  if (min && sec) return `${min} min ${sec} sec`;
  if (sec) return `${sec} sec`;
  return `${min} min`;
};
/** The number and the unit shown in a set cell: "10 min", "45 sec", "2:30 min". */
export const durationCell = (m?: number): { value: string; unit: string } => {
  const { min, sec } = splitDuration(m);
  if (min && sec) return { value: `${min}:${String(sec).padStart(2, "0")}`, unit: "min" };
  if (sec) return { value: String(sec), unit: "sec" };
  return { value: String(min), unit: "min" };
};
