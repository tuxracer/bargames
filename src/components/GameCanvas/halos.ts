import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Scene,
} from "three";
import { BOARD_TOP } from "./consts";

export type HaloSet = {
  /** Begin a frame's worth of halos. */
  begin: () => void;
  /** Lay a pool of light at a board point; color and glow set its look. */
  add: (x: number, z: number, color: Color, glow: number) => void;
  /** Commit this frame's halos to the GPU. */
  end: () => void;
  dispose: () => void;
};

const HALO_RADIUS = 1.35;
const HALO_Y = BOARD_TOP + 0.02;

/** Soft radial falloff so the pool has no edge. */
const createHaloTexture = (): CanvasTexture | null => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
};

/**
 * Additive pools of light on the board under glowing marbles: the cheap
 * stand-in for bloom that makes a beat read as light spilling across the
 * table rather than marbles merely getting brighter.
 */
export const createHaloSet = (scene: Scene, capacity: number): HaloSet => {
  const texture = createHaloTexture();
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new InstancedMesh(
    new CircleGeometry(HALO_RADIUS, 24),
    material,
    capacity,
  );
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);

  const placer = new Object3D();
  const tint = new Color();
  let count = 0;

  const begin = () => {
    count = 0;
  };

  const add = (x: number, z: number, color: Color, glow: number) => {
    if (count >= capacity || glow <= 0.01) return;
    placer.position.set(x, HALO_Y, z);
    placer.rotation.set(-Math.PI / 2, 0, 0);
    placer.scale.setScalar(0.6 + Math.min(glow, 2) * 0.7);
    placer.updateMatrix();
    mesh.setMatrixAt(count, placer.matrix);
    tint.copy(color).multiplyScalar(Math.min(glow, 1.5) * 0.9);
    mesh.setColorAt(count, tint);
    count += 1;
  };

  const end = () => {
    mesh.count = count;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    material.dispose();
    texture?.dispose();
  };

  return { begin, add, end, dispose };
};
