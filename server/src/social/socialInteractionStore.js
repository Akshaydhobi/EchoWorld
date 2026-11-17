let interactions = [];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recordSocialInteractions(events) {
  if (!Array.isArray(events)) {
    throw new TypeError("Social interaction ledger accepts an array.");
  }
  interactions.push(...events.map(clone));
}

function listSocialInteractions({ agentId, communityId, tick, limit = 50 } = {}) {
  const matching = interactions.filter((interaction) =>
    (!agentId || interaction.proposerId === agentId || interaction.targetId === agentId) &&
    (!communityId || interaction.communityId === communityId) &&
    (tick === undefined || interaction.tick === tick)
  );
  return {
    count: matching.length,
    interactions: matching.slice(-limit).reverse().map(clone)
  };
}

function getSocialInteractionSummary() {
  return {
    proposals: interactions.length,
    interactions: interactions.filter((interaction) => interaction.accepted).length
  };
}

function resetSocialInteractions() {
  interactions = [];
}

module.exports = {
  getSocialInteractionSummary,
  listSocialInteractions,
  recordSocialInteractions,
  resetSocialInteractions
};
