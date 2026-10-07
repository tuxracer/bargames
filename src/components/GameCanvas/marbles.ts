import {
  Color,
  Mesh,
  MeshPhysicalMaterial,
  Scene,
  SphereGeometry,
} from "three";
import { HOLES } from "@/lib/board";
import type { GameState, Piece } from "@/lib/game";
import { MARBLE_LOOKS } from "@/lib/palette";
import { MARBLE_RADIUS, MARBLE_REST_Y } from "./consts";

export type Marble = {
  readonly mesh: Mesh<SphereGeometry, MeshPhysicalMaterial>;
  /** The hole the mesh currently depicts the marble as resting in. */
  hole: number;
};

export type MarbleSet = {
  readonly byPiece: Map<number, Marble>;
  /** Create or recycle meshes so there is one marble per piece. */
  sync: (state: GameState) => void;
  /** Park a marble in its hole, flat on the board. */
  rest: (marble: Marble, hole: number) => void;
  /** Put a marble at a board-plane point, raised by `lift`. */
  place: (marble: Marble, x: number, z: number, lift: number) => void;
  setGlow: (marble: Marble, amount: number) => void;
  dispose: () => void;
};

const SELECT_GLOW = 0.35;

export const createMarbleSet = (scene: Scene): MarbleSet => {
  const geometry = new SphereGeometry(MARBLE_RADIUS, 40, 28);
  const byPiece = new Map<number, Marble>();
  const glow = new Color();

  const make = (state: GameState, piece: Piece): Marble => {
    const look = MARBLE_LOOKS[state.seats[piece.seat].zone];
    const material = new MeshPhysicalMaterial({
      color: look.hex,
      roughness: look.roughness,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.1,
    });
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    scene.add(mesh);
    return { mesh, hole: -1 };
  };

  const remove = (marble: Marble) => {
    scene.remove(marble.mesh);
    marble.mesh.material.dispose();
  };

  const place = (marble: Marble, x: number, z: number, lift: number) => {
    marble.mesh.position.set(x, MARBLE_REST_Y + lift, z);
  };

  const rest = (marble: Marble, hole: number) => {
    const spot = HOLES[hole];
    place(marble, spot.px, spot.py, 0);
    marble.hole = hole;
  };

  const setGlow = (marble: Marble, amount: number) => {
    glow.copy(marble.mesh.material.color).multiplyScalar(amount * SELECT_GLOW);
    marble.mesh.material.emissive.copy(glow);
  };

  const sync = (state: GameState) => {
    const seen = new Set<number>();
    for (const piece of state.pieces) {
      seen.add(piece.id);
      const existing = byPiece.get(piece.id);
      const look = MARBLE_LOOKS[state.seats[piece.seat].zone];
      if (existing && existing.mesh.material.color.getHex() === look.hex) {
        continue;
      }
      if (existing) remove(existing);
      const marble = make(state, piece);
      rest(marble, piece.hole);
      byPiece.set(piece.id, marble);
    }
    for (const [id, marble] of byPiece) {
      if (!seen.has(id)) {
        remove(marble);
        byPiece.delete(id);
      }
    }
  };

  const dispose = () => {
    for (const marble of byPiece.values()) remove(marble);
    byPiece.clear();
    geometry.dispose();
  };

  return { byPiece, sync, rest, place, setGlow, dispose };
};
