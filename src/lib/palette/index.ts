import type { Zone } from "@/lib/board";

export type MarbleLook = {
  /** Spoken name for the HUD: "Amber's move". */
  readonly name: string;
  /** Glass body color for three.js; deeper than the CSS swatch because
   *  tone mapping and the clearcoat sheen lift it on screen. */
  readonly hex: number;
  /** The same color as CSS, for the HTML overlay. */
  readonly css: string;
  /** Surface roughness; pearl is softer than the clear glass colors. */
  readonly roughness: number;
};

/** Six glass marbles, one per tip. Vivid against dark wood and green felt. */
export const MARBLE_LOOKS: Readonly<Record<Zone, MarbleLook>> = {
  S: { name: "Amber", hex: 0xf08a14, css: "#f5a623", roughness: 0.1 },
  N: { name: "Emerald", hex: 0x14b062, css: "#27c47a", roughness: 0.1 },
  NE: { name: "Ruby", hex: 0xd81f38, css: "#e8324a", roughness: 0.1 },
  SW: { name: "Sapphire", hex: 0x1f6fe0, css: "#2f86ec", roughness: 0.1 },
  SE: { name: "Pearl", hex: 0xf4ecdc, css: "#f4ecdc", roughness: 0.3 },
  NW: { name: "Onyx", hex: 0x34323d, css: "#34323d", roughness: 0.08 },
};
