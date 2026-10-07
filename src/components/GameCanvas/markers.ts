import {
  Color,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  Scene,
} from "three";
import { HOLE_COUNT, HOLES } from "@/lib/board";
import { BOARD_TOP } from "./consts";

export type MarkerSet = {
  /** Show one ring per legal landing hole, in the mover's color. */
  show: (holes: readonly number[], color: number) => void;
  hide: () => void;
  /** Highlight the hole a dragged marble would snap into, or none. */
  setTarget: (hole: number | null) => void;
  /** Breathe the rings; call once per frame. */
  pulse: (nowMs: number) => void;
  dispose: () => void;
};

const RING_INNER = 0.37;
const RING_OUTER = 0.45;
const TARGET_INNER = 0.47;
const TARGET_OUTER = 0.6;
const PULSE_PERIOD_MS = 1_100;
const PULSE_AMOUNT = 0.07;
const MARKER_Y = BOARD_TOP + 0.012;

export const createMarkerSet = (scene: Scene, lighten: number): MarkerSet => {
  const ringMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    toneMapped: false,
  });
  const rings = new InstancedMesh(
    new RingGeometry(RING_INNER, RING_OUTER, 36),
    ringMaterial,
    HOLE_COUNT,
  );
  rings.count = 0;
  rings.frustumCulled = false;
  scene.add(rings);

  const targetMaterial = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  });
  const target = new Mesh(
    new RingGeometry(TARGET_INNER, TARGET_OUTER, 48),
    targetMaterial,
  );
  target.rotation.x = -Math.PI / 2;
  target.position.y = MARKER_Y + 0.004;
  target.visible = false;
  scene.add(target);

  const placer = new Object3D();
  const lightened = new Color();
  let shown: readonly number[] = [];

  const layout = (scale: number) => {
    for (let i = 0; i < shown.length; i += 1) {
      const hole = HOLES[shown[i]];
      placer.position.set(hole.px, MARKER_Y, hole.py);
      placer.rotation.set(-Math.PI / 2, 0, 0);
      placer.scale.setScalar(scale);
      placer.updateMatrix();
      rings.setMatrixAt(i, placer.matrix);
    }
    rings.instanceMatrix.needsUpdate = true;
  };

  const show = (holes: readonly number[], color: number) => {
    shown = holes;
    rings.count = holes.length;
    lightened.setHex(color).lerp(new Color(0xffffff), lighten);
    ringMaterial.color.copy(lightened);
    targetMaterial.color.copy(lightened);
    layout(1);
  };

  const hide = () => {
    shown = [];
    rings.count = 0;
    target.visible = false;
  };

  const setTarget = (hole: number | null) => {
    if (hole === null) {
      target.visible = false;
      return;
    }
    const spot = HOLES[hole];
    target.position.x = spot.px;
    target.position.z = spot.py;
    target.visible = true;
  };

  const pulse = (nowMs: number) => {
    if (shown.length === 0) return;
    const phase = (nowMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    const scale = 1 + PULSE_AMOUNT * Math.sin(phase * Math.PI * 2);
    layout(scale);
    ringMaterial.opacity = 0.7 + 0.2 * Math.sin(phase * Math.PI * 2);
  };

  const dispose = () => {
    scene.remove(rings, target);
    rings.geometry.dispose();
    ringMaterial.dispose();
    target.geometry.dispose();
    targetMaterial.dispose();
  };

  return { show, hide, setTarget, pulse, dispose };
};
