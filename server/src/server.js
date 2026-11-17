require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const app = require("./app");
const {
  matchesArchitectToken,
  parseClientOrigins,
  parsePort,
  validateArchitectToken
} = require("./serverConfig");

const port = parsePort(process.env.PORT);
const host = process.env.HOST?.trim() || "127.0.0.1";
const clientOrigins = parseClientOrigins(process.env.CLIENT_ORIGINS);
const architectToken = validateArchitectToken(process.env.WORLD_ARCHITECT_TOKEN);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientOrigins,
    methods: ["GET", "POST"]
  }
});

app.set("io", io);
app.set("architectToken", architectToken);

io.use((socket, next) => {
  if (matchesArchitectToken(socket.handshake.auth?.token, architectToken)) {
    return next();
  }
  return next(new Error("World Architect access token is required or invalid."));
});

httpServer.requestTimeout = 30000;
httpServer.headersTimeout = 65000;
httpServer.keepAliveTimeout = 5000;

httpServer.on("error", (error) => {
  console.error("EchoWorld server failed:", error);
  process.exitCode = 1;
});

httpServer.listen(port, host, () => {
  const clientEntryPoint = path.resolve(__dirname, "../../client/dist/index.html");
  console.log(`EchoWorld server listening at http://${host}:${port}`);
  console.log(fs.existsSync(clientEntryPoint)
    ? "Production dashboard is being served by the API."
    : "Dashboard build not found; run npm run build to serve the frontend.");
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing EchoWorld connections.`);
  const shutdownTimeout = setTimeout(() => {
    console.error("EchoWorld shutdown timed out.");
    process.exit(1);
  }, 10000);
  shutdownTimeout.unref();
  io.close((error) => {
    clearTimeout(shutdownTimeout);
    if (error) {
      console.error("EchoWorld shutdown failed:", error);
      process.exitCode = 1;
      return;
    }
    console.log("EchoWorld server stopped cleanly.");
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
