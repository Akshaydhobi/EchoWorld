const ACTION_ORDER = ["rest", "trade", "socialize", "plan", "observe"];
const { getTradeIntent } = require("../economy/marketRules");
const { getUtilityAdjustment } = require("./memoryEngine");

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function chooseSocialIntent(observation, random) {
  const peers = observation.environment.socialPeers || [];
  if (!peers.length) return null;
  const self = observation.self;
  return peers
    .map((peer) => ({
      ...peer,
      selectionScore: (peer.knownTrust ?? 40) / 10 + random()
    }))
    .sort((left, right) => right.selectionScore - left.selectionScore)[0];
}

function createCandidates(observation, random) {
  const { self, environment } = observation;
  const curiosity = self.personality.curiosity;
  const adaptability = self.personality.adaptability;
  const riskTolerance = self.personality.riskTolerance;
  const resourceSaving = self.personality.resourceSavingPreference;
  const goal = self.goals.shortTerm[0];
  const alreadyPlanning = self.currentFocus === goal;
  const relevantEvents = (environment.activeEvents || []).filter((event) =>
    !event.communityId || event.communityId === self.communityId
  );
  const disruptionSeverity = relevantEvents
    .filter((event) => [
      "weather-disruption",
      "energy-shortage",
      "resource-scarcity",
      "infrastructure-problem"
    ].includes(event.type))
    .reduce((severity, event) => severity + event.severity, 0);
  const opportunitySeverity = relevantEvents
    .filter((event) => [
      "technology-discovery",
      "business-opportunity"
    ].includes(event.type))
    .reduce((severity, event) => severity + event.severity, 0);
  const eventAttention = relevantEvents.reduce(
    (severity, event) => severity + event.severity,
    0
  );
  const tradeIntent = getTradeIntent(observation);
  const socialIntent = chooseSocialIntent(observation, random);
  const adjustment = (action) =>
    getUtilityAdjustment(self.learning, action, adaptability);
  const tradeUtility = tradeIntent
    ? tradeIntent.side === "buy"
      ? 40 + tradeIntent.shortage * 8 + self.personality.riskTolerance * 8 +
        Math.min(tradeIntent.counterpartyCount, 4) * 2
      : 32 + self.personality.cooperation * 16 +
        self.personality.riskTolerance * 8 -
        self.personality.resourceSavingPreference * 8 +
        Math.min(tradeIntent.counterpartyCount, 6) * 4 +
        (self.role === "trader" ? 12 : 0)
    : 0;

  return [
    {
      type: "rest",
      utility: clamp(
        15 + (100 - self.energy) * 0.7 + (100 - self.needs.rest) * 0.5 +
        adjustment("rest")
      ),
      reason: "Recover energy and improve rest."
    },
    {
      type: "plan",
      utility: clamp(
        18 + curiosity * 15 + adaptability * 32 + resourceSaving * 8 +
        (100 - self.wellbeing) * 0.08 - (alreadyPlanning ? 12 : 0) +
        disruptionSeverity * 3 + opportunitySeverity * 2 +
        adjustment("plan")
      ),
      reason: `Plan toward the short-term goal: ${goal}${relevantEvents.length
        ? ` while accounting for ${relevantEvents.length} active world event(s)`
        : ""}.`
    },
    {
      type: "observe",
      utility: clamp(
        12 + curiosity * 42 + riskTolerance * 12 + (1 - adaptability) * 12 +
        Math.min(environment.community.facilities.length, 6) +
        eventAttention * 2 +
        adjustment("observe")
      ),
      reason: `Observe conditions in ${environment.community.name}${relevantEvents.length
        ? ` and assess ${relevantEvents.length} active world event(s)`
        : ""}.`
    },
    {
      type: "socialize",
      utility: socialIntent
        ? clamp(
          16 + self.personality.cooperation * 38 +
          (100 - (self.needs.social ?? 70)) * 0.45 +
          (socialIntent.knownTrust === null ? 5 : socialIntent.knownTrust * 0.08) +
          adjustment("socialize")
        )
        : 0,
      reason: socialIntent
        ? `Build trust with ${socialIntent.name}.`
        : "No neighbors are available for a social interaction.",
      socialIntent: socialIntent
        ? { targetId: socialIntent.id, targetName: socialIntent.name }
        : null
    },
    {
      type: "trade",
      utility: tradeIntent ? clamp(tradeUtility + adjustment("trade")) : 0,
      reason: tradeIntent
        ? `${tradeIntent.side === "buy" ? "Seek" : "Offer"} ${tradeIntent.resource} at the market.`
        : "No market order is affordable or needed.",
        tradeIntent
    }
  ];
}

function selectAction(observation, random) {
  const candidates = createCandidates(observation, random).map((candidate) => ({
    ...candidate,
    tieBreak: random()
  }));
  candidates.sort((left, right) =>
    (right.utility + right.tieBreak / 1000) -
      (left.utility + left.tieBreak / 1000) ||
    ACTION_ORDER.indexOf(left.type) - ACTION_ORDER.indexOf(right.type)
  );
  const { type, utility, reason, tradeIntent, socialIntent } = candidates[0];
  return {
    type,
    utility: Math.round(utility * 100) / 100,
    reason,
    tradeIntent,
    socialIntent,
    alternatives: candidates.map(({ type: action, utility: score }) => ({
      action,
      utility: Math.round(score * 100) / 100
    }))
  };
}

module.exports = { selectAction };
