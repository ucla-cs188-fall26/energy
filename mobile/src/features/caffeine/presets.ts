import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";

export type DrinkPreset = {
  id: string;
  name: string;
  mg: number;
  icon: ComponentProps<typeof Ionicons>["name"];
};

// Typical caffeine amounts. Real drinks vary by brand and preparation;
// users can log a custom amount when a preset doesn't fit.
export const DRINK_PRESETS: DrinkPreset[] = [
  { id: "espresso", name: "Espresso (1 shot)", mg: 63, icon: "cafe" },
  { id: "coffee-8", name: "Coffee (8 oz)", mg: 95, icon: "cafe" },
  { id: "coffee-12", name: "Coffee (12 oz)", mg: 140, icon: "cafe" },
  { id: "cold-brew-16", name: "Cold Brew (16 oz)", mg: 200, icon: "cafe" },
  { id: "latte-16", name: "Latte (16 oz)", mg: 130, icon: "cafe" },
  { id: "black-tea", name: "Black Tea (8 oz)", mg: 47, icon: "leaf" },
  { id: "green-tea", name: "Green Tea (8 oz)", mg: 28, icon: "leaf" },
  { id: "matcha", name: "Matcha (8 oz)", mg: 70, icon: "leaf" },
  { id: "energy-small", name: "Energy Drink (8.4 oz)", mg: 80, icon: "flash" },
  { id: "energy-large", name: "Energy Drink (16 oz)", mg: 160, icon: "flash" },
  { id: "cola", name: "Cola (12 oz)", mg: 34, icon: "water" },
  { id: "pill", name: "Caffeine Pill", mg: 200, icon: "medkit" },
];

export function presetIcon(presetId?: string): DrinkPreset["icon"] {
  return DRINK_PRESETS.find((p) => p.id === presetId)?.icon ?? "cafe-outline";
}
