const SHORT_TERM_LIMIT = 12;
const LONG_TERM_LIMIT = 20;
const REFLECTION_INTERVAL = 5;

function getActionSuccess(action, outcome, socialEvent) {
  if (action === "trade") {
    return outcome.startsWith("Bought 1 ") || outcome.startsWith("Sold 1 ");
  }
  if (action === "socialize") return socialEvent?.accepted === true;
  return true;
}

function updatePerformance(learning, action, successful) {
  const previous = learning.actionPerformance[action] || {
    attempts: 0,
    successes: 0
  };
  learning.actionPerformance[action] = {
    attempts: previous.attempts + 1,
    successes: previous.successes + Number(successful)
  };

  const previousPreferredAction = learning.preferredAction;
  const candidates = Object.entries(learning.actionPerformance)
    .filter(([, result]) => result.attempts >= 2)
    .sort((left, right) =>
      right[1].successes / right[1].attempts -
        left[1].successes / left[1].attempts ||
      right[1].attempts - left[1].attempts ||
      left[0].localeCompare(right[0])
    );
  learning.preferredAction = candidates[0]?.[0] || null;
  if (learning.preferredAction !== previousPreferredAction) {
    learning.strategyAdjustments += 1;
  }
}

function createReflection(state, tick) {
  const recent = state.memory.shortTerm.slice(-REFLECTION_INTERVAL);
  const grouped = new Map();
  for (const experience of recent) {
    const result = grouped.get(experience.action) || { attempts: 0, successes: 0 };
    result.attempts += 1;
    result.successes += Number(experience.successful);
    grouped.set(experience.action, result);
  }
  const focus = [...grouped.entries()].sort((left, right) =>
    right[1].attempts - left[1].attempts ||
    left[0].localeCompare(right[0])
  )[0];
  if (!focus) return null;

  const [action, result] = focus;
  const successRate = Math.round(result.successes / result.attempts * 100);
  const insight = successRate >= 70
    ? `Recent ${action} outcomes were usually effective; keep this option available.`
    : successRate <= 30
      ? `Recent ${action} outcomes were rarely effective; consider another approach.`
      : `Recent ${action} outcomes were mixed; gather more evidence before changing course.`;
  return {
    tick,
    type: "reflection",
    action,
    attempts: result.attempts,
    successRate,
    insight
  };
}

function recordExperiences(decisions, states, transactions, socialEvents, tick) {
  const decisionsById = new Map(decisions.map((decision) => [decision.agentId, decision]));
  const socialEventsByProposer = new Map(
    socialEvents.map((event) => [event.proposerId, event])
  );
  const blockedConsumptionByAgent = new Map();
  for (const transaction of transactions) {
    if (transaction.type === "consumption" && transaction.status === "blocked") {
      blockedConsumptionByAgent.set(
        transaction.from,
        (blockedConsumptionByAgent.get(transaction.from) || 0) + 1
      );
    }
  }

  for (const { agentId, state } of states) {
    const decision = decisionsById.get(agentId);
    const latestDecision = state.decisionHistory.at(-1);
    const socialEvent = socialEventsByProposer.get(agentId);
    const successful = getActionSuccess(
      decision.action.type,
      latestDecision.outcome,
      socialEvent
    );
    const stressors = blockedConsumptionByAgent.get(agentId) || 0;
    const experience = {
      tick,
      type: "experience",
      action: decision.action.type,
      utility: latestDecision.utility,
      outcome: latestDecision.outcome,
      successful,
      stressors
    };

    state.memory = {
      shortTerm: [...state.memory.shortTerm, experience].slice(-SHORT_TERM_LIMIT),
      longTerm: [...state.memory.longTerm]
    };
    state.learning = {
      ...state.learning,
      actionPerformance: { ...state.learning.actionPerformance }
    };
    updatePerformance(state.learning, experience.action, successful);
    if (tick % REFLECTION_INTERVAL === 0) {
      const reflection = createReflection(state, tick);
      if (reflection) {
        state.memory.longTerm.push(reflection);
        state.memory.longTerm = state.memory.longTerm.slice(-LONG_TERM_LIMIT);
        state.learning.reflections += 1;
        state.learning.lastReflectionTick = tick;
      }
    }
  }
  return states;
}

function getUtilityAdjustment(learning, action, adaptability) {
  const performance = learning?.actionPerformance?.[action];
  if (!performance || performance.attempts < 2) return 0;
  const successRate = performance.successes / performance.attempts;
  return (successRate - 0.5) * 12 * adaptability;
}

module.exports = {
  getActionSuccess,
  getUtilityAdjustment,
  recordExperiences
};
