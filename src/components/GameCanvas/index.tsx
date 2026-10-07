import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { holeAt, HOLES, ZONE_APEX, ZONES } from "@/lib/board";
import type { HoleIndex, Zone } from "@/lib/board";
import { createBeatDetector } from "@/lib/beat";
import type { BeatDetector } from "@/lib/beat";
import { createCascade } from "@/lib/cascade";
import type { Cascade } from "@/lib/cascade";
import { canStop, hopOptions, stepOptions } from "@/lib/game";
import type { GameState } from "@/lib/game";
import {
  createMotionSample,
  HOP_LIFT,
  LEG_MS,
  RETURN_MS,
  sampleMotion,
} from "@/lib/motion";
import type { Point2 } from "@/lib/motion";
import type { Theme } from "@/lib/theme";
import { smoothstep } from "@/utils/smoothstep";
import { vibrateIfSupported } from "@/utils/vibrateIfSupported";
import {
  BOARD_DISC_RADIUS,
  DRAG_FINGER_OFFSET,
  DRAG_LIFT,
  DRAG_THRESHOLD_PX,
  LAND_HAPTIC_MS,
  PICK_RADIUS,
  SELECT_LIFT,
  SNAP_RADIUS,
  VIEW_SWING_MS,
} from "./consts";
import { createHaloSet } from "./halos";
import type { HaloSet } from "./halos";
import { createListener, isListenerError } from "./listener";
import type { Listener, MusicStatus } from "./listener";
import { createMarbleSet } from "./marbles";
import type { Marble, MarbleSet } from "./marbles";
import { createMarkerSet } from "./markers";
import type { MarkerSet } from "./markers";
import { createPicker } from "./picking";
import type { Picker } from "./picking";
import { createScene } from "./scene";
import type { SceneHandle } from "./scene";

export type { MusicStatus } from "./listener";

type GameCanvasProps = {
  state: GameState;
  /** True when the seat to move is a person at this screen. */
  interactive: boolean;
  /** Ring the holes a lifted marble may go to. Off is for purists. */
  hints: boolean;
  /** How the table is dressed. Changing it rebuilds the scene. */
  theme: Theme;
  /** Which side of the table the camera stands on; S is the default. */
  viewZone: Zone;
  /** Listen through the microphone and light the table to the music. */
  music: boolean;
  onMusicStatus: (status: MusicStatus) => void;
  /** The player stepped a marble into an adjacent hole; the turn ends. */
  onStep: (piece: number, hole: HoleIndex) => void;
  /** The player hopped a marble; the chain stays open if it can. */
  onHop: (piece: number, hole: HoleIndex) => void;
  /** The player set the chain marble down where it is. */
  onStop: () => void;
  /** Fires once the board has finished showing the latest state. */
  onSettled: () => void;
};

/** A marble in the air: along a replayed path, or dropping from a drag. */
type Flight = {
  readonly marble: Marble;
  readonly points: readonly Point2[];
  readonly startMs: number;
  readonly legMs: number;
  readonly lift: number;
  lastLeg: number;
  readonly onDone: (() => void) | null;
};

type Selection = {
  readonly pieceId: number;
  /** Where the marble sits now: the chain's end, or its hole. */
  readonly origin: HoleIndex;
  readonly steps: readonly HoleIndex[];
  readonly hops: readonly HoleIndex[];
  readonly destinations: readonly HoleIndex[];
};

type Press = {
  readonly pointerId: number;
  readonly pieceId: number;
  readonly startX: number;
  readonly startY: number;
  /** Tapping an already-selected marble puts it down (or stops a chain). */
  readonly toggleOff: boolean;
  dragging: boolean;
  dragX: number;
  dragZ: number;
  snap: HoleIndex | null;
};

type Rig = {
  readonly handle: SceneHandle;
  readonly marbles: MarbleSet;
  readonly markers: MarkerSet;
  readonly picker: Picker;
  readonly halos: HaloSet;
  flight: Flight | null;
  selection: Selection | null;
  press: Press | null;
  /** Set when a drag commits so the sync drops from the fingertip. */
  pendingDrop: { pieceId: number; x: number; z: number } | null;
};

