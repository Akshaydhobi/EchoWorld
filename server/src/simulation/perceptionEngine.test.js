const test = require("node:test");
const assert = require("node:assert/strict");
const world = require("../../../shared/world.json");
const { createInitialAgentRecords } = require("../agents/agentFactory");
const { createObservation } = require("./perceptionEngine");

test("perception exposes the agent's own state and public environment only", () => {
  const { profiles, states } = createInitialAgentRecords(world.seed, world.communities);
  const privateState = {
    ...states[0],
    memory: { shortTerm: [{ privateNote: "private memory" }], longTerm: [] }
  };
  const observation = createObservation(profiles[0], privateState, {
    ...world,
    otherAgents: [{ privateMemory: "another agent's secret" }]
  }, profiles.map((profile, index) => ({ profile, state: states[index] })));

  assert.equal(observation.self.id, profiles[0].id);
  assert.equal(observation.environment.community.id, profiles[0].communityId);
  assert.equal(Object.hasOwn(observation.self, "memory"), true);
  assert.equal(observation.self.memory.shortTerm[0].privateNote, "private memory");
  assert.equal(Object.hasOwn(observation, "otherAgents"), false);
  assert.equal(observation.environment.socialPeers.length, 9);
  assert.ok(observation.environment.socialPeers.every((peer) =>
    peer.id !== profiles[0].id &&
    peer.communityId === undefined &&
    !Object.hasOwn(peer, "resources") &&
    !Object.hasOwn(peer, "memory")
  ));
  assert.equal(JSON.stringify(observation).includes("private memory"), true);
  assert.equal(JSON.stringify(observation).includes("another agent's secret"), false);
});
