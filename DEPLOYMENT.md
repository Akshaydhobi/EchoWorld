# EchoWorld deployment

EchoWorld can run locally or in a Docker-compatible container without a paid AI or database service. Simulation state, agent memories, events, and research runs are held in memory; a server restart resets them.

## Validate and run the production server

```powershell
npm install
npm run validate
npm start
```

`npm start` builds the Vite client and serves the dashboard, REST API, and Socket.IO from one Express origin. Open `http://127.0.0.1:4000`.

The server defaults to `HOST=127.0.0.1` and `PORT=4000`. Copy `.env.example` to `.env` to customize local settings. `CLIENT_ORIGINS` is a comma-separated list of exact browser origins (scheme and host, no paths); the default allows the two Vite development origins.

## Architect access protection

When `NODE_ENV=production`, the server will not start without `WORLD_ARCHITECT_TOKEN`. Use a random value of at least 32 characters. For example, in PowerShell:

```powershell
$token = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set that value in the hosting provider's secret environment settings. Do not commit it or put it in a `VITE_*` variable. The browser asks for the token and keeps it in `sessionStorage` only for that tab/session. All API routes except `/api/health`, plus Socket.IO connections, require the token. Use HTTPS for any network deployment; the token is a shared architect credential, not an individual account system.

Local development leaves token protection disabled unless `WORLD_ARCHITECT_TOKEN` is set. The production guard and API checks still apply to supported action inputs.

## Docker

Install Docker Desktop, then build the image from the project root:

```powershell
docker build -t echoworld .
```

Create a local `.env` with a strong `WORLD_ARCHITECT_TOKEN`, then run:

```powershell
docker run --rm -p 4000:4000 --env-file .env -e HOST=0.0.0.0 -e CLIENT_ORIGINS=http://localhost:4000 echoworld
```

Open `http://localhost:4000`; the container health check calls `/api/health`. The runtime image runs as the non-root `node` user. The container does not include MongoDB because the current simulation deliberately uses in-memory stores.

## Hosted container checklist

For a private test deployment on a container host:

1. Build with the included `Dockerfile` (or use build command `npm ci && npm run build` and start command `npm run start:server`).
2. Set `NODE_ENV=production`, `HOST=0.0.0.0`, the host-provided `PORT`, a strong `WORLD_ARCHITECT_TOKEN`, and `CLIENT_ORIGINS=https://your-exact-hostname`.
3. Configure HTTPS and allow WebSocket upgrades for Socket.IO.
4. Configure the provider's health check to `GET /api/health`.
5. Confirm the provider's free-tier limits, sleeping behavior, storage, and current pricing before deploying. Free plans and quotas change; do not assume a provider remains free.

The token gates access but is shared by all authorized browser sessions. There are no individual accounts, durable storage, or per-user audit controls yet. Keep hosted instances private and do not use them for sensitive data or expose them as a public service. Persistent storage and stronger identity/access management require a later milestone.
