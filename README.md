# EchoWorld

### A society that evolves without a script

EchoWorld is an experimental, locally runnable civilization simulator. Thirty programmed agents make utility-based decisions, interact, exchange resources, build relationships, remember outcomes, and respond to seeded or architect-triggered world events.

> **Important:** EchoWorld agents are software models, not conscious beings or human-level AI. The simulation runs without paid AI services. The current version keeps world state in memory and does not require MongoDB.

## Features

- **A seeded virtual city:** ECHO CITY has Greenfield, MetroCore, and NovaDistrict, with 30 agents and community infrastructure.
- **Autonomous decision loop:** Agents perceive public surroundings and their own state, score available actions, act, and reflect on outcomes.
- **Resource economy:** Six resource categories, role-based production, consumption, markets, trades, and transaction history.
- **Social dynamics:** Programmed cooperation proposals, reciprocal relationships, trust changes, and a network explorer.
- **Dynamic events:** Seeded environmental changes and validated World Architect interventions.
- **Interactive dashboard:** World overview, agent explorer, social network, simulation controls, event timeline, research laboratory, and a selectable 3D city atlas.
- **Reproducible experiments:** Paired, seeded studies compare cooperation, memory, scarcity, personality diversity, coordination, and adaptability.
- **Live updates:** Express REST APIs and Socket.IO broadcasts keep simulation views synchronized.
- **No paid dependencies:** The JavaScript simulation works without external AI APIs or a database.

## Screenshots

Screenshots are not included yet. Add captures to `docs/screenshots/` and replace these placeholders:

| Screen | Screenshot |
| --- | --- |
| World overview | `docs/screenshots/world-overview.png` |
| Agent explorer | `docs/screenshots/agent-explorer.png` |
| 3D city atlas | `docs/screenshots/city-atlas.png` |
| Research laboratory | `docs/screenshots/research-lab.png` |

## Architecture

```text
React + Vite dashboard
    ├── REST requests ─────────┐
    └── Socket.IO updates ─────┤
                               ▼
                       Express + Socket.IO
                               │
       ┌───────────────────────┼─────────────────────────┐
       ▼                       ▼                         ▼
 Agent / simulation     Economy / social /         Research runner
 perception, decision,  event services             (worker thread)
 action, memory         and in-memory stores
       └───────────────────────┬─────────────────────────┘
                               ▼
                    shared/world.json
```

The simulation runs in discrete ticks and uses seeded randomness for repeatable outcomes. Research runs execute in a worker and do not mutate the live world.

## Project structure

```text
EchoWorld/
├── client/                 # React + Vite dashboard
│   └── src/                # Views, API/socket clients, styles, 3D city atlas
├── server/
│   └── src/
│       ├── agents/         # Agent factory and profile store
│       ├── simulation/     # Perception, decisions, actions, memory, tick engine
│       ├── economy/        # Resource rules, markets, transaction records
│       ├── social/         # Social interaction records
│       ├── events/         # Event lifecycle and effects
│       ├── research/       # Experiment definitions, runner, worker, results
│       ├── app.js          # REST API and production dashboard serving
│       └── server.js       # HTTP and Socket.IO startup
├── shared/world.json       # Initial world and community configuration
├── .env.example            # Safe local configuration template
├── Dockerfile              # Optional container build
├── DEPLOYMENT.md           # Production and hosting guidance
└── package.json            # Workspace scripts
```

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React 18, Vite, JavaScript, CSS |
| 3D visualization | Three.js, React Three Fiber |
| Icons | Lucide React |
| Backend | Node.js, Express 5 |
| Real-time updates | Socket.IO |
| Simulation | Modular JavaScript engines, seeded randomness, worker threads |
| Testing | Node.js built-in test runner |
| Persistence | In-memory stores in this version |

This is a MERN-oriented project, but **MongoDB/Mongoose are not currently integrated**. No current feature requires MongoDB; agent profiles, world state, memories, events, transactions, social data, and experiment records reset when the server restarts. Persistent storage is future work.

## Requirements

- Node.js 20 or newer
- npm (included with Node.js)
- Git is needed to clone or contribute; MongoDB and paid services are not needed

## Install and run on Windows

Open PowerShell in the project folder:

```powershell
npm install
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`). The Vite development server proxies API and Socket.IO requests to the local Express server on port `4000`.

The default settings work without a `.env` file. To customize them, copy the safe template and edit `.env`:

```powershell
Copy-Item .env.example .env
```

Never commit `.env`; `.gitignore` excludes it. The example file contains only non-secret local defaults.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and Vite dashboard for local development |
| `npm run build` | Create the production dashboard build |
| `npm test` | Run the automated test suite |
| `npm run validate` | Build the dashboard and run all tests |
| `npm start` | Build the dashboard and start the production server |

For production mode, set `NODE_ENV=production` and provide `WORLD_ARCHITECT_TOKEN` with at least 32 characters. Keep the token in the hosting provider's secret settings, never in frontend variables or source control. See [DEPLOYMENT.md](./DEPLOYMENT.md) for PowerShell, Docker, and private-hosting instructions.

## Research objectives

The Research Laboratory runs seeded, paired experiments to measure:

1. Cooperation versus independent behavior
2. Memory-enabled versus memory-disabled agents
3. Resource scarcity and recovery
4. Personality diversity
5. Centralized versus decentralized coordination
6. Adaptability to environmental change

It reports observed outcomes such as wellbeing, cooperation, decision success, wealth inequality, resource availability, and recovery. Results are measurements from this programmed model, not claims about real societies.

## API overview

- `GET /api/health` and `GET /api/world`
- `GET /api/agents` and `GET /api/agents/:agentId`
- `POST /api/simulation/start`, `/pause`, `/resume`, `/step`, `/reset`, and `/speed`
- `GET` and `POST /api/events`
- `GET /api/experiments`, `POST /api/experiments`, and experiment comparison endpoints
- `GET /api/transactions`, `/api/relationships`, and `/api/social-interactions`

In production, `/api/health` is public for hosting checks. Other API routes and Socket.IO connections require the shared World Architect token. Use HTTPS for network access; the token is not an individual account system.

## Roadmap

- **M1–M10:** World foundation, agent factory, decision/economy/social engines, memory and learning, events, dashboard and 3D atlas, research tools, tests, and deployment hardening — implemented.
- **Next:** Durable persistence (for example, MongoDB), authenticated individual accounts, durable experiment history, and hosted deployment automation.

The project is currently published as source code only when pushed to GitHub. Uploading the repository does **not** make the application live; frontend/backend hosting must be configured separately. EchoWorld does not currently have MongoDB persistence or a public hosted demo.

## Author

Created by [Akshay Dhobi](https://github.com/Akshaydhobi).
