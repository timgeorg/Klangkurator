/**
 * The colours users pick for tags, genres, blocks and sets. Print-like inks
 * that hold up on both the ink and the paper theme. Signal orange is left out
 * on purpose: in Klangkurator orange means "this one" (playing, selected,
 * focused), never a category.
 *
 * Mirrored in design-system/tokens/palette.json for non-React consumers.
 */
export interface PaletteColor {
  name: string;
  hex: string;
}

export const ENTITY_COLORS: PaletteColor[] = [
  { name: "Carmine", hex: "#C8102E" },
  { name: "Rose", hex: "#E0607E" },
  { name: "Plum", hex: "#7B3F8C" },
  { name: "Lavender", hex: "#B4A7F2" },
  { name: "Violet", hex: "#6B5BD6" },
  { name: "Indigo", hex: "#3B4BA8" },
  { name: "Ink blue", hex: "#2B3A67" },
  { name: "Cobalt", hex: "#2F6BD8" },
  { name: "Sky", hex: "#6FA8DC" },
  { name: "Teal", hex: "#1E8C8C" },
  { name: "Mint", hex: "#6CC3A0" },
  { name: "Green", hex: "#4E9A2A" },
  { name: "Moss", hex: "#5C7A3A" },
  { name: "Olive", hex: "#8A9A3B" },
  { name: "Ochre", hex: "#C9A227" },
  { name: "Sand", hex: "#CDB891" },
  { name: "Clay", hex: "#B3684A" },
  { name: "Brown", hex: "#7A5236" },
  { name: "Silver", hex: "#A1A2B3" },
  { name: "Slate", hex: "#6D7480" },
];

/** Neutral used when a genre has no configured colour. */
export const FALLBACK_COLOR = "#A1A2B3";

/** A palette colour picked deterministically from a name (stable across runs). */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ENTITY_COLORS[hash % ENTITY_COLORS.length].hex;
}
