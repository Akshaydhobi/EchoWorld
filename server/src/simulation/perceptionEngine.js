function createObservation(profile, state, world, publicAgents = []) {
  const community = world.communities.find((item) => item.id === profile.communityId);
  if (!community) {
    throw new Error(`Agent ${profile.id} is assigned to an unknown community.`);
  }

  return {
    tick: world.tick,
    self: {
      id: profile.id,
      role: profile.role,
      communityId: profile.communityId,
      personality: { ...profile.personality },
      goals: {
        shortTerm: [...profile.goals.shortTerm],
        longTerm: [...profile.goals.longTerm]
      },
      needs: { ...state.needs },
      resources: { ...state.resources },
      energy: state.energy,
      wellbeing: state.wellbeing,
      currentFocus: state.currentFocus,
      memory: {
        shortTerm: state.memory.shortTerm.map((entry) => ({ ...entry })),
        longTerm: state.memory.longTerm.map((entry) => ({ ...entry }))
      },
      learning: {
        ...state.learning,
        actionPerformance: { ...state.learning.actionPerformance }
      }
    },
    environment: {
      worldName: world.name,
      tick: world.tick,
      community: {
        id: community.id,
        name: community.name,
        type: community.type,
        facilities: [...community.facilities]
      },
      resourceTypes: world.resources.map(({ id, unit }) => ({ id, unit })),
      marketPrices: { ...world.marketPrices },
      marketSummary: JSON.parse(JSON.stringify(world.marketSummary || {})),
      activeEvents: (world.activeEvents || []).map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        severity: event.severity,
        communityId: event.communityId,
        resource: event.resource
      })),
      socialPeers: publicAgents
        .filter((record) => record.profile.id !== profile.id &&
          record.profile.communityId === profile.communityId)
        .map(({ profile: peer }) => ({
          id: peer.id,
          name: peer.name,
          role: peer.role,
          roleLabel: peer.roleLabel,
          knownTrust: state.relationships.find((relationship) =>
            relationship.agentId === peer.id
          )?.trust ?? null
        }))
    }
  };
}

module.exports = { createObservation };
