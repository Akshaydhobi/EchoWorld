const world = require("../../../shared/world.json");
const { TRADEABLE_RESOURCES } = require("../economy/marketRules");
const { createRandom } = require("../simulation/seededRandom");

const EVENT_DEFINITIONS = {
  "weather-disruption": {
    title: "Weather disruption",
    description: "Severe weather is slowing food production."
  },
  "energy-shortage": {
    title: "Energy shortage",
    description: "An energy shortage is reducing local energy production."
  },
  "resource-scarcity": {
    title: "Resource scarcity",
    description: "A supply disruption is constraining resource production."
  },
  "market-change": {
    title: "Market shift",
    description: "A market shift is changing the resource price."
  },
  "technology-discovery": {
    title: "Technology discovery",
    description: "A new discovery is improving knowledge production."
  },
  "business-opportunity": {
    title: "Business opportunity",
    description: "A new opportunity is creating income for local businesses."
  },
  "infrastructure-problem": {
    title: "Infrastructure problem",
    description: "Infrastructure repairs are slowing local production."
  }
};

const COMMUNITY_BY_ID = new Map(world.communities.map((community) => [
  community.id,
  community.name
]));
const COMMUNITY_IDS = new Set(COMMUNITY_BY_ID.keys());
const RESOURCE_IDS = new Set(TRADEABLE_RESOURCES);
const MAX_ACTIVE_EVENTS = 3;
const AUTOMATIC_EVENT_CHANCE = 0.12;

let events = [];
let manualSequence = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDescription(type, { communityId, resource, direction }) {
  const place = communityId ? COMMUNITY_BY_ID.get(communityId) : "all communities";
  const resourceName = resource || "a resource";
  switch (type) {
    case "weather-disruption":
      return `Severe weather is slowing farm food production in ${place}.`;
    case "energy-shortage":
      return `An energy shortage is reducing engineer output in ${place}.`;
    case "resource-scarcity":
      return `A supply disruption is constraining ${resourceName} production in ${place}.`;
    case "market-change":
      return `The ${resourceName} market is experiencing a ${direction}.`;
    case "technology-discovery":
      return `A discovery is improving knowledge production in ${place}.`;
    case "business-opportunity":
      return `A new business opportunity is creating income in ${place}.`;
    case "infrastructure-problem":
      return `Infrastructure repairs are slowing production in ${place}.`;
    default:
      throw new TypeError("Event type is not recognized.");
  }
}

function getEffects(type, severity, direction) {
  switch (type) {
    case "weather-disruption":
      return { foodProductionMultiplier: 1 - severity * 0.1 };
    case "energy-shortage":
      return { energyProductionMultiplier: 1 - severity * 0.15 };
    case "resource-scarcity":
      return { resourceProductionMultiplier: 1 - severity * 0.15 };
    case "market-change":
      return {
        priceMultiplier: direction === "surge"
          ? 1 + severity * 0.1
          : 1 - severity * 0.1
      };
    case "technology-discovery":
      return { knowledgeProductionMultiplier: 1 + severity * 0.15 };
    case "business-opportunity":
      return { moneyBonus: severity * 2 };
    case "infrastructure-problem":
      return { productionMultiplier: 1 - severity * 0.15 };
    default:
      throw new TypeError("Event type is not recognized.");
  }
}

function createEvent({
  type,
  severity,
  duration,
  communityId,
  resource,
  direction,
  source,
  createdTick,
  startsAtTick,
  sequence
}) {
  const definition = EVENT_DEFINITIONS[type];
  if (!definition) throw new TypeError("Event type is not recognized.");
  const scope = { communityId, resource, direction };
  const id = source === "manual"
    ? `manual-${String(sequence).padStart(4, "0")}`
    : `environment-${createdTick}-${type}`;
  const event = {
    id,
    type,
    title: definition.title,
    description: getDescription(type, scope),
    severity,
    duration,
    communityId: communityId || null,
    resource: resource || null,
    direction: direction || null,
    source,
    createdTick,
    startsAtTick,
    expiresTick: startsAtTick + duration - 1,
    status: startsAtTick > createdTick ? "scheduled" : "active",
    effects: getEffects(type, severity, direction)
  };
  events.push(event);
  return clone(event);
}

