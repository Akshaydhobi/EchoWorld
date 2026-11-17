const { createRandom } = require("./seededRandom");

const HISTORY_LIMIT = 100;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getRelationship(state, agentId) {
  return state.relationships.find((relationship) => relationship.agentId === agentId);
}

function relationshipStatus(trust) {
  if (trust >= 75) return "trusted";
  if (trust >= 45) return "acquaintance";
  return "cautious";
}

function updateRelationship(state, agentId, trust, tick) {
  const existing = getRelationship(state, agentId);
  const relationship = {
    agentId,
    trust,
    interactions: (existing?.interactions || 0) + 1,
    lastInteractionTick: tick,
    status: relationshipStatus(trust)
  };
  if (existing) {
    Object.assign(existing, relationship);
  } else {
    state.relationships.push(relationship);
  }
}

function addSocialHistory(state, event, partnerId, partnerName, initiated) {
  state.socialHistory.push({
    interactionId: event.id,
    tick: event.tick,
    partnerId,
    partnerName,
    initiated,
    accepted: event.accepted,
    outcome: event.outcome,
    trustChange: event.trustChange
  });
  if (state.socialHistory.length > HISTORY_LIMIT) {
    state.socialHistory = state.socialHistory.slice(-HISTORY_LIMIT);
  }
}

function averageTrust(decisions) {
  const trustValues = [];
  for (const decision of decisions) {
    for (const relationship of decision.state.relationships) {
      if (decision.agentId < relationship.agentId) trustValues.push(relationship.trust);
    }
  }
  return trustValues.length
    ? Math.round(trustValues.reduce((total, trust) => total + trust, 0) / trustValues.length * 100) / 100
    : 0;
}

function createAcceptanceRandom(seed, tick, proposerId, targetId) {
  const proposerNumber = Number(proposerId.slice("agent-".length));
  const targetNumber = Number(targetId.slice("agent-".length));
  return createRandom(
    (seed ^ (tick * 4099) ^ (proposerNumber * 65537) ^ (targetNumber * 131071)) | 0
  );
}

function resolveSocialInteractions(decisions, tick, seed) {
  const byId = new Map(decisions.map((decision) => [decision.agentId, decision]));
  const proposals = decisions
    .filter((decision) => decision.action.type === "socialize")
    .sort((left, right) => left.agentId.localeCompare(right.agentId));
  const claimed = new Set();
  const events = [];
  let formed = 0;

  for (const proposal of proposals) {
    const targetId = proposal.action.socialIntent.targetId;
    const target = byId.get(targetId);
    const proposer = proposal;
    const historyEntry = proposer.state.decisionHistory.at(-1);
    const proposalEvent = {
      id: `${tick}:${proposer.agentId}:${targetId}`,
      tick,
      communityId: proposer.profile.communityId,
      proposerId: proposer.agentId,
      proposerName: proposer.profile.name,
      targetId,
      targetName: target?.profile.name || proposal.action.socialIntent.targetName,
      accepted: false,
      outcome: "unmatched",
      trustChange: 0
    };

    if (!target || target.profile.communityId !== proposer.profile.communityId ||
        claimed.has(proposer.agentId) || claimed.has(targetId)) {
      if (historyEntry) historyEntry.outcome = "Invitation could not be matched this tick.";
      events.push(proposalEvent);
      addSocialHistory(
        proposer.state,
        proposalEvent,
        targetId,
        proposalEvent.targetName,
        true
      );
      continue;
    }

    const priorRelationship = getRelationship(proposer.state, targetId);
    const priorTrust = priorRelationship?.trust ?? 50;
    const cooperation = target.profile.personality.cooperation;
    const acceptanceChance = clamp(
      20 + cooperation * 55 +
      proposer.profile.personality.cooperation * 15 +
      priorTrust * 0.1 -
      target.profile.personality.riskTolerance * 10,
      5,
      95
    );
    const accepted = createAcceptanceRandom(seed, tick, proposer.agentId, targetId)() * 100 <
      acceptanceChance;

    claimed.add(proposer.agentId);
    claimed.add(targetId);
    proposalEvent.accepted = accepted;

    if (accepted) {
      const trustChange = 2 + Math.round(
        (proposer.profile.personality.cooperation + cooperation) * 2
      );
      const trust = clamp(priorTrust + trustChange);
      updateRelationship(proposer.state, targetId, trust, tick);
      updateRelationship(target.state, proposer.agentId, trust, tick);
      proposer.state.needs.social = Math.min(100, proposer.state.needs.social + 12);
      target.state.needs.social = Math.min(100, target.state.needs.social + 8);
      proposer.state.wellbeing = Math.min(100, proposer.state.wellbeing + 1);
      target.state.wellbeing = Math.min(100, target.state.wellbeing + 1);
      target.state.energy = Math.max(0, target.state.energy - 1);
      proposalEvent.outcome = "accepted";
      proposalEvent.trustChange = trust - priorTrust;
      if (!priorRelationship) formed += 1;
    } else {
      const targetRelationship = getRelationship(target.state, proposer.agentId);
      if (priorRelationship && targetRelationship) {
        const trust = clamp(priorTrust - 3);
        updateRelationship(proposer.state, targetId, trust, tick);
        updateRelationship(target.state, proposer.agentId, trust, tick);
        proposalEvent.trustChange = trust - priorTrust;
      }
      proposalEvent.outcome = "declined";
    }

    if (historyEntry) {
      historyEntry.outcome = accepted
        ? `Cooperation formed with ${proposalEvent.targetName}.`
        : `Invitation declined by ${proposalEvent.targetName}.`;
    }
    addSocialHistory(
      proposer.state,
      proposalEvent,
      targetId,
      proposalEvent.targetName,
      true
    );
    addSocialHistory(
      target.state,
      proposalEvent,
      proposer.agentId,
      proposer.profile.name,
      false
    );
    events.push(proposalEvent);
  }

  return {
    events,
    metrics: {
      socialProposals: proposals.length,
      socialInteractions: events.filter((event) => event.accepted).length,
      declinedInvitations: events.filter((event) => event.outcome === "declined").length,
      relationshipsFormed: formed,
      acceptanceRate: proposals.length
        ? Math.round(events.filter((event) => event.accepted).length / proposals.length * 10000) / 100
        : 0,
      averageTrust: averageTrust(decisions)
    }
  };
}

module.exports = { resolveSocialInteractions };
