import type { Theme, ThemeId } from "./types";

/** A quiet bar at night: wood, felt, lamplight, glass. */
const TAVERN: Theme = {
  id: "tavern",
  name: "Tavern",
  blurb: "Wood, felt, lamplight.",
  scene: {
    background: 0x0d0b0e,
    table: { color: 0x183826, grid: null },
    board: { kind: "wood", color: 0xffffff, side: 0x3f2412 },
    rim: { color: 0x6b3d1f, emissive: 0x000000, emissiveIntensity: 0 },
    holes: { base: 0x6a452a, zoneTint: 0.45, rings: false },
    key: { color: 0xffe0b8, intensity: 3.2, position: [-7, 13, 9] },
    hemisphere: { sky: 0x5e6f9e, ground: 0x3a2416, intensity: 0.5 },
    environmentIntensity: 0.4,
    exposure: 1.0,
    marbleGlow: 0,
    markerLighten: 0.25,
  },
  marbles: {
    S: { name: "Amber", hex: 0xf08a14, css: "#f5a623", roughness: 0.1 },
    N: { name: "Emerald", hex: 0x14b062, css: "#27c47a", roughness: 0.1 },
    NE: { name: "Ruby", hex: 0xd81f38, css: "#e8324a", roughness: 0.1 },
    SW: { name: "Sapphire", hex: 0x1f6fe0, css: "#2f86ec", roughness: 0.1 },
    SE: { name: "Pearl", hex: 0xf4ecdc, css: "#f4ecdc", roughness: 0.3 },
    NW: { name: "Onyx", hex: 0x34323d, css: "#34323d", roughness: 0.08 },
  },
};

/** After hours in a basement club: black lacquer, neon tubes, bass. */
const NEON: Theme = {
  id: "neon",
  name: "Neon",
  blurb: "Black lacquer, neon tubes, bass.",
  scene: {
    background: 0x030308,
    table: { color: 0x05050c, grid: 0x19e6ff },
    board: { kind: "gloss", color: 0x0b0b16, side: 0x07070f },
    rim: { color: 0x1a0a1c, emissive: 0xff2bd6, emissiveIntensity: 1.1 },
    holes: { base: 0x0d1024, zoneTint: 0.55, rings: true },
    key: { color: 0xd8b4ff, intensity: 0.9, position: [6, 12, -4] },
    hemisphere: { sky: 0x2a2cff, ground: 0xff1fa0, intensity: 0.25 },
    environmentIntensity: 0.3,
    exposure: 0.95,
    marbleGlow: 0.5,
    markerLighten: 0,
  },
  marbles: {
    S: { name: "Cyan", hex: 0x19e6ff, css: "#19e6ff", roughness: 0.12 },
    N: { name: "Magenta", hex: 0xff2bd6, css: "#ff2bd6", roughness: 0.12 },
    NE: { name: "Acid", hex: 0xc8ff1f, css: "#c8ff1f", roughness: 0.12 },
    SW: { name: "Ember", hex: 0xff6a1f, css: "#ff6a1f", roughness: 0.12 },
    SE: { name: "Chrome", hex: 0xeef2ff, css: "#eef2ff", roughness: 0.05 },
    NW: { name: "Ultraviolet", hex: 0x8a3dff, css: "#8a3dff", roughness: 0.12 },
  },
};

export const THEMES: Readonly<Record<ThemeId, Theme>> = {
  tavern: TAVERN,
  neon: NEON,
};

export const THEME_LIST: readonly Theme[] = [TAVERN, NEON];

export const DEFAULT_THEME_ID: ThemeId = "tavern";
