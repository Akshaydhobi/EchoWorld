const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("./app");
const world = require("../../shared/world.json");
const { ROLE_COUNTS } = require("./agents/agentFactory");

test("world, agent, social, and simulation endpoints serve the M10 simulation", async () => {
  const server = app.listen(0);

  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const [healthResponse, worldResponse, agentsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/health`),
      fetch(`${baseUrl}/api/world`),
      fetch(`${baseUrl}/api/agents`)
    ]);

    assert.equal(healthResponse.status, 200);
    assert.deepEqual(await healthResponse.json(), { status: "ok", milestone: "M10" });
    assert.equal(healthResponse.headers.get("x-content-type-options"), "nosniff");
    assert.equal(healthResponse.headers.get("x-frame-options"), "DENY");
    assert.equal(healthResponse.headers.get("x-powered-by"), null);
    const unknownApiResponse = await fetch(`${baseUrl}/api/unknown-route`);
    assert.equal(unknownApiResponse.status, 404);
    assert.deepEqual(await unknownApiResponse.json(), { error: "API route was not found." });
    assert.equal(worldResponse.status, 200);
    const worldPayload = await worldResponse.json();
    const {
      population,
      resourceTotals,
      socialSummary,
      eventSummary,
      activeEvents,
      marketPrices,
      marketSummary,
      transactionCount,
      ...baseWorld
    } = worldPayload;
    assert.deepEqual(baseWorld, world);
    assert.deepEqual(population, {
      total: 30,
      active: 0,
      byCommunity: { greenfield: 10, metrocore: 10, novadistrict: 10 }
    });
    assert.equal(resourceTotals.money > 0, true);
    assert.deepEqual(socialSummary, {
      relationships: 0,
      proposals: 0,
      interactions: 0,
      averageTrust: 0
    });
    assert.deepEqual(eventSummary, {
      total: 0,
      active: 0,
      scheduled: 0,
      manual: 0,
      environmental: 0
    });
    assert.deepEqual(activeEvents, []);
    assert.equal(marketPrices.food, 3);
    assert.ok(marketSummary.food);
    assert.equal(transactionCount, 0);

    assert.equal(agentsResponse.status, 200);
    const agentsPayload = await agentsResponse.json();
    assert.equal(agentsPayload.count, 30);

    const roleCounts = Object.fromEntries(Object.keys(ROLE_COUNTS).map((role) => [role, 0]));
    for (const agent of agentsPayload.agents) roleCounts[agent.role] += 1;
    assert.deepEqual(roleCounts, ROLE_COUNTS);

    const detailResponse = await fetch(`${baseUrl}/api/agents/agent-01`);
    const detail = await detailResponse.json();
    assert.equal(detailResponse.status, 200);
    assert.equal(detail.name, agentsPayload.agents[0].name);
    assert.equal(detail.state.decisionHistory.length, 0);

    const emptySocialResponse = await fetch(`${baseUrl}/api/relationships`);
    const emptySocial = await emptySocialResponse.json();
    assert.equal(emptySocialResponse.status, 200);
    assert.equal(emptySocial.count, 0);
    assert.deepEqual(emptySocial.summary, socialSummary);
    assert.equal(
      (await fetch(`${baseUrl}/api/relationships?community=unknown`)).status,
      400
    );
    assert.equal(
      (await fetch(`${baseUrl}/api/social-interactions?limit=101`)).status,
      400
    );

    const invalidFilterResponse = await fetch(`${baseUrl}/api/agents?community=unknown`);
    assert.equal(invalidFilterResponse.status, 400);
    assert.equal((await fetch(`${baseUrl}/api/events?status=unknown`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/api/events?unsupported=true`)).status, 400);

    const invalidSpeedResponse = await fetch(`${baseUrl}/api/simulation/speed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speedMultiplier: 10 })
    });
    assert.equal(invalidSpeedResponse.status, 400);

    const events = [];
    app.set("io", { emit: (event, update) => events.push({ event, update }) });
    const firstStepResponse = await fetch(`${baseUrl}/api/simulation/step`, { method: "POST" });
    assert.equal(firstStepResponse.status, 200);
    const firstStep = await firstStepResponse.json();
    assert.equal(firstStep.world.tick, 1);
    assert.equal(firstStep.metrics.decisions, 30);
    assert.equal(Object.values(firstStep.metrics.actionCounts).reduce((sum, count) => sum + count, 0), 30);
    assert.ok(Object.keys(firstStep.metrics.actionCounts).length >= 2);
    assert.ok(firstStep.metrics.trades > 0);
    assert.equal(
      firstStep.metrics.socialProposals,
      firstStep.metrics.actionCounts.socialize || 0
    );
    assert.ok(Object.entries(firstStep.metrics.marketPrices).some(([resource, price]) =>
      price !== marketPrices[resource]
    ));
    assert.equal(firstStep.agentUpdates.length, 30);
    assert.equal(firstStep.agentUpdates[0].state.decisionHistory.length, 1);
    assert.equal(Object.hasOwn(firstStep.agentUpdates[0].state, "memory"), true);
    assert.equal(firstStep.agentUpdates[0].state.memory.shortTerm.length, 1);
    assert.equal(events.at(-1).event, "simulation:update");
    assert.equal(events.at(-1).update.event, "tick");

    const afterFirstStep = await (await fetch(`${baseUrl}/api/agents`)).json();
    assert.ok(afterFirstStep.agents.every((agent) =>
      agent.state.tick === 1 && agent.state.decisionHistory.length === 1
    ));
    assert.ok(afterFirstStep.agents.every((agent) =>
      Object.values(agent.state.resources).every((quantity) => quantity >= 0)
    ));
    assert.equal(
      firstStep.metrics.resourceTotals.money,
      afterFirstStep.agents.reduce((total, agent) => total + agent.state.resources.money, 0)
    );
    assert.deepEqual(firstStep.metrics.resourceTotals, Object.fromEntries(
      Object.keys(firstStep.metrics.resourceTotals).map((resource) => [
        resource,
        afterFirstStep.agents.reduce((total, agent) => total + agent.state.resources[resource], 0)
      ])
    ));
    assert.equal(firstStep.world.transactionCount > 0, true);
    assert.equal(firstStep.world.socialSummary.interactions, firstStep.metrics.socialInteractions);
    assert.equal(firstStep.world.socialSummary.relationships, firstStep.metrics.relationshipsFormed);
    assert.equal(firstStep.world.socialSummary.proposals, firstStep.metrics.socialProposals);
    assert.ok(firstStep.metrics.socialEvents.every((event) =>
      event.proposerId !== event.targetId &&
      ["accepted", "declined", "unmatched"].includes(event.outcome)
    ));
    const socialLedger = await (await fetch(
      `${baseUrl}/api/social-interactions?tick=1&limit=100`
    )).json();
    assert.equal(socialLedger.count, firstStep.metrics.socialProposals);
    assert.equal(
      socialLedger.interactions.filter((interaction) => interaction.accepted).length,
      firstStep.metrics.socialInteractions
    );
    if (socialLedger.count > 0) {
      const socialByAgent = await (await fetch(
        `${baseUrl}/api/social-interactions?agentId=${socialLedger.interactions[0].proposerId}`
      )).json();
      assert.ok(socialByAgent.interactions.every((interaction) =>
        interaction.proposerId === socialLedger.interactions[0].proposerId ||
        interaction.targetId === socialLedger.interactions[0].proposerId
      ));
    }

    const relationshipsResponse = await fetch(`${baseUrl}/api/relationships`);
    const relationshipPayload = await relationshipsResponse.json();
    assert.equal(relationshipsResponse.status, 200);
    assert.equal(relationshipPayload.count, firstStep.world.socialSummary.relationships);
    assert.ok(relationshipPayload.relationships.every((relationship) => {
      const source = afterFirstStep.agents.find((agent) => agent.id === relationship.source);
      const target = afterFirstStep.agents.find((agent) => agent.id === relationship.target);
      return source.state.relationships.some((item) =>
        item.agentId === relationship.target && item.trust === relationship.trust
      ) && target.state.relationships.some((item) =>
        item.agentId === relationship.source && item.trust === relationship.trust
      );
    }));
    if (relationshipPayload.count > 0) {
      const firstRelationship = relationshipPayload.relationships[0];
      const filtered = await (await fetch(
        `${baseUrl}/api/relationships?agentId=${firstRelationship.source}`
      )).json();
      assert.ok(filtered.relationships.every((relationship) =>
        relationship.source === firstRelationship.source ||
        relationship.target === firstRelationship.source
      ));
      const communityFiltered = await (await fetch(
        `${baseUrl}/api/relationships?community=${firstRelationship.communityId}`
      )).json();
      assert.ok(communityFiltered.relationships.every((relationship) =>
        relationship.communityId === firstRelationship.communityId
      ));
    }

    const transactionResponse = await fetch(`${baseUrl}/api/transactions?agentId=agent-01&tick=1`);
    const transactionPayload = await transactionResponse.json();
    assert.equal(transactionResponse.status, 200);
    assert.ok(transactionPayload.count > 0);
    assert.ok(transactionPayload.transactions.every((transaction) =>
      transaction.participants.includes("agent-01")
    ));

    const tickLedger = await (await fetch(`${baseUrl}/api/transactions?tick=1&limit=100`)).json();
    assert.equal(tickLedger.count, firstStep.world.transactionCount);
    assert.ok(tickLedger.transactions.some((transaction) => transaction.type === "production"));
    assert.ok(tickLedger.transactions.some((transaction) => transaction.type === "consumption"));
    assert.equal(
      tickLedger.transactions.filter((transaction) => transaction.type === "trade").length,
      firstStep.metrics.trades
    );
    assert.ok(tickLedger.transactions
      .filter((transaction) => transaction.type === "trade")
      .every((transaction) =>
        transaction.sellerId !== transaction.buyerId &&
        transaction.price > 0 &&
        transaction.quantity === 1
      ));

    const invalidTransactionLimit = await fetch(`${baseUrl}/api/transactions?limit=101`);
    assert.equal(invalidTransactionLimit.status, 400);

    const resetResponse = await fetch(`${baseUrl}/api/simulation/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: world.seed })
    });
    assert.equal(resetResponse.status, 200);
    const resetWorld = (await resetResponse.json()).world;
    assert.equal(resetWorld.tick, 0);
    assert.equal(resetWorld.transactionCount, 0);
    assert.equal(resetWorld.socialSummary.proposals, 0);
    assert.deepEqual(resetWorld.eventSummary, {
      total: 0,
      active: 0,
      scheduled: 0,
      manual: 0,
      environmental: 0
    });
    assert.equal(
      (await (await fetch(`${baseUrl}/api/social-interactions`)).json()).count,
      0
    );

    const invalidEventResponse = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "unknown-event" })
    });
    assert.equal(invalidEventResponse.status, 400);

    await fetch(`${baseUrl}/api/simulation/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: world.seed })
    });
    const baselineStep = await (await fetch(
      `${baseUrl}/api/simulation/step`,
      { method: "POST" }
    )).json();
    await fetch(`${baseUrl}/api/simulation/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: world.seed })
    });
    const manualEventResponse = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "weather-disruption",
        severity: 3,
        duration: 1,
        communityId: "greenfield"
      })
    });
    assert.equal(manualEventResponse.status, 201);
    const manualEventPayload = await manualEventResponse.json();
    assert.equal(manualEventPayload.event.status, "scheduled");
    assert.equal(manualEventPayload.event.startsAtTick, 1);
    assert.equal(events.at(-1).update.event, "event-created");
    assert.equal(events.at(-1).update.worldEvent.id, manualEventPayload.event.id);
    assert.equal(manualEventPayload.world.eventSummary.scheduled, 1);
    const activeEventStep = await (await fetch(
      `${baseUrl}/api/simulation/step`,
      { method: "POST" }
    )).json();
    assert.ok(activeEventStep.world.activeEvents.some((event) =>
      event.id === manualEventPayload.event.id
    ));
    assert.ok(activeEventStep.metrics.production.food < baselineStep.metrics.production.food);
    const secondEventStep = await (await fetch(
      `${baseUrl}/api/simulation/step`,
      { method: "POST" }
    )).json();
    assert.ok(secondEventStep.metrics.resolvedEvents.some((event) =>
      event.id === manualEventPayload.event.id
    ));
    assert.equal((await (await fetch(
      `${baseUrl}/api/events?source=manual&status=resolved`
    )).json()).count, 1);

    await fetch(`${baseUrl}/api/simulation/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: world.seed })
    });
    const repeatedStepResponse = await fetch(`${baseUrl}/api/simulation/step`, { method: "POST" });
    const repeatedStep = await repeatedStepResponse.json();
    assert.deepEqual(repeatedStep.metrics, firstStep.metrics);
    const afterRepeatedStep = await (await fetch(`${baseUrl}/api/agents`)).json();
    assert.deepEqual(
      afterRepeatedStep.agents.map((agent) => agent.state.decisionHistory),
      afterFirstStep.agents.map((agent) => agent.state.decisionHistory)
    );
    assert.deepEqual(
      afterRepeatedStep.agents.map((agent) => agent.state.relationships),
      afterFirstStep.agents.map((agent) => agent.state.relationships)
    );
    assert.deepEqual(
      afterRepeatedStep.agents.map((agent) => agent.state.socialHistory),
      afterFirstStep.agents.map((agent) => agent.state.socialHistory)
    );
    assert.equal(repeatedStep.world.transactionCount, firstStep.world.transactionCount);

    let fifthTick;
    for (let tick = 2; tick <= 5; tick += 1) {
      const stepResponse = await fetch(`${baseUrl}/api/simulation/step`, { method: "POST" });
      fifthTick = await stepResponse.json();
      assert.equal(fifthTick.world.tick, tick);
    }
    assert.equal(fifthTick.metrics.reflections, 30);
    const learnedAgents = await (await fetch(`${baseUrl}/api/agents`)).json();
    assert.ok(learnedAgents.agents.every((agent) =>
      agent.state.memory.shortTerm.length === 5 &&
      agent.state.memory.longTerm.length === 1 &&
      agent.state.learning.reflections === 1 &&
      agent.state.learning.lastReflectionTick === 5 &&
      Object.values(agent.state.learning.actionPerformance)
        .reduce((attempts, result) => attempts + result.attempts, 0) === 5
    ));

    const pausedStepResponse = await fetch(`${baseUrl}/api/simulation/pause`, { method: "POST" });
    assert.equal(pausedStepResponse.status, 409);

    await fetch(`${baseUrl}/api/simulation/reset`, { method: "POST" });

    const architectToken = "test-architect-token-".padEnd(32, "x");
    app.set("architectToken", architectToken);
    const unauthorizedWorldResponse = await fetch(`${baseUrl}/api/world`);
    assert.equal(unauthorizedWorldResponse.status, 401);
    assert.deepEqual(await unauthorizedWorldResponse.json(), {
      error: "World Architect access token is required or invalid."
    });
    const authorizedWorldResponse = await fetch(`${baseUrl}/api/world`, {
      headers: { "X-Architect-Token": architectToken }
    });
    assert.equal(authorizedWorldResponse.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  } finally {
    app.set("architectToken", undefined);
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});
