export type CaffeineEntry = {
  id: string;
  /** Display name, e.g. "Monster Energy (16 oz)". */
  name: string;
  mg: number;
  /** ISO timestamp of when the user started drinking (not when it was logged). */
  consumedAt: string;
  /** How long it took to finish the drink. Affects how fast caffeine is absorbed. */
  durationMinutes: number;
  categoryId?: string;
  /** Catalog option id; undefined for custom drinks. */
  optionId?: string;
};

export type NewCaffeineEntry = Omit<CaffeineEntry, "id">;
