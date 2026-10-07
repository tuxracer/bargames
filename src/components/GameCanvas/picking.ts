import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Camera } from "three";
import { HOLES } from "@/lib/board";
import { MARBLE_REST_Y } from "./consts";

export type Picker = {
  /** Where a pointer (client px) hits the marble plane; false if it misses. */
  pointToBoard: (clientX: number, clientY: number, out: Vector3) => boolean;
  /** The closest hole to a board-plane point, or -1 if none is in range. */
  nearestHole: (x: number, z: number, radius: number) => number;
  /** Closest of `candidates` to a board point within `radius`, or null. */
  nearestOf: (
    candidates: readonly number[],
    x: number,
    z: number,
    radius: number,
  ) => number | null;
  /** Re-measure the canvas after layout changes. */
  measure: () => void;
};

export const createPicker = (
  canvas: HTMLCanvasElement,
  camera: Camera,
): Picker => {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  // Pick at marble height, not the board top: with the camera tilted, a tap
  // on a marble's visible center would otherwise land beyond its hole.
  const plane = new Plane(new Vector3(0, 1, 0), -MARBLE_REST_Y);
  let rect = canvas.getBoundingClientRect();

  const measure = () => {
    rect = canvas.getBoundingClientRect();
  };

  const pointToBoard = (clientX: number, clientY: number, out: Vector3) => {
    ndc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(plane, out) !== null;
  };

  const nearestHole = (x: number, z: number, radius: number) => {
    let best = -1;
    let bestDistance = radius * radius;
    for (const hole of HOLES) {
      const dx = hole.px - x;
      const dz = hole.py - z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = hole.index;
      }
    }
    return best;
  };

  const nearestOf = (
    candidates: readonly number[],
    x: number,
    z: number,
    radius: number,
  ) => {
    let best: number | null = null;
    let bestDistance = radius * radius;
    for (const index of candidates) {
      const hole = HOLES[index];
      const dx = hole.px - x;
      const dz = hole.py - z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }
    return best;
  };

  return { pointToBoard, nearestHole, nearestOf, measure };
};
