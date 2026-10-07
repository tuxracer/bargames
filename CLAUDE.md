# neongames

Board games for a bar table, played in the browser. Designed for phones and touch screens first (portrait, one thumb, drag and drop); it also works on desktop with a mouse. Built with Vite + React + TypeScript, rendered with three.js, shipped as a static build, hosted on Vercel. The first and so far only game is **Chinese Checkers**; the repo is laid out so more table games can join it.

- **Touch first.** Every interaction must work as a drag with a fingertip: pick a marble up, see where it may go, drop it. Tap-then-tap is the fallback for the same move, never a different one. Hit targets are generous; a snap radius forgives a sloppy drop.
- **The table is the star.** The rendering budget goes to the board and the pieces: real shadows, glass marbles, a wooden board that reads as wood. HTML overlays stay minimal (setup card, turn banner, two buttons).
- **Rules live outside the renderer.** Game logic is plain TypeScript in `src/lib`, independent of three.js and React, and unit tested. The canvas only shows state and reports intent.
- **No timers, scores, lives, ads, or currencies.** A game of Chinese Checkers ends when a tip is full. Undo is free.

## Architecture

Client-only **Vite + React + TypeScript** app with **no backend or server runtime** (the build is a static `dist/` deployed to Vercel). three.js owns the full-screen canvas and the render loop; React is a thin shell around it for HTML overlay UI. Game logic lives in plain TypeScript modules that are independent of rendering so they can be unit tested.

