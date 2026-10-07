import { isBoolean, isPlainObject } from "remeda";
import { isSensitivity } from "@/lib/beat";
import type { Sensitivity } from "@/lib/beat";
import { isThemeId } from "@/lib/theme";
import type { ThemeId } from "@/lib/theme";

/** Each thing the music may move, switchable on its own. */
export type VisualAspect =
  | "marbles"
  | "bounce"
  | "halos"
  | "rings"
  | "rim"
  | "floor"
  | "room"
  | "overlay";

export const VISUAL_ASPECTS: readonly VisualAspect[] = [
  "marbles",
  "bounce",
  "halos",
  "rings",
  "rim",
  "floor",
  "room",
  "overlay",
];

export type Visuals = Readonly<Record<VisualAspect, boolean>>;

export const isVisuals = (value: unknown): value is Visuals => {
  return (
    isPlainObject(value) &&
    VISUAL_ASPECTS.every((aspect) => isBoolean(value[aspect]))
  );
};

/** Player preferences; they outlive a game. */
export type Options = {
  /** Ring the holes a lifted marble may go to. */
  readonly hints: boolean;
  /** How the table is dressed. */
  readonly theme: ThemeId;
  /** Listen through the microphone and light the table to the music. */
  readonly music: boolean;
  /** How loud the music has to be before the table reacts. */
  readonly sensitivity: Sensitivity;
  /** Which parts of the table the music may move. */
  readonly visuals: Visuals;
  /** Pass and play: tilt the view toward whoever is to move. */
  readonly facePlayer: boolean;
};

export const isOptions = (value: unknown): value is Options => {
  return (
    isPlainObject(value) &&
    isBoolean(value.hints) &&
    isThemeId(value.theme) &&
    isBoolean(value.music) &&
    isSensitivity(value.sensitivity) &&
    isVisuals(value.visuals) &&
    isBoolean(value.facePlayer)
  );
};
