const ACTION_TYPES = new Set(["rest", "plan", "observe", "trade", "socialize"]);
const HISTORY_LIMIT = 100;

function resolveAction(profile, priorState, action, observation, nextTick) {
  if (!ACTION_TYPES.has(action.type)) {
    throw new TypeError(`Agent ${profile.id} proposed an unsupported action.`);
  }
  if (action.type === "trade" && !action.tradeIntent) {
    throw new TypeError(`Agent ${profile.id} proposed a trade without a valid market order.`);
  }
  if (action.type === "socialize" &&
      (!action.socialIntent ||
       !observation.environment.socialPeers.some((peer) =>
         peer.id === action.socialIntent.targetId &&
         peer.name === action.socialIntent.targetName
       ))) {
    throw new TypeError(`Agent ${profile.id} proposed an invalid social interaction.`);
  }

  const state = {
    ...priorState,
    needs: { ...priorState.needs },
    resources: { ...priorState.resources },
    memory: {
      shortTerm: [...priorState.memory.shortTerm],
      longTerm: [...priorState.memory.longTerm]
    },
    learning: {
      ...priorState.learning,
      actionPerformance: { ...priorState.learning.actionPerformance }
    },
    relationships: [...priorState.relationships],
    socialHistory: [...priorState.socialHistory],
    decisionHistory: [...priorState.decisionHistory],
    tick: nextTick,
    status: "active"
  };
  let outcome;

  if (action.type === "rest") {
    state.energy = Math.min(100, state.energy + 8);
    state.needs.rest = Math.min(100, state.needs.rest + 12);
    state.wellbeing = Math.min(100, state.wellbeing + 1);
    state.currentFocus = "Recover energy";
    outcome = "Energy and rest improved.";
  } else if (action.type === "plan") {
    state.energy = Math.max(0, state.energy - 2);
    state.currentFocus = profile.goals.shortTerm[0];
    outcome = "Short-term goal selected as current focus.";
  } else if (action.type === "observe") {
    state.energy = Math.max(0, state.energy - 1);
    state.currentFocus = `Observe ${observation.environment.community.name}`;
    outcome = "Community observation recorded.";
  } else if (action.type === "trade") {
    state.currentFocus = `${action.tradeIntent.side} ${action.tradeIntent.resource}`;
    outcome = "Market order submitted.";
  } else {
    state.energy = Math.max(0, state.energy - 1);
    state.currentFocus = `Connect with ${action.socialIntent.targetName}`;
    outcome = `Social invitation sent to ${action.socialIntent.targetName}.`;
  }

  state.decisionHistory.push({
    tick: nextTick,
    action: action.type,
    utility: action.utility,
    reason: action.reason,
    outcome
  });
  if (state.decisionHistory.length > HISTORY_LIMIT) {
    state.decisionHistory = state.decisionHistory.slice(-HISTORY_LIMIT);
  }
  return state;
}

module.exports = { resolveAction };
