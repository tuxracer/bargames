import { Color } from "three";
import { HOLES } from "@/lib/board";
import type { Zone } from "@/lib/board";
import type { BeatFrame } from "@/lib/beat";
import type { Cascade } from "@/lib/cascade";
import { VISUAL_ASPECTS } from "@/lib/options";
import type { VisualAspect, Visuals } from "@/lib/options";
import type { Theme } from "@/lib/theme";
import { clamp } from "@/utils/clamp";
import { MARBLE_REST_Y } from "./consts";
import type { HaloSet } from "./halos";
import type { Marble, MarbleSet } from "./marbles";
import type { SceneHandle } from "./scene";

export type LightShow = {
  /** A beat landed from this tip (null for the center): take its color. */
  strike: (zone: Zone | null) => void;
  /**
   * Light the table for one frame: marbles, halos, hole rings, rim, floor,
   * lamp, and the room, each only if `visuals` allows it. `resting` says
   * which marbles may jump.
   */
  apply: (
    frame: BeatFrame,
    cascade: Cascade,
    bands: Float32Array,
    nowMs: number,
    visuals: Visuals,
    resting: (marble: Marble) => boolean,
  ) => void;
  /** Put everything back the way the theme left it. */
  quiet: (resting: (marble: Marble) => boolean) => void;
};

/** Spectrum bands across half the rim; the other half mirrors them. */
export const RIM_BANDS = 40;
/** The rim's bass end sits at the S tip, the player's side in portrait. */
const RIM_BASS_BEARING = Math.PI / 2;
/** How dim the rim goes between notes, and how bright a full band is. */
const RIM_FLOOR = 0.4;
const RIM_RANGE = 1.9;
/** How far the rim's color leans toward the beat's on a hit. */
const RIM_TINT = 0.45;
/** Hole rings: resting share, bass swing, and whitening on the wave. */
const RING_FLOOR = 0.55;
const RING_BASS = 0.7;
const RING_WHITE = 0.5;
/** Every resting marble hops a little on the hit, on top of the wave. */
const HOP_SHARE = 0.3;

const WHITE = new Color(0xffffff);

/**
 * Everything the music moves, in one place. The canvas listens and drops
 * waves; this turns a beat frame and the cascade into light on the table.
 * Each theme decides how hard through its `music` recipe.
 */
