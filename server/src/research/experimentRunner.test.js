const test = require("node:test");
const assert = require("node:assert/strict");
const { resetTransactions } = require("../economy/transactionStore");
const { resetSocialInteractions } = require("../social/socialInteractionStore");
const { stepSimulation } = require("../simulation/engine");
const worldStore = require("../simulation/worldStore");
const { runExperiment } = require("./experimentRunner");

test("experiment metrics average tick wellbeing and reproduce paired seeded runs", () => {
  const configuration = { type: "cooperation", seed: 42, repeats: 2, ticks: 5 };
  const lowerCooperationOptions = { cooperationMultiplier: 0.2 };
  worldStore.resetWorld(configuration.seed, lowerCooperationOptions);
  resetTransactions();
  resetSocialInteractions();
  const tickWellbeing = [];
  for (let tick = 0; tick < configuration.ticks; tick += 1) {
    tickWellbeing.push(stepSimulation().metrics.averageWellbeing);
  }
  const expectedMean = Math.round(
    tickWellbeing.reduce((sum, value) => sum + value, 0) / tickWellbeing.length * 100
  ) / 100;

  const first = runExperiment(configuration);
  const repeated = runExperiment(configuration);

  assert.deepEqual(first, repeated);
  assert.deepEqual(first.seeds, [42, 7961]);
  assert.equal(first.variants[0].runs[0].metrics.averageWellbeing, expectedMean);
  assert.equal(first.variants[0].summary.averageWellbeing.count, 2);
  assert.equal(first.pairedDifferences.averageWellbeing.count, 2);
});
