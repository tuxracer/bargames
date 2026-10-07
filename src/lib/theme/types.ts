import { isString } from "remeda";
import type { Zone } from "@/lib/board";

export type ThemeId = "tavern" | "neon";

const THEME_IDS: readonly ThemeId[] = ["tavern", "neon"];

export const isThemeId = (value: unknown): value is ThemeId => {
  return isString(value) && THEME_IDS.includes(value as ThemeId);
};

export type MarbleLook = {
  /** Spoken name for the HUD: "Amber's move". */
  readonly name: string;
  /** Body color for three.js. */
  readonly hex: number;
  /** The same color as CSS, for the HTML overlay. */
  readonly css: string;
  /** Surface roughness; pearl is softer than clear glass. */
  readonly roughness: number;
};

export type Vec3 = readonly [number, number, number];

/** Everything the three.js table needs to dress itself. */
export type SceneTheme = {
  readonly background: number;
  readonly table: {
    readonly color: number;
    /** Glowing grid lines on the table, or null for a plain surface. */
    readonly grid: number | null;
  };
  readonly board: {
    /** Wood gets the grain texture; gloss is a dark lacquered disc. */
    readonly kind: "wood" | "gloss";
    readonly color: number;
    readonly side: number;
  };
  readonly rim: {
    readonly color: number;
    readonly emissive: number;
    readonly emissiveIntensity: number;
  };
  readonly holes: {
    readonly base: number;
    /** How far hole color leans toward the tip's marble color. */
    readonly zoneTint: number;
    /** A lit ring around every hole, for boards that glow. */
    readonly rings: boolean;
  };
  readonly key: {
    readonly color: number;
    readonly intensity: number;
    readonly position: Vec3;
  };
  readonly hemisphere: {
    readonly sky: number;
    readonly ground: number;
    readonly intensity: number;
  };
  readonly environmentIntensity: number;
  readonly exposure: number;
  /** How much a marble emits its own color (0 for plain glass). */
  readonly marbleGlow: number;
  /** How far move-guidance rings are pushed toward white. */
  readonly markerLighten: number;
};

export type Theme = {
  readonly id: ThemeId;
  readonly name: string;
  readonly blurb: string;
  readonly scene: SceneTheme;
  readonly marbles: Readonly<Record<Zone, MarbleLook>>;
};
