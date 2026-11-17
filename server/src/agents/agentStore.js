const world = require("../../../shared/world.json");
const { createInitialAgentRecords } = require("./agentFactory");
const { getSocialInteractionSummary } = require("../social/socialInteractionStore");
const AGENT_ACTIONS = new Set(["rest", "plan", "observe", "trade", "socialize"]);
const {
  BASE_PRICES,
  BUY_THRESHOLDS,
  SELL_THRESHOLDS,
  TRADEABLE_RESOURCES
} = require("../economy/marketRules");

const profilesById = new Map();
const statesByAgentId = new Map();
const communitiesById = new Map();

resetAgents(world.seed, world.communities);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toAgentView(profile) {
  const state = statesByAgentId.get(profile.id);
  const community = communitiesById.get(profile.communityId);
  return {
    ...clone(profile),
    community: {
      id: community.id,
      name: community.name
    },
    state: clone(state)
  };
}

function listAgents({ communityId, role, search } = {}) {
  const normalizedSearch = search ? search.trim().toLocaleLowerCase() : "";
  return Array.from(profilesById.values())
    .filter((profile) => !communityId || profile.communityId === communityId)
    .filter((profile) => !role || profile.role === role)
    .filter((profile) => {
      if (!normalizedSearch) return true;
      return `${profile.name} ${profile.roleLabel} ${profile.communityId}`
        .toLocaleLowerCase()
        .includes(normalizedSearch);
    })
    .map(toAgentView);
}

function getAgentById(agentId) {
  const profile = profilesById.get(agentId);
  return profile ? toAgentView(profile) : null;
}

function getPopulationSummary() {
  const byCommunity = Object.fromEntries(world.communities.map((community) => [
    community.id,
    Array.from(profilesById.values()).filter((profile) => profile.communityId === community.id).length
  ]));
  const states = Array.from(statesByAgentId.values());
  return {
    total: profilesById.size,
    active: states.filter((state) => state.status === "active").length,
    byCommunity
  };
}

function getResourceTotals() {
  const totals = Object.fromEntries(world.resources.map(({ id }) => [id, 0]));
  for (const state of statesByAgentId.values()) {
    for (const resource of Object.keys(totals)) {
      totals[resource] += state.resources[resource];
    }
  }
  return totals;
}

function listRelationships({ communityId, agentId } = {}) {
  const relationships = [];
  for (const profile of profilesById.values()) {
    if (communityId && profile.communityId !== communityId) continue;
    const state = statesByAgentId.get(profile.id);
    if (agentId && profile.id !== agentId &&
        !state.relationships.some((relationship) => relationship.agentId === agentId)) continue;
    for (const relationship of state.relationships) {
      if (profile.id >= relationship.agentId) continue;
      const otherProfile = profilesById.get(relationship.agentId);
      if (!otherProfile ||
          (agentId && profile.id !== agentId && otherProfile.id !== agentId)) continue;
      relationships.push({
        source: profile.id,
        sourceName: profile.name,
        target: otherProfile.id,
        targetName: otherProfile.name,
        communityId: profile.communityId,
        trust: relationship.trust,
        interactions: relationship.interactions,
        lastInteractionTick: relationship.lastInteractionTick,
        status: relationship.status
      });
    }
  }
  return relationships;
}

function getSocialSummary() {
  const relationships = listRelationships();
  const interactionSummary = getSocialInteractionSummary();
  return {
    relationships: relationships.length,
    ...interactionSummary,
    averageTrust: relationships.length
      ? Math.round(relationships.reduce((total, item) => total + item.trust, 0) /
        relationships.length * 100) / 100
      : 0
  };
}