export const createLightShow = (
  handle: SceneHandle,
  marbles: MarbleSet,
  halos: HaloSet,
  theme: Theme,
): LightShow => {
  const look = theme.music;
  const { stage } = handle;
  const accent = new Color(0xffffff);
  const scratch = new Color();

  // Each rim vertex reads one spectrum band by its bearing from S.
  const rimBand = new Uint16Array(stage.rimAngles.length);
  for (let i = 0; i < stage.rimAngles.length; i += 1) {
    let turn = Math.abs(stage.rimAngles[i] - RIM_BASS_BEARING) % (Math.PI * 2);
    if (turn > Math.PI) turn = Math.PI * 2 - turn;
    rimBand[i] = Math.min(
      RIM_BANDS - 1,
      Math.floor((turn / Math.PI) * RIM_BANDS),
    );
  }

  const strike = (zone: Zone | null) => {
    if (zone === null) accent.copy(WHITE);
    else accent.set(theme.marbles[zone].hex);
  };

  const lightMarbles = (
    frame: BeatFrame,
    cascade: Cascade,
    nowMs: number,
    visuals: Visuals,
    resting: (marble: Marble) => boolean,
  ) => {
    halos.begin();
    for (const marble of marbles.byPiece.values()) {
      const position = marble.mesh.position;
      const glow = cascade.glowAt(position.x, position.z, nowMs);
      if (visuals.marbles) marbles.setMusic(marble, glow, frame.bass);
      if (visuals.bounce && marble.hole >= 0 && resting(marble)) {
        const jump = Math.min(glow, 1.2) + frame.punch * HOP_SHARE;
        position.y = MARBLE_REST_Y + jump * look.bounce;
      }
      if (visuals.halos) {
        halos.add(
          position.x,
          position.z,
          marble.mesh.material.color,
          (glow + frame.punch * 0.3) * look.halo,
        );
      }
    }
    halos.end();
  };

  const restMarbles = (resting: (marble: Marble) => boolean) => {
    for (const marble of marbles.byPiece.values()) {
      marbles.setMusic(marble, 0, 0);
      if (marble.hole >= 0 && resting(marble)) {
        marbles.rest(marble, marble.hole);
      }
    }
  };

  const restHalos = () => {
    halos.begin();
    halos.end();
  };

  const lightRings = (frame: BeatFrame, cascade: Cascade, nowMs: number) => {
    const rings = stage.rings;
    if (!rings?.instanceColor) return;
    const colors = rings.instanceColor.array;
    const base = stage.ringColors;
    const breathe = RING_FLOOR + RING_BASS * frame.bass;
    for (const hole of HOLES) {
      const glow = cascade.glowAt(hole.px, hole.py, nowMs);
      const gain = breathe + glow * look.ringGlow;
      const white = Math.min(glow, 1) * RING_WHITE;
      const at = hole.index * 3;
      colors[at] = base[at] * gain + white;
      colors[at + 1] = base[at + 1] * gain + white;
      colors[at + 2] = base[at + 2] * gain + white;
    }
    rings.instanceColor.needsUpdate = true;
  };

  const restRings = () => {
    const rings = stage.rings;
    if (!rings?.instanceColor) return;
    rings.instanceColor.array.set(stage.ringColors);
    rings.instanceColor.needsUpdate = true;
  };

  const lightRim = (frame: BeatFrame, bands: Float32Array) => {
    const swing = 1 + look.rimPulse * (0.5 * frame.bass + 0.5 * frame.punch);
    stage.rim.emissiveIntensity = stage.rimIntensity * swing;
    stage.rim.emissive
      .copy(stage.rimEmissive)
      .lerp(accent, frame.punch * RIM_TINT);
    const music = stage.rimMusic;
    if (!music) return;
    const values = music.array;
    for (let i = 0; i < rimBand.length; i += 1) {
      const level = bands[rimBand[i]] * look.rimSpectrum;
      values[i * 2] = RIM_FLOOR + RIM_RANGE * level;
      values[i * 2 + 1] = level * level * frame.punch * 0.8;
    }
    music.needsUpdate = true;
  };

  const restRim = () => {
    stage.rim.emissiveIntensity = stage.rimIntensity;
    stage.rim.emissive.copy(stage.rimEmissive);
    const music = stage.rimMusic;
    if (!music) return;
    const values = music.array;
    for (let i = 0; i < values.length; i += 2) {
      values[i] = 1;
      values[i + 1] = 0;
    }
    music.needsUpdate = true;
  };

  const lightFloor = (frame: BeatFrame, cascade: Cascade, nowMs: number) => {
    const ripple = stage.ripple;
    if (!ripple) return;
    const waves = ripple.waves.value;
    let count = 0;
    for (const wave of cascade.waves) {
      if (!wave.active) continue;
      const front = cascade.front(wave, nowMs);
      if (front.strength <= 0) continue;
      const at = count * 4;
      waves[at] = wave.x;
      waves[at + 1] = wave.y;
      waves[at + 2] = front.radius;
      waves[at + 3] = front.strength * look.gridRipple;
      count += 1;
    }
    ripple.count.value = count;
    ripple.pulse.value =
      look.gridPulse * (0.6 * frame.bass + 0.5 * frame.punch);
  };

  const restFloor = () => {
    const ripple = stage.ripple;
    if (!ripple) return;
    ripple.count.value = 0;
    ripple.pulse.value = 0;
  };

  const lightRoom = (frame: BeatFrame) => {
    const swing = 1 + look.keyPulse * (0.6 * frame.bass + 0.6 * frame.punch);
    stage.key.intensity = stage.keyIntensity * swing;
    scratch.copy(accent).multiplyScalar(look.roomFlash * frame.punch);
    stage.room.background.copy(stage.room.base).add(scratch);
    stage.room.fog.copy(stage.room.background);
  };

  const restRoom = () => {
    stage.key.intensity = stage.keyIntensity;
    stage.room.background.copy(stage.room.base);
    stage.room.fog.copy(stage.room.base);
  };

  /** What each aspect does when switched off, so it leaves no trace. */
  const rests: Readonly<
    Record<VisualAspect, (resting: (marble: Marble) => boolean) => void>
  > = {
    marbles: restMarbles,
    bounce: restMarbles,
    halos: restHalos,
    rings: restRings,
    rim: restRim,
    floor: restFloor,
    room: restRoom,
    overlay: () => {},
  };
  /** Which aspects the last frame lit, so a switch-off resets once. */
  const lit: Record<VisualAspect, boolean> = {
    marbles: false,
    bounce: false,
    halos: false,
    rings: false,
    rim: false,
    floor: false,
    room: false,
    overlay: false,
  };

  const apply = (
    frame: BeatFrame,
    cascade: Cascade,
    bands: Float32Array,
    nowMs: number,
    visuals: Visuals,
    resting: (marble: Marble) => boolean,
  ) => {
    for (const aspect of VISUAL_ASPECTS) {
      if (lit[aspect] && !visuals[aspect]) rests[aspect](resting);
      lit[aspect] = visuals[aspect];
    }
    lightMarbles(frame, cascade, nowMs, visuals, resting);
    if (visuals.rings) lightRings(frame, cascade, nowMs);
    if (visuals.rim) lightRim(frame, bands);
    if (visuals.floor) lightFloor(frame, cascade, nowMs);
    if (visuals.room) lightRoom(frame);
  };

  const quiet = (resting: (marble: Marble) => boolean) => {
    for (const aspect of VISUAL_ASPECTS) {
      rests[aspect](resting);
      lit[aspect] = false;
    }
  };

  return { strike, apply, quiet };
};

/** The overlay's share of the show, 0..1, for the `--music` CSS variable. */
export const overlayLevel = (frame: BeatFrame): number => {
  return clamp(frame.punch * 0.85 + frame.bass * 0.4, 0, 1);
};
