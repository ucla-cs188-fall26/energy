/** Chart contract for the backend's formula forecast; no local energy model. */
export type Forecast = {
  now: number;
  points: { t: number; value: number }[];
  /** Lowest point of the next dip before bedtime, if there is one. */
  dip: number | null;
  /** Hours until energy falls noticeably below the current level. */
  steadyHours: number | null;
};

export function energyStatus(value: number) {
  if (value >= 70) return "You’re in a good spot";
  if (value >= 50) return "Your energy is dipping";
  return "You’re running low";
}