function getMarketSummary(prices = BASE_PRICES) {
  const summary = Object.fromEntries(TRADEABLE_RESOURCES.map((resource) => [
    resource,
    { inventory: 0, potentialBuyers: 0, potentialSellers: 0 }
  ]));
  for (const state of statesByAgentId.values()) {
    for (const resource of TRADEABLE_RESOURCES) {
      const quantity = state.resources[resource];
      summary[resource].inventory += quantity;
      if (quantity <= BUY_THRESHOLDS[resource] &&
          state.resources.money >= prices[resource]) {
        summary[resource].potentialBuyers += 1;
      }
      if (quantity > SELL_THRESHOLDS[resource]) {
        summary[resource].potentialSellers += 1;
      }
    }
  }
  return summary;
}

function getAgentRecords() {
  return Array.from(profilesById.values(), (profile) => ({
    profile: clone(profile),
    state: clone(statesByAgentId.get(profile.id))
  }));
}

function replaceAgentStates(updates) {
  if (!Array.isArray(updates) || updates.length !== profilesById.size) {
    throw new TypeError("A tick must provide one updated state for every agent.");
  }

  const prepared = updates.map(({ agentId, state }) => {
    const profile = profilesById.get(agentId);
    if (!profile || !state || state.agentId !== agentId) {
      throw new TypeError("Agent state update references an unknown agent.");
    }
    if (!Number.isSafeInteger(state.tick) || state.tick < 0 ||
        !Number.isFinite(state.energy) || state.energy < 0 || state.energy > 100 ||
        !Number.isFinite(state.wellbeing) || state.wellbeing < 0 || state.wellbeing > 100) {
      throw new TypeError(`Agent ${agentId} has invalid simulation state.`);
    }
    for (const [resource, quantity] of Object.entries(state.resources)) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        throw new TypeError(`Agent ${agentId} has an invalid ${resource} balance.`);
      }
    }
    for (const [need, value] of Object.entries(state.needs)) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new TypeError(`Agent ${agentId} has an invalid ${need} need level.`);
      }
    }
    if (!Array.isArray(state.decisionHistory)) {
      throw new TypeError(`Agent ${agentId} has invalid decision history.`);
    }
    if (!Array.isArray(state.relationships) || !Array.isArray(state.socialHistory)) {
      throw new TypeError(`Agent ${agentId} has invalid social state.`);
    }
    if (!state.memory || !Array.isArray(state.memory.shortTerm) ||
        !Array.isArray(state.memory.longTerm) ||
        state.memory.shortTerm.length > 12 || state.memory.longTerm.length > 20) {
      throw new TypeError(`Agent ${agentId} has invalid memory state.`);
    }
    if (!state.learning || typeof state.learning.actionPerformance !== "object" ||
        Array.isArray(state.learning.actionPerformance) ||
        !state.learning.actionPerformance ||
        !Number.isSafeInteger(state.learning.reflections) ||
        state.learning.reflections < 0 ||
        !Number.isSafeInteger(state.learning.strategyAdjustments) ||
        state.learning.strategyAdjustments < 0 ||
        (state.learning.preferredAction !== null &&
          !AGENT_ACTIONS.has(state.learning.preferredAction)) ||
        (state.learning.lastReflectionTick !== null &&
          (!Number.isSafeInteger(state.learning.lastReflectionTick) ||
           state.learning.lastReflectionTick < 1 ||
           state.learning.lastReflectionTick > state.tick))) {
      throw new TypeError(`Agent ${agentId} has invalid learning state.`);
    }
    for (const [action, result] of Object.entries(state.learning.actionPerformance)) {
      if (!result || typeof result !== "object" || Array.isArray(result) ||
          !AGENT_ACTIONS.has(action) ||
          !Number.isSafeInteger(result.attempts) || result.attempts < 1 ||
          !Number.isSafeInteger(result.successes) || result.successes < 0 ||
          result.successes > result.attempts) {
        throw new TypeError(`Agent ${agentId} has invalid action performance.`);
      }
    }
    for (const experience of state.memory.shortTerm) {
      if (experience.type !== "experience" ||
          !Number.isSafeInteger(experience.tick) ||
          experience.tick < 1 || experience.tick > state.tick ||
          !AGENT_ACTIONS.has(experience.action) ||
          !Number.isFinite(experience.utility) ||
          typeof experience.successful !== "boolean" ||
          typeof experience.outcome !== "string" ||
          !Number.isSafeInteger(experience.stressors) ||
          experience.stressors < 0) {
        throw new TypeError(`Agent ${agentId} has an invalid short-term memory.`);
      }
    }
    for (const reflection of state.memory.longTerm) {
      if (reflection.type !== "reflection" ||
          !Number.isSafeInteger(reflection.tick) ||
          reflection.tick < 1 || reflection.tick > state.tick ||
          !AGENT_ACTIONS.has(reflection.action) ||
          !Number.isSafeInteger(reflection.attempts) || reflection.attempts < 1 ||
          !Number.isFinite(reflection.successRate) ||
          reflection.successRate < 0 || reflection.successRate > 100 ||
          typeof reflection.insight !== "string") {
        throw new TypeError(`Agent ${agentId} has an invalid long-term memory.`);
      }
    }
    const relationshipIds = new Set();
    for (const relationship of state.relationships) {
      if (!profilesById.has(relationship.agentId) ||
          profilesById.get(relationship.agentId).communityId !== profile.communityId ||
          relationship.agentId === agentId ||
          relationshipIds.has(relationship.agentId) ||
          !Number.isFinite(relationship.trust) ||
          relationship.trust < 0 || relationship.trust > 100 ||
          !Number.isSafeInteger(relationship.interactions) ||
          relationship.interactions < 1 ||
          !Number.isSafeInteger(relationship.lastInteractionTick) ||
          relationship.lastInteractionTick < 1 ||
          relationship.lastInteractionTick > state.tick ||
          !["cautious", "acquaintance", "trusted"].includes(relationship.status)) {
        throw new TypeError(`Agent ${agentId} has an invalid relationship.`);
      }
      relationshipIds.add(relationship.agentId);
    }
    for (const interaction of state.socialHistory) {
      if (!profilesById.has(interaction.partnerId) ||
          profilesById.get(interaction.partnerId).communityId !== profile.communityId ||
          typeof interaction.interactionId !== "string" ||
          typeof interaction.partnerName !== "string" ||
          !["accepted", "declined", "unmatched"].includes(interaction.outcome) ||
          !Number.isFinite(interaction.trustChange) ||
          !Number.isSafeInteger(interaction.tick) ||
          interaction.tick < 1 || interaction.tick > state.tick ||
          typeof interaction.accepted !== "boolean" ||
          typeof interaction.initiated !== "boolean") {
        throw new TypeError(`Agent ${agentId} has an invalid social history entry.`);
      }
    }
    return [agentId, clone(state)];
  });

  const preparedById = new Map(prepared);
  for (const [agentId, state] of prepared) {
    for (const relationship of state.relationships) {
      const counterpart = preparedById.get(relationship.agentId);
      const reciprocal = counterpart?.relationships.find((item) => item.agentId === agentId);
      if (!reciprocal ||
          reciprocal.trust !== relationship.trust ||
          reciprocal.interactions !== relationship.interactions ||
          reciprocal.lastInteractionTick !== relationship.lastInteractionTick ||
          reciprocal.status !== relationship.status) {
        throw new TypeError(`Agent ${agentId} has a non-reciprocal relationship.`);
      }
    }
  }

  for (const [agentId, state] of prepared) {
    statesByAgentId.set(agentId, state);
  }
}

function resetAgents(seed, communities, generationOptions) {
  const records = createInitialAgentRecords(seed, communities, generationOptions);
  profilesById.clear();
  statesByAgentId.clear();
  communitiesById.clear();
  for (const profile of records.profiles) profilesById.set(profile.id, profile);
  for (const state of records.states) statesByAgentId.set(state.agentId, state);
  for (const community of communities) communitiesById.set(community.id, community);
}

module.exports = {
  getAgentById,
  getAgentRecords,
  getPopulationSummary,
  getMarketSummary,
  getResourceTotals,
  getSocialSummary,
  listRelationships,
  listAgents,
  replaceAgentStates,
  resetAgents
};
