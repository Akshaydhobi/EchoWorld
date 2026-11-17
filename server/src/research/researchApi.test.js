const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

async function waitForExperiment(baseUrl, id) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/experiments/${id}`);
    const { experiment } = await response.json();
    if (experiment.status === "completed" || experiment.status === "failed") {
      return experiment;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Experiment ${id} did not finish within 20 seconds.`);
}

test("research API validates, runs, compares experiments, and isolates the live world", async () => {
  const server = app.listen(0);
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const updates = [];
    app.set("io", { emit: (event, update) => updates.push({ event, update }) });

    const initialWorld = await (await fetch(`${baseUrl}/api/world`)).json();
    const initialAgents = await (await fetch(`${baseUrl}/api/agents`)).json();
    const catalogResponse = await fetch(`${baseUrl}/api/experiments/catalog`);
    const catalog = await catalogResponse.json();
    assert.equal(catalogResponse.status, 200);
    assert.equal(catalog.experiments.length, 6);
    assert.equal((await fetch(`${baseUrl}/api/experiments/unknown`)).status, 404);

    for (const body of [
      { type: "unknown" },
      { type: "cooperation", ticks: 4 },
      { type: "cooperation", extra: true }
    ]) {
      const invalid = await fetch(`${baseUrl}/api/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      assert.equal(invalid.status, 400);
    }

    async function createExperiment(seed) {
      const response = await fetch(`${baseUrl}/api/experiments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cooperation", seed, repeats: 1, ticks: 5 })
      });
      assert.equal(response.status, 202);
      const { experiment } = await response.json();
      const completed = await waitForExperiment(baseUrl, experiment.id);
      assert.equal(completed.status, "completed", completed.error || "Experiment failed.");
      return completed;
    }

    const first = await createExperiment(2026);
    const second = await createExperiment(2027);
    assert.equal(first.results.totalRuns, 2);
    assert.ok(first.results.variants.every((variant) =>
      variant.runs[0].metrics.averageWellbeing !== undefined &&
      variant.runs[0].metrics.resourcesAvailable.food >= 0
    ));
    assert.ok(updates.some(({ event, update }) =>
      event === "research:update" &&
      update.event === "progress" &&
      update.experiment.id === first.id
    ));
    assert.ok(updates.some(({ event, update }) =>
      event === "research:update" &&
      update.event === "completed" &&
      update.experiment.id === second.id
    ));

    const comparisonResponse = await fetch(
      `${baseUrl}/api/experiments/compare?first=${first.id}&second=${second.id}`
    );
    const comparison = await comparisonResponse.json();
    assert.equal(comparisonResponse.status, 200);
    assert.equal(comparison.first.id, first.id);
    assert.equal(comparison.second.id, second.id);

    const liveWorld = await (await fetch(`${baseUrl}/api/world`)).json();
    const liveAgents = await (await fetch(`${baseUrl}/api/agents`)).json();
    assert.equal(liveWorld.tick, initialWorld.tick);
    assert.deepEqual(
      liveAgents.agents.map((agent) => agent.state),
      initialAgents.agents.map((agent) => agent.state)
    );
    assert.equal((await fetch(`${baseUrl}/api/experiments?`)).status, 200);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
