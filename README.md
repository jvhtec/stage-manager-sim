# Stage Tycoon

A Transport-Tycoon-style management game about running a touring production
company: book sound, lights and video for shows, send trucks and crews across an
isometric map, grow your bases, and take acts on world tours — from 1975 to today.

Play it in the browser (it installs as a PWA); there is no backend.

## Develop

```sh
npm i
npm run dev          # http://localhost:8080
npm run test:run     # simulation tests
npm run lint
npm run build:pages  # GitHub Pages build (base path /stage-manager-sim/)
npm run budget:bundle
```

Built with Vite, TypeScript and React. The simulation lives in `src/world`
(a deterministic, seeded engine with no UI imports) and the map game in
`src/tycoon`.

## Design documents

The current design is in the Transport Tycoon redesign document; the others are earlier plans from the original dashboard-style build, which has since been retired:

- [Transport Tycoon Redesign — current direction](docs/transport-tycoon-redesign.md)
- [Tycoon Game Plan — earlier roadmap (dashboard era)](docs/tycoon-game-plan.md)
- [Game Concept Document](docs/sector-pro-simulator-game-concept.md)
- [Game Design Document](docs/sector-pro-simulator-gdd.md)
- [Core Gameplay Loop Diagram](docs/sector-pro-simulator-gameplay-loop.md)
- [Feature Roadmap](docs/sector-pro-simulator-roadmap.md)

These files capture the narrative, systems design, and production milestones that guide future development of the simulation.
