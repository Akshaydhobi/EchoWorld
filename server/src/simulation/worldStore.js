const initialWorld = require("../../../shared/world.json");
const {
  getMarketSummary,
  getPopulationSummary,
  getResourceTotals,
  getSocialSummary,
  resetAgents
} = require("../agents/agentStore");
const { BASE_PRICES } = require("../economy/marketRules");
const { applyMarketPriceEvents } = require("../events/eventEffects");
const {
  getActiveEvents,
  getEventSummary,
  resetEvents
} = require("../events/eventStore");
const { getTransactionCount } = require("../economy/transactionStore");

let worldState = createInitialWorld(initialWorld.seed);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialWorld(seed) {
  return {
    ...clone(initialWorld),
    seed,
    tick: 0,
    simulationStatus: "not-started",
    speedMultiplier: 1,
    lastError: null,
    lastTickMetrics: null
  };
}

function getWorld(tick = worldState.tick) {
  const activeEvents = getActiveEvents(tick);
  const baseMarketPrices = worldState.lastTickMetrics?.baseMarketPrices ||
    worldState.lastTickMetrics?.marketPrices ||
    BASE_PRICES;
  const marketPrices = applyMarketPriceEvents(baseMarketPrices, activeEvents);
  return {
    ...clone(worldState),
    tick,
    population: getPopulationSummary(),
    resourceTotals: getResourceTotals(),
    socialSummary: getSocialSummary(),
    eventSummary: getEventSummary(),
    activeEvents,
    marketPrices,
    marketSummary: getMarketSummary(marketPrices),
    transactionCount: getTransactionCount()
  };
}

function setSimulationStatus(status) {
  if (!["not-started", "running", "paused"].includes(status)) {
    throw new TypeError("Simulation status is not recognized.");
  }
  worldState.simulationStatus = status;
}

function setSpeedMultiplier(speedMultiplier) {
  if (!Number.isFinite(speedMultiplier) || speedMultiplier < 0.5 || speedMultiplier > 4) {
    throw new RangeError("Simulation speed must be between 0.5x and 4x.");
  }
  worldState.speedMultiplier = speedMultiplier;
}

function advanceTick(metrics) {
  worldState.tick += 1;
  worldState.lastError = null;
  worldState.lastTickMetrics = clone(metrics);
  return getWorld();
}

function setRuntimeError(errorMessage) {
  worldState.lastError = errorMessage;
}

function resetWorld(seed = initialWorld.seed, agentGenerationOptions) {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("World seed must be a safe integer.");
  }
  resetEvents();
  resetAgents(seed, initialWorld.communities, agentGenerationOptions);
  worldState = createInitialWorld(seed);
  return getWorld();
}

module.exports = {
  advanceTick,
  getWorld,
  resetWorld,
  setRuntimeError,
  setSimulationStatus,
  setSpeedMultiplier
};
