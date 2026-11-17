const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { matchesArchitectToken } = require("./serverConfig");
const world = require("../../shared/world.json");
const { ROLE_COUNTS } = require("./agents/agentFactory");
const {
  getAgentById,
  listAgents,
  listRelationships,
  getSocialSummary
} = require("./agents/agentStore");
const worldStore = require("./simulation/worldStore");
const { SimulationControlError, SimulationController } = require("./simulation/simulationController");
const { listTransactions } = require("./economy/transactionStore");
const { listSocialInteractions } = require("./social/socialInteractionStore");
const {
  EVENT_DEFINITIONS,
  createManualEvent,
  listEvents
} = require("./events/eventStore");
const { listExperimentDefinitions } = require("./research/experimentDefinitions");
const {
  ExperimentStoreError,
  getExperiment,
  listExperiments
} = require("./research/experimentStore");
const { startExperiment } = require("./research/experimentService");

const communityIds = new Set(world.communities.map((community) => community.id));
const roleIds = new Set(Object.keys(ROLE_COUNTS));
const clientBuildDirectory = path.resolve(__dirname, "../../client/dist");
const clientEntryPoint = path.join(clientBuildDirectory, "index.html");

const app = express();
const simulation = new SimulationController((event, update) => {
  const io = app.get("io");
  if (!io || typeof io.emit !== "function") {
    throw new Error("Socket.IO is not configured for simulation updates.");
  }
  io.emit("simulation:update", { event, ...update });
});

function requireRealtime(request) {
  const io = request.app.get("io");
  if (!io || typeof io.emit !== "function") {
    throw new SimulationControlError("Live update transport is unavailable.", 503);
  }
}

app.disable("x-powered-by");
app.use((_request, response, next) => {
  response.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
  });
  next();
});
app.use("/api", (request, response, next) => {
  if (request.path === "/health" ||
      matchesArchitectToken(request.get("X-Architect-Token"), app.get("architectToken"))) {
    return next();
  }
  return response.status(401).json({
    error: "World Architect access token is required or invalid."
  });
});
app.use(express.json({ limit: "16kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", milestone: "M10" });
});

app.get("/api/world", (_request, response) => {
  response.json(worldStore.getWorld());
});

app.get("/api/simulation", (_request, response) => {
  response.json({ world: worldStore.getWorld() });
});

app.get("/api/events", (request, response) => {
  const { type, community, status, source, limit } = request.query;
  const allowedParams = new Set(["type", "community", "status", "source", "limit"]);
  if (Object.keys(request.query).some((key) => !allowedParams.has(key))) {
    return response.status(400).json({ error: "Event query contains an unsupported filter." });
  }
  if (type !== undefined &&
      (typeof type !== "string" || !Object.hasOwn(EVENT_DEFINITIONS, type))) {
    return response.status(400).json({ error: "Event type filter is not recognized." });
  }
  if (community !== undefined &&
      (typeof community !== "string" || !communityIds.has(community))) {
    return response.status(400).json({ error: "Event community filter is not recognized." });
  }
  if (status !== undefined &&
      (typeof status !== "string" || !["active", "scheduled", "resolved"].includes(status))) {
    return response.status(400).json({ error: "Event status filter is not recognized." });
  }
  if (source !== undefined &&
      (typeof source !== "string" || !["manual", "environment"].includes(source))) {
    return response.status(400).json({ error: "Event source filter is not recognized." });
  }
  const limitNumber = limit === undefined ? 50 : Number(limit);
  if (!Number.isSafeInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    return response.status(400).json({ error: "Event limit must be from 1 to 100." });
  }
  return response.json(listEvents({
    type,
    communityId: community,
    status,
    source,
    limit: limitNumber
  }));
});

