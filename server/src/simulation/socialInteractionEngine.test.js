const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveSocialInteractions } = require("./socialInteractionEngine");

function agent(agentId, cooperation, riskTolerance, social = 50) {
  const profile = {
    id: agentId,
    name: agentId === "agent-01" ? "Maya Chen" : "Noah Okafor",
    communityId: "greenfield",
    personality: { cooperation, riskTolerance }
  };
  const state = {
    agentId,
    needs: { social },
    wellbeing: 70,
    energy: 70,
    relationships: [],
    socialHistory: [],
    decisionHistory: [{ action: "socialize", outcome: "Invitation sent." }]
  };
  return { profile, state, agentId };
}

function proposal(proposer, target) {
  return {
    ...proposer,
    action: {
      type: "socialize",
      socialIntent: { targetId: target.profile.id, targetName: target.profile.name }
    }
  };
}

test("accepted invitations create reciprocal trust and social outcomes", () => {
  const proposer = agent("agent-01", 0.9, 0.1);
  const target = agent("agent-02", 0.9, 0.1);
  const decisions = [
    proposal(proposer, target),
    { ...target, action: { type: "plan" } }
  ];

  const result = resolveSocialInteractions(decisions, 1, 2026);
  assert.equal(result.events[0].outcome, "accepted");
  assert.equal(result.metrics.socialInteractions, 1);
  assert.equal(result.metrics.relationshipsFormed, 1);
  assert.equal(proposer.state.relationships[0].agentId, target.profile.id);
  assert.equal(target.state.relationships[0].agentId, proposer.profile.id);
  assert.equal(proposer.state.relationships[0].trust, target.state.relationships[0].trust);
  assert.equal(proposer.state.needs.social, 62);
  assert.equal(target.state.needs.social, 58);
  assert.match(proposer.state.decisionHistory[0].outcome, /Cooperation formed/);
  assert.equal(proposer.state.socialHistory[0].initiated, true);
  assert.equal(target.state.socialHistory[0].initiated, false);
});

test("declined invitations lower an existing relationship's trust symmetrically", () => {
  const proposer = agent("agent-01", 0.1, 0.1);
  const target = agent("agent-02", 0.1, 1);
  const relationship = {
    agentId: "agent-02",
    trust: 30,
    interactions: 2,
    lastInteractionTick: 1,
    status: "cautious"
  };
  proposer.state.relationships = [{ ...relationship }];
  target.state.relationships = [{ ...relationship, agentId: "agent-01" }];
  const decisions = [
    proposal(proposer, target),
    { ...target, action: { type: "plan" } }
  ];

  const result = resolveSocialInteractions(decisions, 2, 2026);
  assert.equal(result.events[0].outcome, "declined");
  assert.equal(result.events[0].trustChange, -3);
  assert.equal(proposer.state.relationships[0].trust, 27);
  assert.equal(target.state.relationships[0].trust, 27);
  assert.equal(proposer.state.relationships[0].interactions, 3);
  assert.equal(result.metrics.socialInteractions, 0);
});

test("social outcomes are reproducible for the same seed and tick", () => {
  const createDecisions = () => {
    const proposer = agent("agent-01", 0.8, 0.2);
    const target = agent("agent-02", 0.7, 0.3);
    return [
      proposal(proposer, target),
      { ...target, action: { type: "observe" } }
    ];
  };

  const first = resolveSocialInteractions(createDecisions(), 4, 2026);
  const repeated = resolveSocialInteractions(createDecisions(), 4, 2026);
  assert.deepEqual(repeated, first);
});
