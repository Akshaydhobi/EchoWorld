const { getAgentRecords, replaceAgentStates } = require("../agents/agentStore");
const { createRandom } = require("./seededRandom");
const { createObservation } = require("./perceptionEngine");
const { selectAction } = require("./decisionEngine");
const { resolveAction } = require("./actionEngine");
const worldStore = require("./worldStore");
const { resolveEconomy } = require("../economy/economyEngine");
const { recordTransactions } = require("../economy/transactionStore");
const { resolveSocialInteractions } = require("./socialInteractionEngine");
const { recordSocialInteractions } = require("../social/socialInteractionStore");
const { getActionSuccess, recordExperiences } = require("./memoryEngine");
const { advanceEvents } = require("../events/eventStore");

function stepSimulation({ memoryEnabled = true, coordinationMode = "decentralized" } = {}) {
  if (typeof memoryEnabled !== "boolean") {
    throw new TypeError("Memory setting must be a boolean.");
  }
  if (!["centralized", "decentralized"].includes(coordinationMode)) {
    throw new TypeError("Coordination mode must be centralized or decentralized.");
  }
  const priorWorld = worldStore.getWorld();
  const nextTick = priorWorld.tick + 1;
  const eventUpdate = advanceEvents(priorWorld.seed, nextTick);
  const world = worldStore.getWorld(nextTick);
  const agentRecords = getAgentRecords();
  const decisions = agentRecords.map(({ profile, state }) => {
    const observation = createObservation(profile, state, world, agentRecords);
    const agentNumber = Number(profile.id.slice("agent-".length));
    const random = createRandom(
      (world.seed + priorWorld.tick * 4099 + agentNumber * 65537) | 0
    );
    const action = selectAction(observation, random);
    return {
      profile,
      agentId: profile.id,
      state: resolveAction(profile, state, action, observation, nextTick),
      action
    };
  });

  const actionCounts = {};
  for (const decision of decisions) {
    actionCounts[decision.action.type] = (actionCounts[decision.action.type] || 0) + 1;
  }

  const social = resolveSocialInteractions(decisions, nextTick, world.seed);
  const economy = resolveEconomy(decisions, nextTick, eventUpdate.activeEvents, {
    coordinationMode
  });
  const decisionsById = new Map(decisions.map((decision) => [decision.agentId, decision]));
  const socialEventsByProposer = new Map(
    social.events.map((event) => [event.proposerId, event])
  );
  const successfulDecisions = economy.states.filter(({ agentId, state }) => {
    const decision = decisionsById.get(agentId);
    return getActionSuccess(
      decision.action.type,
      state.decisionHistory.at(-1).outcome,
      socialEventsByProposer.get(agentId)
    );
  }).length;
  if (memoryEnabled) {
    recordExperiences(
      decisions,
      economy.states,
      economy.transactions,
      social.events,
      nextTick
    );
  }
  replaceAgentStates(economy.states);
  recordTransactions(economy.transactions);
  recordSocialInteractions(social.events);
  const metrics = {
    tick: nextTick,
    decisions: decisions.length,
    successfulDecisions,
    decisionSuccessRate: Math.round(
      successfulDecisions / decisions.length * 10000
    ) / 100,
    reflections: economy.states.filter((item) =>
      item.state.learning.lastReflectionTick === nextTick
    ).length,
    generatedEvents: eventUpdate.generatedEvent ? [eventUpdate.generatedEvent] : [],
    resolvedEvents: eventUpdate.resolvedEvents,
    activeEventCount: eventUpdate.activeEvents.length,
    actionCounts,
    socialEvents: social.events,
    ...social.metrics,
    ...economy.metrics
  };
  const agentUpdates = economy.states.map(({ agentId, state }) => ({
    id: agentId,
    state: {
      tick: state.tick,
      status: state.status,
      needs: state.needs,
      resources: state.resources,
      energy: state.energy,
      wellbeing: state.wellbeing,
      currentFocus: state.currentFocus,
      relationships: state.relationships,
      socialHistory: state.socialHistory,
      memory: state.memory,
      learning: state.learning,
      decisionHistory: state.decisionHistory
    }
  }));
  return { world: worldStore.advanceTick(metrics), metrics, agentUpdates };
}

module.exports = { stepSimulation };
