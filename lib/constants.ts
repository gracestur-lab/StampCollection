export const THEME_TAXONOMY = [
  "ANIMALS",
  "FLOWERS",
  "HISTORICAL",
  "ARCHITECTURE",
  "TRANSPORT",
  "HOLIDAYS",
  "SPACE",
  "SPORTS"
] as const;

export type ThemeTaxonomy = (typeof THEME_TAXONOMY)[number];

export const STAMP_COLOR_TAXONOMY = [
  "BLACK",
  "WHITE",
  "GRAY",
  "BROWN",
  "RED",
  "ORANGE",
  "YELLOW",
  "GREEN",
  "BLUE",
  "PURPLE",
  "PINK",
  "GOLD",
  "SILVER"
] as const;

export type StampColor = (typeof STAMP_COLOR_TAXONOMY)[number];

export const FOREVER_STAMP_FACE_VALUE = "78c";
export const FOREVER_STAMP_DOLLARS = 0.78;

export const THEME_KEYWORDS: Record<ThemeTaxonomy, string[]> = {
  ANIMALS: ["animal", "bird", "cat", "dog", "horse", "wildlife", "fauna"],
  FLOWERS: ["flower", "rose", "tulip", "orchid", "flora", "botanical"],
  HISTORICAL: ["historic", "history", "president", "war", "founder", "anniversary"],
  ARCHITECTURE: ["building", "bridge", "cathedral", "architecture", "monument"],
  TRANSPORT: ["train", "car", "ship", "plane", "transport", "locomotive", "rail"],
  HOLIDAYS: ["christmas", "holiday", "new year", "easter", "festive", "celebration"],
  SPACE: ["space", "moon", "mars", "rocket", "astronaut", "galaxy"],
  SPORTS: ["sport", "olympic", "soccer", "baseball", "basketball", "tennis"]
};