/**
 * The ears: they outlive the scene, so switching themes mid-song keeps the
 * microphone open and the beat phase intact.
 */
type Audio = {
  listener: Listener | null;
  detector: BeatDetector | null;
  readonly cascade: Cascade;
  readonly spectrum: Uint8Array<ArrayBuffer>;
  /** Which tip the next off-center wave starts from. */
  beatIndex: number;
  /** A decaying envelope kicked by each beat, for rim and HUD flashes. */
  flash: number;
  /** Whether the last frame applied music; lets a stop clean up once. */
  lit: boolean;
  /** Last value written to the --music CSS variable. */
  cssLevel: number;
};

const HALO_CAPACITY = 60;
const SPECTRUM_BINS = 512;
const FLASH_DECAY = 0.88;
const CSS_LEVEL_STEP = 0.03;
/** Beats this strong start at the center; the rest sweep in from a tip. */
const CENTER_BEAT_STRENGTH = 0.75;

/** The camera stands on a tip's side at the tip's own bearing. */
const zoneAzimuth = (zone: Zone): number => {
  const apex = HOLES[holeAt(ZONE_APEX[zone])];
  return Math.atan2(apex.py, apex.px);
};

/** The shorter way round from one bearing to another. */
const shortestTurn = (from: number, to: number): number => {
  const twoPi = Math.PI * 2;
  return ((((to - from) % twoPi) + twoPi * 1.5) % twoPi) - Math.PI;
};

/** A camera swinging from one side of the table to another. */
type ViewSwing = {
  from: number;
  to: number;
  startMs: number;
  current: number;
};

/** Board-plane origins for waves: the six tips, clockwise from the top. */
const TIP_ORIGINS: readonly Point2[] = ZONES.map((zone) => {
  const apex = HOLES[holeAt(ZONE_APEX[zone])];
  return { x: apex.px, y: apex.py };
});

const DROP_MS = 170;
const DROP_LIFT = 0.15;
const RETURN_LIFT = 0.2;
const BOB_AMOUNT = 0.04;
const BOB_PERIOD_MS = 1_400;

const holePoint = (hole: HoleIndex): Point2 => ({
  x: HOLES[hole].px,
  y: HOLES[hole].py,
});

/**
 * Whether `next` continues `previous` forward (a turn played or a hop
 * added) rather than rewinding it or starting over. Only forward travel is
 * animated; everything else snaps into place.
 */
const isForward = (previous: GameState | null, next: GameState): boolean => {
  if (previous === null || previous.seats !== next.seats) return false;
  if (next.turn > previous.turn) return true;
  if (next.turn < previous.turn) return false;
  const before = previous.chain?.path.length ?? 0;
  const after = next.chain?.path.length ?? 0;
  return after > before;
};

/**
 * The table: a tilted 2.5D view of the board, with the marbles as the only
 * things that move. Drag a marble and let go over a glowing hole, or tap it
 * and tap where it should land. After a hop the marble stays up, ringed by
 * its next hops; tap it to set it down.
 */
