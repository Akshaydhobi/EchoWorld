const test = require("node:test");
const assert = require("node:assert/strict");
const world = require("../../../shared/world.json");

test("ECHO CITY defines three communities with ten planned residents each", () => {
  assert.equal(world.name, "ECHO CITY");
  assert.equal(world.communities.length, 3);
  assert.deepEqual(
    world.communities.map((community) => community.targetPopulation),
    [10, 10, 10]
  );
});

test("world foundation includes all six resource categories", () => {
  assert.deepEqual(
    world.resources.map((resource) => resource.id),
    ["food", "money", "energy", "materials", "knowledge", "healthcare"]
  );
});
