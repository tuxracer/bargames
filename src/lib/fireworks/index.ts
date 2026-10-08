import {
  APEX_MIN,
  APEX_RANGE,
  BURST_FLOOR,
  BURST_SPARKS,
  BURST_SPEED,
  CRACKLE_DEPTH,
  CRACKLE_HZ,
  DEFAULT_LOOK,
  DRIFT,
  GRAVITY,
  HEAD_LIFE_MS,
  HEAD_SIZE,
  KIND_WEIGHTS,
  RISE_MS,
  RISE_RANGE_MS,
  SHELL_CAPACITY,
  SPARK_CAPACITY,
  SPARK_DRAG,
  SPARK_LIFE_MS,
  SPARK_LIFE_SPREAD,
  SPARK_SIZE,
  SPARK_SIZE_SPREAD,
  TRAIL_EVERY_MS,
  TRAIL_LIFE_MS,
  TRAIL_SCATTER,
  TRAIL_SIZE,
  WILLOW_GRAVITY,
} from "./consts";
import type {
  BurstKind,
  Fireworks,
  FireworksOptions,
  Flash,
  Shell,
  Shot,
} from "./types";

export * from "./consts";
export * from "./types";

/** Sparks that flicker: crackle bursts. */
const FLAG_FLICKER = 1;
/** Sparks that hang before they fall: willow bursts. */
const FLAG_HANG = 2;
/** Sparks that never show their own color, only white: trails. */
const FLAG_EMBER = 4;
/** The shell's own head: hot, but still its color. */
const FLAG_HEAD = 8;
const HEAD_HEAT = 0.6;

/** A rocket decelerates as it climbs: fast off the board, slow at the top. */
const climb = (t: number): number => 1 - (1 - t) * (1 - t);