function validateEventInput(input) {
  const allowedFields = new Set([
    "type",
    "severity",
    "duration",
    "communityId",
    "resource",
    "direction"
  ]);
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !allowedFields.has(key))) {
    throw new TypeError("Event request contains unsupported fields.");
  }
  if (typeof input.type !== "string" || !EVENT_DEFINITIONS[input.type]) {
    throw new TypeError("Event type is not recognized.");
  }
  const severity = input.severity === undefined ? 2 : input.severity;
  const duration = input.duration === undefined ? 3 : input.duration;
  if (!Number.isSafeInteger(severity) || severity < 1 || severity > 3) {
    throw new TypeError("Event severity must be an integer from 1 to 3.");
  }
  if (!Number.isSafeInteger(duration) || duration < 1 || duration > 10) {
    throw new TypeError("Event duration must be an integer from 1 to 10 ticks.");
  }
  if (input.communityId !== undefined &&
      (typeof input.communityId !== "string" || !COMMUNITY_IDS.has(input.communityId))) {
    throw new TypeError("Event community is not recognized.");
  }
  if (input.resource !== undefined &&
      (typeof input.resource !== "string" || !RESOURCE_IDS.has(input.resource))) {
    throw new TypeError("Event resource is not recognized.");
  }
  if (["resource-scarcity", "market-change"].includes(input.type) && !input.resource) {
    throw new TypeError(`${EVENT_DEFINITIONS[input.type].title} requires a resource.`);
  }
  if (input.type === "market-change" && input.communityId !== undefined) {
    throw new TypeError("Market changes currently apply citywide and cannot be community-scoped.");
  }
  if (input.direction !== undefined &&
      !["surge", "drop"].includes(input.direction)) {
    throw new TypeError("Market direction must be surge or drop.");
  }
  if (input.type === "market-change" && !input.direction) {
    throw new TypeError("Market changes require a surge or drop direction.");
  }
  if (input.type !== "market-change" && input.direction !== undefined) {
    throw new TypeError("Direction is only supported for market-change events.");
  }
  return {
    type: input.type,
    severity,
    duration,
    communityId: input.communityId,
    resource: input.resource,
    direction: input.direction
  };
}

function createManualEvent(input, currentTick) {
  const eventData = validateEventInput(input);
  manualSequence += 1;
  return createEvent({
    ...eventData,
    source: "manual",
    createdTick: currentTick,
    startsAtTick: currentTick + 1,
    sequence: manualSequence
  });
}

function advanceEvents(seed, tick) {
  for (const event of events) {
    if (event.status === "scheduled" && event.startsAtTick <= tick) {
      event.status = "active";
    }
    if (event.status === "active" && event.expiresTick < tick) {
      event.status = "resolved";
    }
  }

  const active = events.filter((event) => event.status === "active");
  let generated = null;
  if (active.length < MAX_ACTIVE_EVENTS) {
    const random = createRandom((seed ^ (tick * 7919)) | 0);
    if (random() < AUTOMATIC_EVENT_CHANCE) {
      const typeIds = Object.keys(EVENT_DEFINITIONS);
      const type = typeIds[Math.floor(random() * typeIds.length)];
      const communityId = world.communities[
        Math.floor(random() * world.communities.length)
      ].id;
      const resource = TRADEABLE_RESOURCES[
        Math.floor(random() * TRADEABLE_RESOURCES.length)
      ];
      const direction = random() < 0.5 ? "surge" : "drop";
      const duration = 2 + Math.floor(random() * 3);
      const severity = 1 + Math.floor(random() * 3);
      const requiredResource = ["resource-scarcity", "market-change"].includes(type)
        ? resource
        : undefined;
      generated = createEvent({
        type,
        severity,
        duration,
        communityId,
        resource: requiredResource,
        direction: type === "market-change" ? direction : undefined,
        source: "environment",
        createdTick: tick,
        startsAtTick: tick
      });
    }
  }

  return {
    activeEvents: getActiveEvents(tick),
    generatedEvent: generated,
    resolvedEvents: events
      .filter((event) => event.status === "resolved" && event.expiresTick === tick - 1)
      .map(clone)
  };
}

function getActiveEvents(tick) {
  return events
    .filter((event) =>
      event.status === "active" &&
      event.startsAtTick <= tick &&
      event.expiresTick >= tick
    )
    .map(clone);
}

function listEvents({ type, communityId, status, source, limit = 50 } = {}) {
  const matching = events.filter((event) =>
    (!type || event.type === type) &&
    (!communityId || event.communityId === communityId) &&
    (!status || event.status === status) &&
    (!source || event.source === source)
  );
  return {
    count: matching.length,
    events: matching.slice(-limit).reverse().map(clone)
  };
}

function getEventSummary() {
  return {
    total: events.length,
    active: events.filter((event) => event.status === "active").length,
    scheduled: events.filter((event) => event.status === "scheduled").length,
    manual: events.filter((event) => event.source === "manual").length,
    environmental: events.filter((event) => event.source === "environment").length
  };
}

function resetEvents() {
  events = [];
  manualSequence = 0;
}

module.exports = {
  EVENT_DEFINITIONS,
  advanceEvents,
  createManualEvent,
  getActiveEvents,
  getEventSummary,
  listEvents,
  resetEvents,
  validateEventInput
};