- **`index.html` + `src/main.tsx`**: Vite entry, mounts `<App />` under `StrictMode`, injects Vercel analytics, imports the self-hosted fonts (Fontsource packages for Fraunces and Chakra Petch) and `src/globals.css`.
- **`src/App.tsx`**: owns the match (a `useReducer` over `matchReducer`), forwards the table's step/hop/stop intents, runs the computer's turns, and composes the canvas with the overlays.
- **`src/components/GameCanvas/`**: the three.js table. `index.tsx` builds the scene once in an effect (full cleanup; StrictMode double-invokes effects in dev, so setup is idempotent), handles pointer events, runs the animation loop, and syncs marbles to game state. `scene.ts` (renderer, camera, lights, felt, board, holes, viewport fit), `marbles.ts` (one mesh per piece), `markers.ts` (legal-move rings and the snap target), `picking.ts` (pointer to board plane to nearest hole), `woodTexture.ts` (procedural canvas textures). Props are read through refs so the scene never rebuilds on re-render.
- **Pass-and-play view** (`facePlayer` option): `App` derives `viewZone` (the human to move, or the last human who moved during the computer's turns) and the canvas swings the camera to that tip's side over `VIEW_SWING_MS`. The board never rotates on screen: `createScene` sets the camera's up vector to board-north (`0, 0, -1`) instead of the sky, so the S tip stays at the bottom from every side and only the perspective tilts, as a real board looks from different chairs. `setView` refits the board after each move of the camera. The HUD flips 180° (`.hud-flipped`) for far-side seats (N, NE, NW) so the words read from where that player stands. Drag's ahead-of-the-finger offset is camera-relative. Do not implement this as a board rotation; the user rejected that as disorienting.
- **Music reaction** (`GameCanvas/listener.ts`, `halos.ts`, and `playMusic` in `index.tsx`): with the `music` option on, `createListener` opens the microphone with processing off and exposes an analyser; each frame the canvas samples it, runs the beat detector, drops a cascade wave per beat (strong beats from the board center, the rest sweeping in from the six tips in turn), and applies the result: marbles get extra emission pushed toward white plus a swell (`setMusic`), additive light pools land under them (`halos.ts`), and the rim, grid floor, and key light breathe with the bass through the `pulse` handles `createScene` returns. Each theme sets how hard it reacts in `theme.music`. The listener lives in a ref outside the scene so a theme change mid-song keeps the mic open. The canvas also writes a `--music` CSS variable (0..1) that the overlay uses for the wordmark halo, the status marble, and the equalizer indicator. Status (`off`, `starting`, `listening`, `denied`, `unsupported`) goes up through `onMusicStatus` to the options panel. The audio never leaves the device. In a headless browser, test by replacing `navigator.mediaDevices.getUserMedia` with a function that returns a synthesized `MediaStreamAudioDestinationNode` stream.
- **`src/components/Setup/`**: the pre-game card (player count, person or computer per seat). **`src/components/Hud/`**: turn banner, Undo, Stop here (mid-chain), New game.
- **`src/lib/board/`**: the 121-hole star in cube coordinates: `HOLES`, `NEIGHBORS`, `ZONE_HOLES`, zone tests, board-plane layout (`px`, `py`, one unit per hole spacing). Tips are named by compass point as seen in portrait; the first seat is always S (bottom).
- **`src/lib/game/`**: `createGame`, `stepOptions` and `hopOptions` (what a marble may do next), `applyStep`, `applyHop`, `endChain`, `canStop`, `legalMovesFor` (whole moves, breadth-first over hop chains; the computer's menu), `applyMove`, `hasWon`, `canRest` (no resting in other seats' tips). Moves and chains carry their full path for animation.
- **`src/lib/match/`**: the app-level reducer with history (`start`, `move`, `step`, `hop`, `stop`, `undo`, `quit`); undo takes back a hop mid-chain, otherwise the whole last human turn.
- **`src/lib/ai/`**: a greedy one-move lookahead on distance to the goal apex with a straggler penalty.
- **`src/lib/motion/`**: pure path sampling (eased horizontal travel, parabolic lift per leg) used by the canvas to fly marbles.
- **`src/lib/palette/`**: marble names and colors per tip, shared by the canvas and the HTML overlay.
- **`src/lib/theme/`**: the two looks, Tavern and Neon. A `Theme` owns the scene recipe (background, table, board kind, rim, holes, lights, exposure, marble glow, marker lightening) and the marble palette with names, so the canvas, the HUD, and the setup card all read `theme.marbles[zone]`. The HTML overlay follows through `data-theme` on `<html>` and CSS variables in `globals.css` (colors, font, heading weight); Neon uses Chakra Petch, Tavern uses Fraunces, both loaded in `index.html`. Changing the theme rebuilds the three.js scene (the mount effect depends on it).
- **`src/lib/beat/`**: a bass-onset beat detector (energy against a rolling history with a refractory period) that reduces one FFT frame to band energies, a smoothed level, and a beat flag with strength. **`src/lib/cascade/`**: a pool of expanding light rings; `glowAt(x, y, now)` is how bright a point is as wave fronts pass it. Both are rendering-free and allocation-free per frame.
- **`src/lib/options/`**: player preferences (`hints`, the move-guidance rings; `theme`; `music`, the microphone reaction; `facePlayer`, the pass-and-play tilt), parsed defensively from localStorage and saved on change. **`src/components/Options/`** is the panel, opened from the Options control at the top right during setup and play.
- **`src/utils/`**: `clamp`, `smoothstep`, `vibrateIfSupported`.

**Offline and install**: the app is a PWA. `vite-plugin-pwa` (configured in `vite.config.ts`) writes the manifest and a Workbox service worker that precaches every build asset (code, styles, fonts, icons, manifest), with `registerType: "autoUpdate"` so a new deploy takes over on the next open. Nothing the game needs may load from the network at runtime: fonts come from Fontsource packages, textures are generated on the client, and Vercel analytics is the one external script and is allowed to fail. Icons live in `public/icons/` (PNGs rasterized from `icon-maskable.svg`, which keeps the marble inside the maskable safe zone); regenerate them with Quick Look (`qlmanage -t -s 512`) if the artwork changes. The service worker is only emitted by `pnpm build`; test offline behavior against `pnpm start`, not the dev server.

Each module is a directory named after its primary export, containing `index.ts` and optionally `consts.ts`, `types.ts`, and `tests.ts`.

**Turn model**: a turn is one step (ends the turn at once) or a chain of hops. The chain lives in game state (`GameState.chain`): `applyHop` moves the marble and keeps the chain open, `endChain` stops it where it may rest, and a hop with no follow-up ends the turn by itself. A marble may pass through a foreign tip mid-chain but `hopOptions` never offers a landing it could not finish from. `applyMove` plays a whole move at once (how the computer plays) by walking the same functions; its path must be exactly what the marble travels. The match reducer exposes `step`, `hop`, `stop`, and `move`; undo mid-chain takes back one hop, otherwise it rewinds to the start of the last human turn.

**Interaction model** (in `GameCanvas/index.tsx`): pointerdown on one of the current human seat's marbles selects it (steps and first hops ring up) and starts a press. Moving past a small threshold turns the press into a drag: on touch the marble rides ahead of the fingertip (a mouse gets no offset), and the nearest ringed hole within the snap radius gets the target ring. Release over a target commits (a step or a hop); release elsewhere flies the marble home and leaves it selected. A press that never moved is a tap: the marble stays selected, a later tap on a ring commits, a tap on the marble itself puts it down. With the hints option off the rings are not drawn, but every ringed hole still accepts a tap or a drop, and the snap target ring still shows during a drag. After a hop the chain's marble is re-selected automatically when it lands, ringed by its next hops; tapping it (or the HUD's Stop here) ends the turn when it may rest there, and only that marble is in play until then. Picking happens against a plane at marble height so a tap on a marble's visible center hits its hole. The canvas animates only forward travel (turn count or chain length grew), replaying the legs the marble has not yet shown; undo and new games snap. It calls `onSettled` once the table matches the state, which is what lets the computer take its turn.

## Performance requirements

- **60 fps on a three-year-old mid-range phone.** The scene is small (one board, 121 instanced holes, up to 60 marbles, one instanced halo set, one shadow-casting light); keep it that way. No post-processing, no transmission materials; the music halos are additive instanced discs, not bloom.
- **Touch latency**: the marble must be lifted on the frame of the touch; drags update the mesh directly from the pointer handler, not through React state.
- **Initial load under ten seconds** on a typical connection. Textures are generated on the client; there are no model or image downloads. The precache is about 1.3 MB; keep an eye on it when adding assets.
- **No per-frame allocations** in the render loop. Reuse vectors and the motion sample; allocate in setup.
- **Portrait-first layout**: the board is fit to the viewport width in portrait and to the height on desktop; the HUD sits above and below it. Do not design a separate landscape layout.

## Commands

```bash
pnpm dev         # Vite dev server at http://localhost:5173
pnpm build       # Production build (vite build, outputs dist/)
pnpm start       # Serve the production build (vite preview)
pnpm test        # Run tests once (vitest run)
pnpm test:watch  # Run tests in watch mode
pnpm check       # Verify formatting + lint + typecheck (run before commits)
pnpm format      # Auto-fix formatting (prettier --write)
```

**Important**: Always run `pnpm run check` before commits to ensure code is properly formatted, linted, and type-safe. Do not run formatting, linting, or typechecking separately. `check` only *verifies* formatting (`prettier --check`); if it flags formatting issues, run `pnpm format` to auto-fix.

**Verification**: vitest covers the rules, the reducer, the AI, and the motion sampler, but feel is the product and jsdom has no GPU. Verify anything visual or interactive in a real browser (chrome-devtools works), in a portrait viewport, by dispatching pointer events at the canvas (synthetic events cannot be pointer-captured; that path is guarded).

**Documentation**: keep this file and README.md accurate as the architecture takes shape. There is no backend in this project.

## Git Workflow

- **Always rebase when integrating to `main`, never create merge commits**: bring a branch up to date with `git rebase main`, and land it with a fast-forward (`git merge --ff-only` or `git rebase`). Never run `git merge` in a way that produces a merge commit on `main`; keep history linear.

## Tech Stack

- **Vite 8** (Rolldown) + **React 19** + **TypeScript** (ESM) + **pnpm**
- **three.js** (`three` + `@types/three`) for all rendering (WebGL); use named imports (`import { Scene } from "three"`); addons come from `three/addons/...`
- **Vercel** static hosting (`dist/` output); **@vercel/analytics** injected in `src/main.tsx` (the script 404s outside Vercel deployments; that console error is expected in local dev)
- **remeda** for array/object utilities
- Tests: **vitest** (jsdom environment, no GPU in CI; keep game logic rendering-free so it stays testable)

## Coding Standards

- **Never log sensitive data**: do not log API keys, tokens, passwords, or other secrets. Use placeholder text like `[REDACTED]` if you need to indicate a value exists without revealing it
- **No accessibility (a11y) lint**: jsx-a11y is intentionally absent from the ESLint setup, and there is no need to add ARIA attributes or roles purely for accessibility conventions. Don't re-introduce a11y rules or flag missing aria tags in reviews
- **No em dashes or AI-isms in docs**: write documentation in a plain, direct voice. Don't use em dashes; restructure the sentence or use commas, colons, or parentheses instead. Avoid telltale LLM phrasing: "delve", "seamless", "robust", "leverage", "elevate", "It's not just X, it's Y", adjective triads ("fast, simple, and powerful"), emoji headings, and "In summary" wrap-ups. Prefer concrete, specific statements
- **Package manager**: use `pnpm` for all package management (install, add, remove, etc.)
- **ESM imports only**: always use `import` syntax, never `require()`. This is an ESM project and `require` will throw `ReferenceError: require is not defined`
- **Arrow functions**: use `const foo = () => { ... }` (enforced by ESLint, auto-fixable)
- **Reserve the `use` prefix for React hooks**: for boolean options or flags, use names like `systemFont`, `enableCache`, or `withValidation` instead of `useSystemFont`, `useCache`, or `useValidation`
- **Named imports**: use `import { pipe, filter } from 'remeda'` not `import * as R` (tree-shaking)
- **Import paths, use the `@/` alias**: import across modules with the `@/` alias (`@/lib/game`, `@/utils/clamp`), which maps to `src/` (see `tsconfig.json`). Reserve relative paths for files within the same module (`./types`, `./consts`); don't reach across modules with `../`
- **Remeda utilities**: prefer for array/object manipulation over manual loops where it improves readability without hurting performance. Exception: hot paths in the simulation and render loop, where plain loops and preallocated arrays win
- **Named constants**: use `const LEG_MS = 300` not magic numbers
- **Numeric separators**: use underscore separators for numbers 1000 and above for readability (`1_500`, `44_100`, `100_000`)
- **DRY (Don't Repeat Yourself)**: when a pattern appears 3+ times, extract it into a helper function. Place shared utilities in `src/utils/` (e.g., `src/utils/clamp/index.ts`)
- **Module structure**: always create modules as directories with `index.ts`, never as single `moduleName.ts` files. Name the directory after the primary export (class, function, or concept):

  ```
  # GOOD - directory structure allows for growth
  src/lib/
    game/
      index.ts       # exports createGame(), applyMove(), …
      tests.ts       # tests for the module
      types.ts       # game-specific types + guards
    board/
      index.ts       # exports holeAt(), zoneOf(), …
      consts.ts      # HOLE_COUNT, ZONE_APEX, etc.
      types.ts       # Cube, Zone, etc.
      tests.ts

  # BAD - single files have nowhere for related code to go
  src/lib/
    game.ts
    board.ts
  ```

  Standard files within a module directory:

  - `index.ts` - main module implementation, exports, and re-exports of types/consts
  - `tests.ts` - tests for the module (`tests.tsx` when the tests render JSX)
  - `consts.ts` - module-specific constants
  - `types.ts` - module-specific type definitions and their type guards (if needed)

- **Re-export types and consts from index.ts**: each module's `index.ts` should re-export all types and consts from `types.ts` and `consts.ts`. External code should import from the module, not directly from internal files:

  ```typescript
  // GOOD - import from the module
  import { holeAt, ZONE_APEX } from "@/lib/board";

  // BAD - importing directly from internal module files
  import { holeAt } from "@/lib/board/index";
  import { ZONE_APEX } from "@/lib/board/consts";
  ```

  In `board/index.ts`:

  ```typescript
  export * from "./consts";
  export * from "./types";
  ```

- **Avoid barrel-only files**: don't create `index.ts` files that only re-export from child modules. Import directly from the specific module instead (e.g., `import { clamp } from '@/utils/clamp'` not `from '@/utils'`)
- **JSDoc**: skip `@param`/`@returns` tags (TypeScript provides types); use inline comments if needed
- **Intl API**: prefer `Intl.DateTimeFormat`, `Intl.NumberFormat`, etc. over manual formatting for dates and numbers
- **Explicit conditionals for derived values**: when a value is derived from another value, branch on the source value, not the derived one:

  ```typescript
  // GOOD - branch on the source value
  if (seat.kind === "computer") {
    delay = THINK_MS;
  } else {
    delay = 0; // "human"
  }

  // BAD - mixes the source value with a value derived from it
  const isHuman = seat.kind === "human";
  if (seat.kind === "computer") {
    delay = THINK_MS;
  } else if (isHuman) {
    delay = 0; // redundant, just use `kind`
  }
  ```

- **Type guards over type assertions**: never use `as` type assertions on values with unknown runtime types. Use type guards from Remeda (`isString`, `isNumber`, `isBoolean`, `isPlainObject`) or create a new custom type guard if none exist:

  ```typescript
  // GOOD - type guard validates at runtime
  import { isString } from "remeda";

  if (isString(value)) {
    config.name = value;
  }

  // BAD - blind cast assumes type without validation
  config.name = value as string;
  ```

  For union types (e.g., `"human" | "computer"`), create a type guard that validates the actual values, not just the primitive type:

  ```typescript
  // GOOD - validates the value is one of the allowed options
  import { isSeatKind } from "@/lib/game";

  if (isSeatKind(value)) {
    seat.kind = value; // No cast needed
  }

  // BAD - isString only checks primitive type, not valid union values
  if (isString(value)) {
    seat.kind = value as SeatKind; // Still a blind cast!
  }
  ```

  When creating type guards for union types, use the named type in the return type annotation; don't hardcode the union:

  ```typescript
  // GOOD - uses the named type
  import type { SeatKind } from "@/lib/game";

  const SEAT_KINDS: readonly SeatKind[] = ["human", "computer"];

  export const isSeatKind = (value: unknown): value is SeatKind => {
    return isString(value) && SEAT_KINDS.includes(value as SeatKind);
  };

  // BAD - hardcodes the union type (duplicates the type definition)
  export const isSeatKind = (
    value: unknown
  ): value is "human" | "computer" => {
    // ...
  };
  ```

- **Typed errors over string messages**: when throwing errors, create a custom error class with a typed `code` property instead of using plain `Error` with string messages:

  ```typescript
  // GOOD - typed error with machine-readable code
  type MyErrorCode = "NOT_FOUND" | "PERMISSION_DENIED" | "TIMEOUT";

  class MyError extends Error {
    readonly code: MyErrorCode;
    constructor(code: MyErrorCode) {
      super(code);
      this.name = "MyError";
      this.code = code;
    }
  }

  const isMyError = (error: unknown): error is MyError => {
    return error instanceof MyError;
  };

  // Usage - callers get autocomplete and type checking
  try {
    await doSomething();
  } catch (error) {
    if (isMyError(error)) {
      switch (error.code) {
        case "NOT_FOUND": // TypeScript knows valid codes
        // ...
      }
    }
  }

  // BAD - string messages aren't type-safe
  throw new Error("Not found");
  throw new Error("Permission denied");
  ```

- **Tests verify behavior, not implementation**: tests should verify that code works correctly, not enshrine implementation details. Never write tests that just check constant values; if a constant matters, test the behavior it affects:

  ```typescript
  // BAD - tests implementation detail, provides no value
  it("should have the expected leg duration", () => {
    expect(LEG_MS).toBe(300);
  });

  // GOOD - tests actual behavior that depends on the constant
  it("lands a two-hop chain after two legs of flight", () => {
    const out = createMotionSample();
    sampleMotion(path, motionDuration(3), out);
    expect(out.done).toBe(true);
  });
  ```

## Design Language

Beauty and delight are requirements, not polish to add later. Every surface should be good to look at, and every interaction should feel satisfying: the lift of a marble, the hop along a chain, the click into a hole. Treat "it works but feels flat" as a bug.

**Haptics**: use the Vibration API (`navigator.vibrate`) where it adds weight to a physical moment (a marble landing), not as a reflex on every touch. Keep pulses short, and treat it as progressive enhancement; it is unsupported on iOS Safari, so nothing may depend on it.

neongames has two committed looks, chosen in Options, and every visual surface follows the active one. **Tavern** (default): a game table in a quiet bar at night. Dark room, green felt, a warm wooden board, glass marbles that catch the light; light comes from the lamp over the table and from the pieces, never from bright UI chrome. **Neon**: after hours in a basement club. Near-black everything, a glowing grid floor, black lacquer board, magenta neon rim, marbles that emit their own color, cyan accents, a square techno face. In both, the interface is minimal and sits at the edges; the table is the picture. Writing tone: warm, brief, plain. "Your move." "Emerald wins." New visual work must be designed for both themes, through the `Theme` recipe and the CSS variables, never by special-casing one.

Do not fall back on generic defaults for any surface. Banned AI-design tells:

- **Color**: indigo/violet "AI purple," blue-to-purple gradients, oversized colored drop-shadows, cream/oatmeal (#faf8f5-family) backgrounds with coral/amber/terracotta accents, and timid evenly-spread palettes. Glow is allowed as light in the world (a marble, the lamp, a neon tube), and in Neon as a restrained text or button halo that reads as signage, not as generic UI decoration.
- **Type**: Inter, Roboto, Geist, or system-default fonts; the friendly serif-plus-sans pairing; the lone-italic-serif-word accent inside a sans headline.
- **Layout and components**: centered hero with a pill badge above the headline; three identical icon-topped feature cards; colored left-border cards; glassmorphism panels; shadcn/ui defaults; one uniform 16px radius on everything; emoji as nav or bullet icons; all-caps section labels; 1-2-3 numbered step rows; horizontal stat-banner rows.
- **Copy**: vague lines like "Build the future" and hedged marketing filler.