/** Pick a burst kind by weight. */
const drawKind = (random: () => number): BurstKind => {
  let roll = random();
  for (const [kind, weight] of KIND_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return KIND_WEIGHTS[KIND_WEIGHTS.length - 1][0];
};

/**
 * A pool of rising shells and burning sparks, in board units (hole
 * spacings, with y up from the board top) and milliseconds. Pure
 * arithmetic over preallocated arrays: nothing is allocated after setup,
 * so a renderer can call `update` every frame and read the buffers
 * straight into the GPU.
 */
export const createFireworks = (options: FireworksOptions = {}): Fireworks => {
  const capacity = options.capacity ?? SPARK_CAPACITY;
  const shellCapacity = options.shellCapacity ?? SHELL_CAPACITY;
  const look = options.look ?? DEFAULT_LOOK;
  const random = options.random ?? Math.random;

  // Sparks, struct of arrays, compacted so the live ones are [0, count).
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity);
  const velocity = new Float32Array(capacity * 3);
  const base = new Float32Array(capacity * 3);
  const born = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const drag = new Float32Array(capacity);
  const fullSize = new Float32Array(capacity);
  const phase = new Float32Array(capacity);
  const flags = new Uint8Array(capacity);
  let count = 0;

  const shells: Shell[] = [];
  for (let i = 0; i < shellCapacity; i += 1) {
    shells.push({
      active: false,
      x: 0,
      z: 0,
      apexY: 0,
      driftX: 0,
      driftZ: 0,
      startMs: 0,
      riseMs: RISE_MS,
      r: 1,
      g: 1,
      b: 1,
      strength: 0,
      kind: "peony",
      trailMs: 0,
    });
  }

  const flash: Flash = {
    x: 0,
    y: 0,
    z: 0,
    r: 1,
    g: 1,
    b: 1,
    startMs: -Infinity,
    strength: 0,
  };

  let lastMs = -Infinity;

  const spawn = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    r: number,
    g: number,
    b: number,
    size: number,
    lifeMs: number,
    dragPerS: number,
    flag: number,
    nowMs: number,
  ) => {
    if (count >= capacity) return;
    const at = count * 3;
    positions[at] = x;
    positions[at + 1] = y;
    positions[at + 2] = z;
    velocity[at] = vx;
    velocity[at + 1] = vy;
    velocity[at + 2] = vz;
    base[at] = r;
    base[at + 1] = g;
    base[at + 2] = b;
    born[count] = nowMs;
    life[count] = lifeMs;
    drag[count] = dragPerS;
    fullSize[count] = size;
    phase[count] = random() * Math.PI * 2;
    flags[count] = flag;
    count += 1;
  };

  /** Move the last live spark into slot `i`, retiring `i`. */
  const retire = (i: number) => {
    count -= 1;
    if (i === count) return;
    const from = count * 3;
    const to = i * 3;
    positions[to] = positions[from];
    positions[to + 1] = positions[from + 1];
    positions[to + 2] = positions[from + 2];
    velocity[to] = velocity[from];
    velocity[to + 1] = velocity[from + 1];
    velocity[to + 2] = velocity[from + 2];
    base[to] = base[from];
    base[to + 1] = base[from + 1];
    base[to + 2] = base[from + 2];
    born[i] = born[count];
    life[i] = life[count];
    drag[i] = drag[count];
    fullSize[i] = fullSize[count];
    phase[i] = phase[count];
    flags[i] = flags[count];
  };

  const burst = (shell: Shell, nowMs: number) => {
    const kind = shell.kind;
    const x = shell.x + shell.driftX;
    const y = shell.apexY;
    const z = shell.z + shell.driftZ;
    const scale = BURST_FLOOR + (1 - BURST_FLOOR) * shell.strength;
    const sparks = Math.round(BURST_SPARKS[kind] * scale);
    const speed = BURST_SPEED[kind] * (0.7 + 0.3 * shell.strength);
    const lifeMs = SPARK_LIFE_MS[kind];
    const dragPerS = SPARK_DRAG[kind];
    const flag =
      kind === "crackle" ? FLAG_FLICKER : kind === "willow" ? FLAG_HANG : 0;
    // A ring bursts in one plane, tilted at random so no two look alike.
    const tiltA = random() * Math.PI;
    const tiltB = random() * Math.PI;
    const cosA = Math.cos(tiltA);
    const sinA = Math.sin(tiltA);
    const cosB = Math.cos(tiltB);
    const sinB = Math.sin(tiltB);
    for (let i = 0; i < sparks; i += 1) {
      let dx: number;
      let dy: number;
      let dz: number;
      let pace: number;
      if (kind === "ring") {
        const angle = (i / sparks) * Math.PI * 2;
        const px = Math.cos(angle);
        const py = Math.sin(angle);
        // Rotate the flat circle about x, then about y.
        dx = px * cosB + py * sinA * sinB;
        dy = py * cosA;
        dz = -px * sinB + py * sinA * cosB;
        pace = speed * (0.92 + 0.08 * random());
      } else {
        // Uniform over the sphere: a random height and bearing.
        dy = random() * 2 - 1;
        const ring = Math.sqrt(1 - dy * dy);
        const bearing = random() * Math.PI * 2;
        dx = Math.cos(bearing) * ring;
        dz = Math.sin(bearing) * ring;
        // Fill the sphere rather than just its skin.
        pace = speed * (0.35 + 0.65 * Math.cbrt(random()));
      }
      spawn(
        x,
        y,
        z,
        dx * pace,
        dy * pace,
        dz * pace,
        shell.r,
        shell.g,
        shell.b,
        SPARK_SIZE * (1 - SPARK_SIZE_SPREAD * random()),
        lifeMs * (1 - SPARK_LIFE_SPREAD * random()),
        dragPerS,
        flag,
        nowMs,
      );
    }
    flash.x = x;
    flash.y = y;
    flash.z = z;
    flash.r = shell.r;
    flash.g = shell.g;
    flash.b = shell.b;
    flash.startMs = nowMs;
    flash.strength = scale;
    shell.active = false;
  };

  const riseShells = (nowMs: number) => {
    for (const shell of shells) {
      if (!shell.active) continue;
      const t = (nowMs - shell.startMs) / shell.riseMs;
      if (t >= 1) {
        burst(shell, nowMs);
        continue;
      }
      const height = climb(t);
      const x = shell.x + shell.driftX * height;
      const y = shell.apexY * height;
      const z = shell.z + shell.driftZ * height;
      // The head: a bright point redrawn every frame while it climbs.
      spawn(
        x,
        y,
        z,
        0,
        0,
        0,
        shell.r,
        shell.g,
        shell.b,
        HEAD_SIZE,
        HEAD_LIFE_MS,
        0,
        FLAG_HEAD,
        nowMs,
      );
      // Embers shed behind it, falling away as the rocket leaves them.
      while (shell.trailMs + TRAIL_EVERY_MS <= nowMs) {
        shell.trailMs += TRAIL_EVERY_MS;
        spawn(
          x,
          y,
          z,
          (random() - 0.5) * TRAIL_SCATTER,
          -random() * TRAIL_SCATTER,
          (random() - 0.5) * TRAIL_SCATTER,
          shell.r,
          shell.g,
          shell.b,
          TRAIL_SIZE * (0.6 + 0.4 * random()),
          TRAIL_LIFE_MS * (0.5 + 0.5 * random()),
          2,
          FLAG_EMBER,
          nowMs,
        );
      }
    }
  };

  const moveSparks = (nowMs: number, dtS: number) => {
    const [emberR, emberG, emberB] = look.ember;
    let i = 0;
    while (i < count) {
      const age = nowMs - born[i];
      const span = life[i];
      if (age >= span) {
        retire(i);
        continue;
      }
      const at = i * 3;
      const flag = flags[i];
      const t = age / span;
      // Motion: drag bleeds off the burst speed, gravity takes over.
      const slow = Math.exp(-drag[i] * dtS);
      let pull = GRAVITY;
      if (flag & FLAG_HANG) pull *= WILLOW_GRAVITY + (1 - WILLOW_GRAVITY) * t;
      velocity[at] *= slow;
      velocity[at + 1] = velocity[at + 1] * slow - pull * dtS;
      velocity[at + 2] *= slow;
      positions[at] += velocity[at] * dtS;
      positions[at + 1] += velocity[at + 1] * dtS;
      positions[at + 2] += velocity[at + 2] * dtS;
      // Color: white-hot at first, then its own color, then a dying ember.
      let r = base[at];
      let g = base[at + 1];
      let b = base[at + 2];
      let hot = Math.max(0, 1 - t * 6) * look.whiten;
      if (flag & FLAG_EMBER) hot = 1;
      else if (flag & FLAG_HEAD) hot = HEAD_HEAT;
      r += (1 - r) * hot;
      g += (1 - g) * hot;
      b += (1 - b) * hot;
      const dying = Math.max(0, (t - 0.55) / 0.45);
      r += (emberR - r) * dying * 0.7;
      g += (emberG - g) * dying * 0.7;
      b += (emberB - b) * dying * 0.7;
      let bright = 1 - dying * dying;
      if (flag & FLAG_FLICKER) {
        const flicker = Math.sin(
          (age / 1_000) * CRACKLE_HZ * Math.PI * 2 + phase[i],
        );
        bright *=
          1 - CRACKLE_DEPTH * (0.5 + 0.5 * flicker) * Math.min(1, t * 3);
      }
      colors[at] = r * bright;
      colors[at + 1] = g * bright;
      colors[at + 2] = b * bright;
      sizes[i] = fullSize[i] * (1 - 0.4 * t);
      i += 1;
    }
  };

  const launch = (shot: Shot, nowMs: number) => {
    const shell = shells.find((candidate) => !candidate.active);
    if (!shell) return false;
    const punch = Math.min(1, Math.max(0, shot.strength));
    shell.active = true;
    shell.x = shot.x;
    shell.z = shot.z;
    shell.apexY = APEX_MIN + APEX_RANGE * (0.3 * random() + 0.7 * punch);
    shell.driftX = (shot.aimX ?? shot.x) - shot.x + (random() - 0.5) * DRIFT;
    shell.driftZ = (shot.aimZ ?? shot.z) - shot.z + (random() - 0.5) * DRIFT;
    shell.startMs = nowMs;
    shell.riseMs = shot.riseMs ?? RISE_MS + RISE_RANGE_MS * punch;
    shell.r = shot.color[0];
    shell.g = shot.color[1];
    shell.b = shot.color[2];
    shell.strength = punch;
    shell.kind = shot.kind ?? drawKind(random);
    shell.trailMs = nowMs;
    return true;
  };

  const update = (nowMs: number) => {
    const dtS =
      lastMs === -Infinity ? 0 : Math.min(0.05, (nowMs - lastMs) / 1_000);
    lastMs = nowMs;
    riseShells(nowMs);
    moveSparks(nowMs, dtS);
  };

  const clear = () => {
    count = 0;
    for (const shell of shells) shell.active = false;
    flash.strength = 0;
    flash.startMs = -Infinity;
    lastMs = -Infinity;
  };

  return {
    launch,
    update,
    clear,
    positions,
    colors,
    sizes,
    count: () => count,
    shells: () => shells.filter((shell) => shell.active).length,
    flash,
  };
};
