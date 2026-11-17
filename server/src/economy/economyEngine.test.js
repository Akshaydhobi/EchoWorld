const test = require("node:test");
const assert = require("node:assert/strict");
const world = require("../../../shared/world.json");
const { createInitialAgentRecords } = require("../agents/agentFactory");
const { resolveEconomy } = require("./economyEngine");

test("centralized coordination allocates essential surpluses and records transfers", () => {
  const { profiles, states } = createInitialAgentRecords(2026, world.communities);
  const donor = { ...states[0], resources: { ...states[0].resources, food: 2, energy: 2 } };
  const recipient = { ...states[1], resources: { ...states[1].resources, food: 0, energy: 0 } };
  const decisions = [
    { profile: profiles[0], state: donor, action: { type: "rest" } },
    { profile: profiles[1], state: recipient, action: { type: "rest" } }
  ];

  const decentralized = resolveEconomy(decisions, 1);
  const centralized = resolveEconomy(decisions, 1, [], {
    coordinationMode: "centralized"
  });

  assert.equal(decentralized.metrics.blockedConsumption, 2);
  assert.equal(decentralized.metrics.coordinatedTransfers, 0);
  assert.equal(centralized.metrics.blockedConsumption, 0);
  assert.equal(centralized.metrics.coordinatedTransfers, 2);
  assert.equal(
    centralized.transactions.filter((transaction) => transaction.type === "allocation").length,
    2
  );
  assert.ok(centralized.states.every(({ state }) =>
    Object.values(state.resources).every((quantity) => quantity >= 0)
  ));
});
