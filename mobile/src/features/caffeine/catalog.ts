import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";

export type DrinkOption = {
  id: string;
  /** Display name, e.g. "Monster Energy" or "Brewed coffee". */
  label: string;
  /** Serving description, e.g. "16 oz" or "Grande 16 oz". */
  size: string;
  mg: number;
};

export type DrinkCategory = {
  id: string;
  name: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  /** First option is the default selection. Empty for the "Other" category (custom entry). */
  options: DrinkOption[];
};

// Approximate caffeine amounts from manufacturer / chain published values.
// Real amounts vary by batch and preparation — the mg field in the popup is always editable.
export const DRINK_CATEGORIES: DrinkCategory[] = [
  {
    id: "coffee",
    name: "Coffee",
    icon: "cafe",
    options: [
      { id: "coffee-8", label: "Brewed coffee", size: "8 oz", mg: 95 },
      { id: "coffee-12", label: "Brewed coffee", size: "12 oz", mg: 140 },
      { id: "coffee-16", label: "Brewed coffee", size: "16 oz", mg: 190 },
      { id: "sbux-pike-tall", label: "Starbucks Pike Place", size: "Tall 12 oz", mg: 235 },
      { id: "sbux-pike-grande", label: "Starbucks Pike Place", size: "Grande 16 oz", mg: 310 },
      { id: "sbux-pike-venti", label: "Starbucks Pike Place", size: "Venti 20 oz", mg: 410 },
      { id: "dunkin-medium", label: "Dunkin' Original Blend", size: "Medium 14 oz", mg: 210 },
    ],
  },
  {
    id: "espresso",
    name: "Espresso",
    icon: "cafe",
    options: [
      { id: "espresso-single", label: "Espresso", size: "Single shot", mg: 63 },
      { id: "espresso-double", label: "Espresso", size: "Double shot", mg: 126 },
      { id: "sbux-espresso-solo", label: "Starbucks Espresso", size: "Solo", mg: 75 },
      { id: "sbux-espresso-doppio", label: "Starbucks Espresso", size: "Doppio", mg: 150 },
    ],
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    icon: "snow",
    options: [
      { id: "cold-brew-16", label: "Cold brew", size: "16 oz", mg: 200 },
      { id: "sbux-cold-brew-grande", label: "Starbucks Cold Brew", size: "Grande 16 oz", mg: 205 },
      { id: "sbux-cold-brew-venti", label: "Starbucks Cold Brew", size: "Venti 24 oz", mg: 310 },
      { id: "la-colombe-draft", label: "La Colombe Draft Latte", size: "9 oz can", mg: 120 },
    ],
  },
  {
    id: "latte",
    name: "Latte",
    icon: "cafe-outline",
    options: [
      { id: "latte-1shot", label: "Latte", size: "1 shot", mg: 63 },
      { id: "latte-2shot", label: "Latte", size: "2 shots", mg: 126 },
      { id: "sbux-latte-tall", label: "Starbucks Caffè Latte", size: "Tall 12 oz", mg: 75 },
      { id: "sbux-latte-grande", label: "Starbucks Caffè Latte", size: "Grande 16 oz", mg: 150 },
      { id: "sbux-frapp-grande", label: "Starbucks Coffee Frappuccino", size: "Grande 16 oz", mg: 95 },
    ],
  },
  {
    id: "tea",
    name: "Tea",
    icon: "leaf",
    options: [
      { id: "black-tea", label: "Black tea", size: "8 oz", mg: 47 },
      { id: "green-tea", label: "Green tea", size: "8 oz", mg: 28 },
      { id: "sbux-chai-grande", label: "Starbucks Chai Latte", size: "Grande 16 oz", mg: 95 },
    ],
  },
  {
    id: "matcha",
    name: "Matcha",
    icon: "leaf-outline",
    options: [
      { id: "matcha-1tsp", label: "Matcha", size: "1 tsp (~2 g)", mg: 70 },
      { id: "matcha-2tsp", label: "Matcha", size: "2 tsp (~4 g)", mg: 140 },
      { id: "sbux-matcha-grande", label: "Starbucks Matcha Latte", size: "Grande 16 oz", mg: 80 },
    ],
  },
  {
    id: "energy",
    name: "Energy Drink",
    icon: "flash",
    options: [
      { id: "energy-generic", label: "Energy drink", size: "16 oz", mg: 160 },
      { id: "redbull-8", label: "Red Bull", size: "8.4 oz", mg: 80 },
      { id: "redbull-12", label: "Red Bull", size: "12 oz", mg: 114 },
      { id: "monster-16", label: "Monster Energy", size: "16 oz", mg: 160 },
      { id: "celsius-12", label: "Celsius", size: "12 oz", mg: 200 },
      { id: "alani-12", label: "Alani Nu", size: "12 oz", mg: 200 },
      { id: "ghost-16", label: "Ghost Energy", size: "16 oz", mg: 200 },
      { id: "c4-16", label: "C4 Energy", size: "16 oz", mg: 200 },
      { id: "rockstar-16", label: "Rockstar", size: "16 oz", mg: 160 },
      { id: "bang-16", label: "Bang", size: "16 oz", mg: 300 },
      { id: "reign-16", label: "Reign", size: "16 oz", mg: 300 },
      { id: "5hour", label: "5-hour Energy", size: "1.93 oz shot", mg: 200 },
    ],
  },
  {
    id: "soda",
    name: "Soda",
    icon: "water",
    options: [
      { id: "coke", label: "Coca-Cola", size: "12 oz", mg: 34 },
      { id: "diet-coke", label: "Diet Coke", size: "12 oz", mg: 46 },
      { id: "pepsi", label: "Pepsi", size: "12 oz", mg: 38 },
      { id: "mtn-dew", label: "Mountain Dew", size: "12 oz", mg: 54 },
      { id: "dr-pepper", label: "Dr Pepper", size: "12 oz", mg: 41 },
    ],
  },
  {
    id: "preworkout",
    name: "Pre-workout",
    icon: "barbell",
    options: [
      { id: "preworkout-scoop", label: "Pre-workout", size: "1 scoop", mg: 200 },
      { id: "c4-original-scoop", label: "C4 Original", size: "1 scoop", mg: 150 },
    ],
  },
  {
    id: "pill",
    name: "Caffeine Pill",
    icon: "medkit",
    options: [
      { id: "pill-200", label: "Caffeine pill", size: "200 mg tablet", mg: 200 },
      { id: "pill-100", label: "Caffeine pill", size: "100 mg tablet", mg: 100 },
    ],
  },
  { id: "other", name: "Other", icon: "add-circle-outline", options: [] },
];

export function categoryIcon(categoryId?: string): DrinkCategory["icon"] {
  return DRINK_CATEGORIES.find((c) => c.id === categoryId)?.icon ?? "cafe-outline";
}
