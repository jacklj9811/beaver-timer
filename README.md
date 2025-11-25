# Beaver Timer

## Development
- Install dependencies: `npm install`
- Start dev server: `npm run dev` (Next.js at http://localhost:3000)

## VS Code debugging (cross-platform)
- For Node/SSR breakpoints, start with the inspect flag using the cross-platform script: `npm run dev:inspect`.
- In VS Code, attach to port **9229** (e.g., a `node` attach configuration) to hit server-side or API route breakpoints.
- For client-side debugging, open http://localhost:3000 in Chrome/Edge DevTools or use a VS Code `pwa-chrome` launch configuration.

The `dev:inspect` script calls `node --inspect-brk node_modules/next/dist/bin/next dev --turbo`, avoiding the shell wrapper (`node_modules/.bin/next`) that fails on Windows when invoked directly with `node --inspect-brk`.
