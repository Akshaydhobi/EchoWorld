const test = require("node:test");
const assert = require("node:assert/strict");
const world = require("../../../shared/world.json");
const {
  PERSONALITY_TRAITS,
  ROLE_COUNTS,
  createInitialAgentRecords
} = require("./agentFactory");

test("factory creates unique agents with the required roles and community balance", () => {
  const { profiles, states } = createInitialAgentRecords(world.seed, world.communities);

  assert.equal(profiles.length, 30);
  assert.equal(states.length, 30);
  assert.equal(new Set(profiles.map((profile) => profile.name)).size, 30);
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, 30);

  const roleCounts = Object.fromEntries(Object.keys(ROLE_COUNTS).map((role) => [role, 0]));
  const communityCounts = Object.fromEntries(world.communities.map(({ id }) => [id, 0]));
  for (const profile of profiles) {
    roleCounts[profile.role] += 1;
    communityCounts[profile.communityId] += 1;
    for (const trait of PERSONALITY_TRAITS) {
      assert.ok(profile.personality[trait] >= 0 && profile.personality[trait] <= 1);
    }
  }

  assert.deepEqual(roleCounts, ROLE_COUNTS);
  assert.deepEqual(communityCounts, { greenfield: 10, metrocore: 10, novadistrict: 10 });
  for (const state of states) {
    for (const quantity of Object.values(state.resources)) {
      assert.ok(quantity >= 0);
    }
  }
});

test("factory output is reproducible for a seed and changes with a different seed", () => {
  const first = createInitialAgentRecords(42, world.communities);
  const repeated = createInitialAgentRecords(42, world.communities);
  const changed = createInitialAgentRecords(43, world.communities);

  assert.deepEqual(first, repeated);
  assert.notDeepEqual(first, changed);
});

test("factory rejects invalid seeds and community layouts", () => {
  assert.throws(() => createInitialAgentRecords(Number.NaN, world.communities), TypeError);
  assert.throws(() => createInitialAgentRecords(1, world.communities.slice(0, 2)), TypeError);
  assert.throws(() => createInitialAgentRecords(1, world.communities, {
    unknownSetting: 1
  }), TypeError);
});

test("experiment generation settings control trait spread and starting resources", () => {
  const narrow = createInitialAgentRecords(42, world.communities, {
    personalityDiversity: 0,
    cooperationMultiplier: 0.2,
    startingResourceMultiplier: 0.25
  });
  assert.ok(narrow.profiles.every((profile) =>
    profile.personality.curiosity === 0.5 &&
    profile.personality.cooperation === 0.1
  ));
  assert.ok(narrow.states.every((state) =>
    Object.values(state.resources).every((quantity) => quantity >= 0)
  ));
  assert.ok(narrow.states.every((state) => state.resources.money <= 45));
});