app.post("/api/events", (request, response, next) => {
  try {
    requireRealtime(request);
    const event = createManualEvent(request.body, worldStore.getWorld().tick);
    const currentWorld = worldStore.getWorld();
    simulation.publish("event-created", { worldEvent: event, world: currentWorld });
    return response.status(201).json({ event, world: currentWorld });
  } catch (error) {
    if (error instanceof TypeError) {
      return response.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

app.get("/api/experiments/catalog", (_request, response) => {
  response.json({ experiments: listExperimentDefinitions() });
});

app.get("/api/experiments/compare", (request, response) => {
  const { first, second } = request.query;
  if (Object.keys(request.query).some((key) => !["first", "second"].includes(key)) ||
      typeof first !== "string" || typeof second !== "string" || first === second) {
    return response.status(400).json({
      error: "Compare two different experiment IDs using first and second."
    });
  }
  const firstExperiment = getExperiment(first);
  const secondExperiment = getExperiment(second);
  if (!firstExperiment || !secondExperiment) {
    return response.status(404).json({ error: "One or both experiments were not found." });
  }
  if (firstExperiment.status !== "completed" || secondExperiment.status !== "completed") {
    return response.status(409).json({ error: "Both experiments must be completed before comparison." });
  }
  if (firstExperiment.type !== secondExperiment.type) {
    return response.status(400).json({ error: "Only experiments of the same type can be compared." });
  }
  return response.json({ first: firstExperiment, second: secondExperiment });
});

app.get("/api/experiments", (_request, response) => {
  response.json(listExperiments());
});

app.post("/api/experiments", (request, response, next) => {
  try {
    const experiment = startExperiment(request.body, (event, update) => {
      const io = app.get("io");
      if (io && typeof io.emit === "function") {
        io.emit("research:update", { event, experiment: update });
      }
    });
    return response.status(202).json({ experiment });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/experiments/:experimentId", (request, response) => {
  const experiment = getExperiment(request.params.experimentId);
  if (!experiment) {
    return response.status(404).json({ error: "Experiment was not found." });
  }
  return response.json({ experiment });
});

app.get("/api/agents", (request, response) => {
  const { community, role, search } = request.query;
  if (community !== undefined && (typeof community !== "string" || !communityIds.has(community))) {
    return response.status(400).json({ error: "Community filter is not recognized." });
  }
  if (role !== undefined && (typeof role !== "string" || !roleIds.has(role))) {
    return response.status(400).json({ error: "Role filter is not recognized." });
  }
  if (search !== undefined && (typeof search !== "string" || search.length > 80)) {
    return response.status(400).json({ error: "Search must be a string of at most 80 characters." });
  }

  const agents = listAgents({ communityId: community, role, search });
  return response.json({ count: agents.length, agents });
});

app.get("/api/agents/:agentId", (request, response) => {
  const agent = getAgentById(request.params.agentId);
  if (!agent) {
    return response.status(404).json({ error: "Agent was not found." });
  }
  return response.json(agent);
});

app.get("/api/relationships", (request, response) => {
  const { agentId, community } = request.query;
  const allowedParams = new Set(["agentId", "community"]);
  if (Object.keys(request.query).some((key) => !allowedParams.has(key))) {
    return response.status(400).json({ error: "Relationship query contains an unsupported filter." });
  }
  if (agentId !== undefined && (typeof agentId !== "string" || !getAgentById(agentId))) {
    return response.status(400).json({ error: "Agent filter is not recognized." });
  }
  if (community !== undefined &&
      (typeof community !== "string" || !communityIds.has(community))) {
    return response.status(400).json({ error: "Community filter is not recognized." });
  }
  const relationships = listRelationships({ agentId, communityId: community });
  return response.json({
    count: relationships.length,
    summary: getSocialSummary(),
    relationships
  });
});

app.get("/api/social-interactions", (request, response) => {
  const { agentId, community, tick, limit } = request.query;
  const allowedParams = new Set(["agentId", "community", "tick", "limit"]);
  if (Object.keys(request.query).some((key) => !allowedParams.has(key))) {
    return response.status(400).json({ error: "Social query contains an unsupported filter." });
  }
  if (agentId !== undefined && (typeof agentId !== "string" || !getAgentById(agentId))) {
    return response.status(400).json({ error: "Agent filter is not recognized." });
  }
  if (community !== undefined &&
      (typeof community !== "string" || !communityIds.has(community))) {
    return response.status(400).json({ error: "Community filter is not recognized." });
  }
  const tickNumber = tick === undefined ? undefined : Number(tick);
  if (tick !== undefined && (!Number.isSafeInteger(tickNumber) || tickNumber < 1)) {
    return response.status(400).json({ error: "Tick filter must be a positive integer." });
  }
  const limitNumber = limit === undefined ? 50 : Number(limit);
  if (!Number.isSafeInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    return response.status(400).json({ error: "Social interaction limit must be from 1 to 100." });
  }
  return response.json(listSocialInteractions({
    agentId,
    communityId: community,
    tick: tickNumber,
    limit: limitNumber
  }));
});

app.get("/api/transactions", (request, response) => {
  const { agentId, tick, resource, limit } = request.query;
  const allowedParams = new Set(["agentId", "tick", "resource", "limit"]);
  if (Object.keys(request.query).some((key) => !allowedParams.has(key))) {
    return response.status(400).json({ error: "Transaction query contains an unsupported filter." });
  }
  if (agentId !== undefined && (typeof agentId !== "string" || !getAgentById(agentId))) {
    return response.status(400).json({ error: "Agent filter is not recognized." });
  }
  const tickNumber = tick === undefined ? undefined : Number(tick);
  if (tick !== undefined && (!Number.isSafeInteger(tickNumber) || tickNumber < 1)) {
    return response.status(400).json({ error: "Tick filter must be a positive integer." });
  }
  const resourceIds = new Set(world.resources.map(({ id }) => id));
  if (resource !== undefined && (typeof resource !== "string" || !resourceIds.has(resource))) {
    return response.status(400).json({ error: "Resource filter is not recognized." });
  }
  const limitNumber = limit === undefined ? 50 : Number(limit);
  if (!Number.isSafeInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    return response.status(400).json({ error: "Transaction limit must be from 1 to 100." });
  }
  return response.json(listTransactions({
    agentId,
    tick: tickNumber,
    resource,
    limit: limitNumber
  }));
});

app.post("/api/simulation/start", (request, response, next) => {
  try {
    requireRealtime(request);
    return response.json({ world: simulation.start() });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/simulation/pause", (request, response, next) => {
  try {
    requireRealtime(request);
    return response.json({ world: simulation.pause() });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/simulation/resume", (request, response, next) => {
  try {
    requireRealtime(request);
    return response.json({ world: simulation.resume() });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/simulation/step", (request, response, next) => {
  try {
    requireRealtime(request);
    return response.json(simulation.step());
  } catch (error) {
    return next(error);
  }
});

app.post("/api/simulation/reset", (request, response, next) => {
  try {
    const body = request.body === undefined ? {} : request.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => key !== "seed")) {
      return response.status(400).json({ error: "Reset accepts only an optional integer seed." });
    }
    if (body.seed !== undefined && !Number.isSafeInteger(body.seed)) {
      return response.status(400).json({ error: "Reset seed must be a safe integer." });
    }
    requireRealtime(request);
    return response.json({ world: simulation.reset(body.seed) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/simulation/speed", (request, response, next) => {
  try {
    const body = request.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).length !== 1 || !Object.hasOwn(body, "speedMultiplier")) {
      return response.status(400).json({ error: "Set speedMultiplier to a value from 0.5 to 4." });
    }
    if (typeof body.speedMultiplier !== "number" ||
        !Number.isFinite(body.speedMultiplier) ||
        body.speedMultiplier < 0.5 || body.speedMultiplier > 4) {
      return response.status(400).json({ error: "speedMultiplier must be a number from 0.5 to 4." });
    }
    requireRealtime(request);
    return response.json({ world: simulation.setSpeed(body.speedMultiplier) });
  } catch (error) {
    return next(error);
  }
});

app.use("/api", (_request, response) => {
  response.status(404).json({ error: "API route was not found." });
});

app.use(express.static(clientBuildDirectory, {
  maxAge: "1h",
  setHeaders(response, filePath) {
    if (path.basename(filePath) === "index.html") {
      response.setHeader("Cache-Control", "no-cache");
    }
  }
}));

app.get(/.*/, (request, response, next) => {
  if (request.path.startsWith("/socket.io") || !fs.existsSync(clientEntryPoint)) {
    return next();
  }
  return response.sendFile(clientEntryPoint, (error) => {
    if (error) next(error);
  });
});

app.use((error, _request, response, _next) => {
  if (error instanceof ExperimentStoreError) {
    return response.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof SimulationControlError) {
    return response.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return response.status(400).json({ error: "Request body must contain valid JSON." });
  }

  console.error(error);
  return response.status(500).json({ error: "An unexpected server error occurred." });
});

module.exports = app;
