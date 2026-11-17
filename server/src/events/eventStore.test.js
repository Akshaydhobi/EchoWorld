const test = require("node:test");
const assert = require("node:assert/strict");
const {
  advanceEvents,
  createManualEvent,
  getActiveEvents,
  listEvents,
  resetEvents,
  validateEventInput
} = require("./eventStore");

test("manual events are validated, scheduled, activated, resolved, and reset", () => {
  resetEvents();
  assert.throws(() => validateEventInput({ type: "market-change", resource: "food" }), /surge or drop/);
  assert.throws(() => validateEventInput({
    type: "market-change",
    resource: "food",
    direction: "surge",
    communityId: "greenfield"
  }), /citywide/);
  assert.throws(() => validateEventInput({ type: "weather-disruption", severity: 4 }), /severity/);
  assert.throws(() => validateEventInput({ type: "energy-shortage", extra: true }), /unsupported fields/);

  const manualEvent = createManualEvent({
    type: "weather-disruption",
    severity: 3,
    duration: 1,
    communityId: "greenfield"
  }, 0);
  assert.equal(manualEvent.status, "scheduled");
  assert.deepEqual(getActiveEvents(0), []);

  const firstTick = advanceEvents(2026, 1);
  assert.ok(firstTick.activeEvents.some((event) => event.id === manualEvent.id));
  const secondTick = advanceEvents(2026, 2);
  assert.ok(secondTick.resolvedEvents.some((event) => event.id === manualEvent.id));
  assert.equal(listEvents({ source: "manual", status: "resolved" }).count, 1);
  assert.equal(listEvents({ type: "weather-disruption" }).count >= 1, true);

  resetEvents();
  assert.equal(listEvents().count, 0);
  assert.deepEqual(getActiveEvents(0), []);
});

test("automatic events are reproducible for a fixed seed", () => {
  function collectGeneratedEvents(seed) {
    resetEvents();
    const generated = [];
    for (let tick = 1; tick <= 40; tick += 1) {
      const update = advanceEvents(seed, tick);
      if (update.generatedEvent) {
        generated.push(update.generatedEvent);
      }
    }
    return generated;
  }

  const seed = Array.from({ length: 100 }, (_value, index) => index + 1)
    .find((candidate) => collectGeneratedEvents(candidate).length > 0);
  assert.notEqual(seed, undefined);
  assert.deepEqual(collectGeneratedEvents(seed), collectGeneratedEvents(seed));
  resetEvents();
});