export const GameCanvas = ({
  state,
  interactive,
  hints,
  theme,
  viewZone,
  music,
  onMusicStatus,
  onStep,
  onHop,
  onStop,
  onSettled,
}: GameCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const stateRef = useRef(state);
  const previousStateRef = useRef<GameState | null>(null);
  const interactiveRef = useRef(interactive);
  const hintsRef = useRef(hints);
  const onStepRef = useRef(onStep);
  const onHopRef = useRef(onHop);
  const onStopRef = useRef(onStop);
  const onSettledRef = useRef(onSettled);
  const selectRef = useRef<(pieceId: number) => void>(() => {});
  const reselectRef = useRef<() => void>(() => {});
  const onMusicStatusRef = useRef(onMusicStatus);
  const viewRef = useRef<ViewSwing>({
    from: zoneAzimuth("S"),
    to: zoneAzimuth("S"),
    startMs: 0,
    current: zoneAzimuth("S"),
  });
  const audioRef = useRef<Audio>({
    listener: null,
    detector: null,
    cascade: createCascade(),
    spectrum: new Uint8Array(SPECTRUM_BINS),
    beatIndex: 0,
    flash: 0,
    lit: false,
    cssLevel: 0,
  });

  // Event handlers and the frame loop read the latest props through refs,
  // so the scene is built once and never torn down on a re-render.
  useEffect(() => {
    stateRef.current = state;
    interactiveRef.current = interactive;
    hintsRef.current = hints;
    onStepRef.current = onStep;
    onHopRef.current = onHop;
    onStopRef.current = onStop;
    onSettledRef.current = onSettled;
    onMusicStatusRef.current = onMusicStatus;
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handle = createScene(canvas, theme);
    handle.setView(viewRef.current.current);
    const rig: Rig = {
      handle,
      marbles: createMarbleSet(handle.scene, theme),
      markers: createMarkerSet(handle.scene, theme.scene.markerLighten),
      picker: createPicker(canvas, handle.camera),
      halos: createHaloSet(handle.scene, HALO_CAPACITY),
      flight: null,
      selection: null,
      press: null,
      pendingDrop: null,
    };
    rigRef.current = rig;

    const sample = createMotionSample();
    const hit = new Vector3();

    const marbleOf = (pieceId: number) => rig.marbles.byPiece.get(pieceId);

    const clearSelection = () => {
      const selection = rig.selection;
      if (!selection) return;
      rig.selection = null;
      rig.markers.hide();
      const marble = marbleOf(selection.pieceId);
      if (marble) rig.marbles.setGlow(marble, 0);
    };

    const select = (pieceId: number) => {
      clearSelection();
      const current = stateRef.current;
      const inChain = current.chain !== null;
      const steps = inChain ? [] : stepOptions(current, pieceId);
      const hops = hopOptions(current, pieceId);
      rig.selection = {
        pieceId,
        origin: current.pieces[pieceId].hole,
        steps,
        hops,
        destinations: [...steps, ...hops],
      };
      const color = theme.marbles[current.seats[current.current].zone].hex;
      if (hintsRef.current) {
        rig.markers.show(rig.selection.destinations, color);
      }
      const marble = marbleOf(pieceId);
      if (marble) rig.marbles.setGlow(marble, 1);
    };
    selectRef.current = select;
    reselectRef.current = () => {
      if (rig.selection && !rig.press) select(rig.selection.pieceId);
    };

    const startFlight = (
      marble: Marble,
      points: readonly Point2[],
      legMs: number,
      lift: number,
      onDone: (() => void) | null,
    ) => {
      rig.flight = {
        marble,
        points,
        startMs: performance.now(),
        legMs,
        lift,
        lastLeg: 0,
        onDone,
      };
    };

    /** Send the selected marble to a ringed hole. */
    const commit = (hole: HoleIndex) => {
      const selection = rig.selection;
      if (!selection) return;
      const isStep = selection.steps.includes(hole);
      clearSelection();
      if (isStep) onStepRef.current(selection.pieceId, hole);
      else onHopRef.current(selection.pieceId, hole);
    };

    /** Tapping the marble itself: put it down, or stop its chain. */
    const settle = () => {
      const current = stateRef.current;
      if (current.chain === null) {
        clearSelection();
        return;
      }
      if (canStop(current)) {
        clearSelection();
        onStopRef.current();
      }
    };

    const returnHome = (press: Press) => {
      const marble = marbleOf(press.pieceId);
      const selection = rig.selection;
      if (!marble || !selection) return;
      startFlight(
        marble,
        [{ x: press.dragX, y: press.dragZ }, holePoint(selection.origin)],
        RETURN_MS,
        RETURN_LIFT,
        null,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || !interactiveRef.current || rig.flight) return;
      if (!rig.picker.pointToBoard(event.clientX, event.clientY, hit)) return;
      const current = stateRef.current;
      const hole = rig.picker.nearestHole(hit.x, hit.z, PICK_RADIUS);
      const chain = current.chain;

      if (hole !== -1 && current.occupancy[hole] === current.current) {
        const piece = current.pieces.find(
          (candidate) => candidate.hole === hole,
        );
        if (!piece) return;
        // Mid-chain only the chain's marble is in play.
        if (chain && chain.piece !== piece.id) return;
        const toggleOff = rig.selection?.pieceId === piece.id;
        if (!toggleOff) select(piece.id);
        rig.press = {
          pointerId: event.pointerId,
          pieceId: piece.id,
          startX: event.clientX,
          startY: event.clientY,
          toggleOff,
          dragging: false,
          dragX: HOLES[hole].px,
          dragZ: HOLES[hole].py,
          snap: null,
        };
        // Keep the drag even when the finger slides off the canvas. A
        // synthetic event has no live pointer to capture; that is fine.
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Nothing to capture.
        }
        return;
      }

      const selection = rig.selection;
      if (!selection) return;
      if (hole !== -1 && selection.destinations.includes(hole)) {
        commit(hole);
        return;
      }
      // A stray tap puts a free marble down; a chain marble stays in play.
      if (chain === null) clearSelection();
    };

    const onPointerMove = (event: PointerEvent) => {
      const press = rig.press;
      if (!press || event.pointerId !== press.pointerId) return;
      if (!press.dragging) {
        const travel = Math.hypot(
          event.clientX - press.startX,
          event.clientY - press.startY,
        );
        if (travel < DRAG_THRESHOLD_PX) return;
        press.dragging = true;
      }
      if (!rig.picker.pointToBoard(event.clientX, event.clientY, hit)) return;
      // A fingertip hides what is under it, so a touch-dragged marble rides
      // ahead of the finger. A mouse cursor hides nothing: drop it dead on.
      const ahead = event.pointerType === "touch" ? DRAG_FINGER_OFFSET : 0;
      // "Ahead" is away from whoever is holding the marble: the direction
      // the camera looks along the board.
      const camera = handle.camera.position;
      const stance = Math.hypot(camera.x, camera.z) || 1;
      let x = hit.x - (camera.x / stance) * ahead;
      let z = hit.z - (camera.z / stance) * ahead;
      const reach = Math.hypot(x, z);
      if (reach > BOARD_DISC_RADIUS) {
        x *= BOARD_DISC_RADIUS / reach;
        z *= BOARD_DISC_RADIUS / reach;
      }
      press.dragX = x;
      press.dragZ = z;
      const marble = marbleOf(press.pieceId);
      if (marble) rig.marbles.place(marble, x, z, DRAG_LIFT);
      const selection = rig.selection;
      const snap = selection
        ? rig.picker.nearestOf(selection.destinations, x, z, SNAP_RADIUS)
        : null;
      if (snap !== press.snap) {
        press.snap = snap;
        rig.markers.setTarget(snap);
      }
    };

    const finishPress = (event: PointerEvent, cancelled: boolean) => {
      const press = rig.press;
      if (!press || event.pointerId !== press.pointerId) return;
      rig.press = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (!press.dragging) {
        if (press.toggleOff) settle();
        return;
      }
      rig.markers.setTarget(null);
      if (!cancelled && press.snap !== null && rig.selection) {
        rig.pendingDrop = {
          pieceId: press.pieceId,
          x: press.dragX,
          z: press.dragZ,
        };
        commit(press.snap);
        return;
      }
      returnHome(press);
    };
    const onPointerUp = (event: PointerEvent) => finishPress(event, false);
    const onPointerCancel = (event: PointerEvent) => finishPress(event, true);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      handle.resize(width, height);
      rig.picker.measure();
    });
    observer.observe(container);
    handle.resize(container.clientWidth, container.clientHeight);

    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const flight = rig.flight;
      if (flight) {
        sampleMotion(
          flight.points,
          now - flight.startMs,
          sample,
          flight.legMs,
          flight.lift,
        );
        rig.marbles.place(flight.marble, sample.x, sample.y, sample.lift);
        if (sample.leg !== flight.lastLeg) {
          flight.lastLeg = sample.leg;
          vibrateIfSupported(LAND_HAPTIC_MS);
        }
        if (sample.done) {
          rig.flight = null;
          flight.onDone?.();
        }
      }
      const selection = rig.selection;
      if (selection && !rig.press?.dragging) {
        const marble = marbleOf(selection.pieceId);
        if (marble && rig.flight?.marble !== marble) {
          const bob =
            BOB_AMOUNT * Math.sin((now / BOB_PERIOD_MS) * Math.PI * 2);
          const spot = HOLES[selection.origin];
          rig.marbles.place(marble, spot.px, spot.py, SELECT_LIFT + bob);
        }
      }
      swingView(now);
      rig.markers.pulse(now);
      playMusic(now);
      handle.renderer.render(handle.scene, handle.camera);
    };

    /** Ease the camera toward the side it has been asked to stand on. */
    const swingView = (now: number) => {
      const view = viewRef.current;
      if (view.current === view.to) return;
      const t = (now - view.startMs) / VIEW_SWING_MS;
      if (t >= 1) {
        view.current = view.to;
      } else {
        view.current =
          view.from + shortestTurn(view.from, view.to) * smoothstep(t);
      }
      handle.setView(view.current);
      rig.picker.measure();
    };

    /** Read the microphone and light the table for this frame. */
    const playMusic = (now: number) => {
      const audio = audioRef.current;
      const { listener, detector, cascade } = audio;
      const heard =
        listener !== null &&
        detector !== null &&
        listener.sample(audio.spectrum);
      if (!heard) {
        if (audio.lit) quietMusic();
        return;
      }
      audio.lit = true;
      const frame = detector.update(audio.spectrum, now);
      if (frame.beat) {
        const strength = 0.55 + 0.7 * frame.strength;
        if (frame.strength >= CENTER_BEAT_STRENGTH) {
          cascade.trigger(0, 0, strength, now);
        } else {
          const origin = TIP_ORIGINS[audio.beatIndex % TIP_ORIGINS.length];
          cascade.trigger(origin.x, origin.y, strength, now);
          audio.beatIndex += 1;
        }
        audio.flash = Math.max(audio.flash, frame.strength);
      }
      audio.flash *= FLASH_DECAY;
      cascade.prune(now);

      const look = theme.music;
      rig.halos.begin();
      for (const marble of rig.marbles.byPiece.values()) {
        const position = marble.mesh.position;
        const glow = cascade.glowAt(position.x, position.z, now);
        rig.marbles.setMusic(marble, glow);
        rig.halos.add(
          position.x,
          position.z,
          marble.mesh.material.color,
          glow * look.halo,
        );
      }
      rig.halos.end();

      const bass = frame.bass + audio.flash * 0.5;
      const { pulse } = handle;
      pulse.rim.emissiveIntensity = pulse.rimIntensity + bass * look.rimPulse;
      pulse.table.emissiveIntensity =
        pulse.tableIntensity + bass * look.gridPulse;
      pulse.key.intensity = pulse.keyIntensity * (1 + bass * look.keyPulse);

      const level = Math.min(1, audio.flash + frame.bass * 0.4);
      if (Math.abs(level - audio.cssLevel) > CSS_LEVEL_STEP) {
        audio.cssLevel = level;
        document.documentElement.style.setProperty("--music", level.toFixed(2));
      }
    };

    /** Put everything music touched back the way the theme left it. */
    const quietMusic = () => {
      const audio = audioRef.current;
      audio.lit = false;
      audio.flash = 0;
      for (const marble of rig.marbles.byPiece.values()) {
        rig.marbles.setMusic(marble, 0);
      }
      rig.halos.begin();
      rig.halos.end();
      const { pulse } = handle;
      pulse.rim.emissiveIntensity = pulse.rimIntensity;
      pulse.table.emissiveIntensity = pulse.tableIntensity;
      pulse.key.intensity = pulse.keyIntensity;
      audio.cssLevel = 0;
      document.documentElement.style.setProperty("--music", "0");
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      rig.marbles.dispose();
      rig.markers.dispose();
      rig.halos.dispose();
      handle.dispose();
      rigRef.current = null;
      previousStateRef.current = null;
    };
  }, [theme]);

  // Bring the table in line with the game: new marbles appear at rest, the
  // marble that just traveled flies the legs it has not yet shown, and
  // anything else (an undo, a new game) simply snaps into place. A chain
  // left open for a person is picked straight back up.
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const previous = previousStateRef.current;
    previousStateRef.current = state;
    rig.flight = null;
    rig.press = null;
    rig.selection = null;
    rig.markers.hide();
    rig.marbles.sync(state);
    for (const marble of rig.marbles.byPiece.values()) {
      rig.marbles.setGlow(marble, 0);
    }

    const drop = rig.pendingDrop;
    rig.pendingDrop = null;
    const forward = isForward(previous, state);
    const settled = () => {
      if (stateRef.current !== state) return;
      const chain = state.chain;
      if (chain && interactive) selectRef.current(chain.piece);
      onSettledRef.current();
    };

    let animated = false;
    for (const piece of state.pieces) {
      const marble = rig.marbles.byPiece.get(piece.id);
      if (!marble || marble.hole === piece.hole) continue;
      const lastMove = state.lastMove;
      const shown = lastMove ? lastMove.path.indexOf(marble.hole) : -1;
      if (forward && lastMove && lastMove.piece === piece.id && shown >= 0) {
        const land = () => {
          marble.hole = piece.hole;
          rig.marbles.rest(marble, piece.hole);
          vibrateIfSupported(LAND_HAPTIC_MS);
          settled();
        };
        const fromDrag = drop && drop.pieceId === piece.id;
        const points = fromDrag
          ? [{ x: drop.x, y: drop.z }, holePoint(piece.hole)]
          : lastMove.path.slice(shown).map(holePoint);
        rig.flight = {
          marble,
          points,
          startMs: performance.now(),
          legMs: fromDrag ? DROP_MS : LEG_MS,
          lift: fromDrag ? DROP_LIFT : HOP_LIFT,
          lastLeg: 0,
          onDone: land,
        };
        animated = true;
      } else {
        rig.marbles.rest(marble, piece.hole);
      }
    }
    if (!animated) settled();
  }, [state, interactive, theme]);

  // Open or close the microphone as the option flips. The listener lives
  // outside the scene so a theme change mid-song does not drop the beat.
  useEffect(() => {
    const audio = audioRef.current;
    if (!music) {
      audio.listener?.stop();
      audio.listener = null;
      audio.detector = null;
      onMusicStatusRef.current("off");
      return;
    }
    let cancelled = false;
    const listener = createListener();
    audio.listener = listener;
    onMusicStatusRef.current("starting");
    listener
      .start()
      .then(() => {
        if (cancelled) return;
        audio.detector = createBeatDetector(
          listener.sampleRate(),
          listener.fftSize,
        );
        audio.beatIndex = 0;
        onMusicStatusRef.current("listening");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        audio.listener = null;
        onMusicStatusRef.current(
          isListenerError(error) && error.code === "UNSUPPORTED"
            ? "unsupported"
            : "denied",
        );
      });
    return () => {
      cancelled = true;
      listener.stop();
      if (audio.listener === listener) {
        audio.listener = null;
        audio.detector = null;
      }
    };
  }, [music]);

  // A new side to stand on: start the swing from wherever the camera is.
  useEffect(() => {
    const view = viewRef.current;
    const to = zoneAzimuth(viewZone);
    if (to === view.to) return;
    view.from = view.current;
    view.to = to;
    view.startMs = performance.now();
  }, [viewZone]);

  // Flipping the hints option mid-selection redraws (or clears) the rings.
  useEffect(() => {
    reselectRef.current();
  }, [hints]);

  return (
    <div ref={containerRef} className="game-canvas">
      <canvas ref={canvasRef} />
    </div>
  );
};
