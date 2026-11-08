export type CaffeineEntry = {
  id: string;
  name: string;
  mg: number;
  /** ISO timestamp of when the drink was consumed (not when it was logged). */
  consumedAt: string;
  /** Set when logged from a preset; undefined for custom drinks. */
  presetId?: string;
};

export type NewCaffeineEntry = Omit<CaffeineEntry, "id">;
