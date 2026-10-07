# bargames

Board games for a bar table, played in the browser. The first game is Chinese Checkers.

Open it on a phone, drag a marble, and let go over a glowing hole. The board is a wooden disc on green felt, drawn in three.js at a tilt, with glass marbles that cast real shadows. It works on desktop with a mouse just as well.

## Chinese Checkers

- Two, three, four, or six players. Any seat can be a person or the computer, so you can play alone, pass the phone around, or watch two computers go at it.
- Drag a marble and drop it on a highlighted hole, or tap the marble and then tap where it should land. Hops along a chain replay hole by hole.
- Standard rules: step to an adjacent empty hole, or hop over any marble into the empty hole directly beyond, as many times in a row as the board allows. A marble may pass through another seat's tip but may not come to rest there. First player to fill the opposite tip wins.
- Undo takes back your last move (and the computer's reply). No timers, no scores.

## Tech

- [three.js](https://threejs.org/) renders the table; [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript wrap it in a thin HTML shell (setup card, turn banner, buttons)
- The rules live in rendering-free TypeScript under `src/lib` and are unit tested with [vitest](https://vitest.dev/)
- Static build (`dist/`), hosted on [Vercel](https://vercel.com/)

## Development

```bash
pnpm install     # Install dependencies
pnpm dev         # Vite dev server at http://localhost:5173
pnpm build       # Production build (vite build, outputs dist/)
pnpm start       # Serve the production build (vite preview)
pnpm test        # Run tests once (vitest run)
pnpm test:watch  # Run tests in watch mode
pnpm check       # Verify formatting + lint + typecheck
pnpm format      # Auto-fix formatting
```

To try the touch experience during development, use a real phone on the local network or the device toolbar in browser devtools.

## License

MIT, see [LICENSE](LICENSE).
