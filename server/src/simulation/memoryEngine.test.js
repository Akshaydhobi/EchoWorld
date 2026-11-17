const test = require("node:test");
const assert = require("node:assert/strict");
const { getUtilityAdjustment, recordExperiences } = require("./memoryEngine");

test("private memories stay bounded while reflections summarize measured outcomes", () => {
  let state = {
    agentId: "agent-01",
    memory: { shortTerm: [], longTerm: [] },
    learning: {
      actionPerformance: {},
      preferredAction: null,
      reflections: 0,
      strategyAdjustments: 0,
      lastReflectionTick: null
    },
    decisionHistory: []
  };

  for (let tick = 1; tick <= 13; tick += 1) {
    const successful = tick % 2 === 1;
    state.decisionHistory.push({
      tick,
      action: "trade",
      utility: 60,
      outcome: successful ? "Bought 1 food for 3 credits." : "No suitable seller was available."
    });
    const decisions = [{
      agentId: state.agentId,
      profile: { id: state.agentId },
      action: { type: "trade" }
    }];
    const states = [{ agentId: state.agentId, state }];
    recordExperiences(decisions, states, [], [], tick);
    state = states[0].state;
  }

  assert.equal(state.memory.shortTerm.length, 12);
  assert.equal(state.memory.shortTerm[0].tick, 2);
  assert.equal(state.memory.longTerm.length, 2);
  assert.equal(state.memory.longTerm[1].tick, 10);
  assert.equal(state.memory.longTerm[1].successRate, 40);
  assert.equal(state.learning.actionPerformance.trade.attempts, 13);
  assert.equal(state.learning.actionPerformance.trade.successes, 7);
  assert.equal(state.learning.preferredAction, "trade");
  assert.equal(state.learning.lastReflectionTick, 10);
  assert.ok(getUtilityAdjustment(state.learning, "trade", 0.8) > 0);
});
