const test = require("node:test");
const assert = require("node:assert/strict");
const { selectAction } = require("./decisionEngine");

function observation({
  energy,
  rest,
  curiosity,
  adaptability,
  riskTolerance = 0.5,
  resourceSavingPreference = 0.5,
  wellbeing = 80,
  currentFocus = null,
  social = 70,
  cooperation = 0.5,
  socialPeers = [],
  activeEvents = [],
  learning
}) {
  return {
    self: {
      energy,
      communityId: "greenfield",
      wellbeing,
      needs: { rest, social },
      personality: {
        curiosity,
        adaptability,
        riskTolerance,
        resourceSavingPreference,
        cooperation
      },
      goals: { shortTerm: ["Build a reliable business."] },
      currentFocus,
      learning
    },
    environment: {
      community: { name: "Greenfield", facilities: ["Farm", "School"] },
      socialPeers,
      activeEvents
    }
  };
}

test("utility scoring prioritizes rest when energy and rest satisfaction are low", () => {
  const decision = selectAction(
    observation({ energy: 5, rest: 10, curiosity: 0.2, adaptability: 0.2 }),
    () => 0
  );
  assert.equal(decision.type, "rest");
  assert.equal(decision.utility, 100);
});

test("utility scoring prefers planning for a curious, rested agent", () => {
  const decision = selectAction(
    observation({
      energy: 95,
      rest: 95,
      curiosity: 0.7,
      adaptability: 0.98,
      resourceSavingPreference: 0.9
    }),
    () => 0
  );
  assert.equal(decision.type, "plan");
});

test("curious and risk-tolerant agents favor observation over planning", () => {
  const decision = selectAction(
    observation({
      energy: 95,
      rest: 95,
      curiosity: 0.9,
      adaptability: 0.2,
      riskTolerance: 0.9
    }),
    () => 0
  );
  assert.equal(decision.type, "observe");
});

test("seeded tie breakers produce a stable choice for the same observation", () => {
  const input = observation({ energy: 60, rest: 60, curiosity: 0.6, adaptability: 0.5 });
  const first = selectAction(input, () => 0.42);
  const repeated = selectAction(input, () => 0.42);
  assert.deepEqual(first, repeated);
});

test("social utility selects a neighbor when social need is unmet", () => {
  const decision = selectAction(
    observation({
      energy: 90,
      rest: 90,
      curiosity: 0.2,
      adaptability: 0.3,
      cooperation: 0.95,
      social: 5,
      socialPeers: [{ id: "agent-02", name: "Noah Okafor", knownTrust: null }]
    }),
    () => 0.25
  );
  assert.equal(decision.type, "socialize");
  assert.deepEqual(decision.socialIntent, {
    targetId: "agent-02",
    targetName: "Noah Okafor"
  });
});

test("relevant world events increase observation and planning utility", () => {
  const baseline = observation({
    energy: 90,
    rest: 90,
    curiosity: 0.4,
    adaptability: 0.5
  });
  const affected = {
    ...baseline,
    environment: {
      ...baseline.environment,
      activeEvents: [{
        type: "weather-disruption",
        severity: 2,
        communityId: "greenfield"
      }]
    }
  };
  const unrelated = {
    ...baseline,
    environment: {
      ...baseline.environment,
      activeEvents: [{
        type: "weather-disruption",
        severity: 2,
        communityId: "metrocore"
      }]
    }
  };
  const utilityFor = (input, action) =>
    selectAction(input, () => 0).alternatives.find((item) => item.action === action).utility;

  assert.ok(utilityFor(affected, "plan") > utilityFor(baseline, "plan"));
  assert.ok(utilityFor(affected, "observe") > utilityFor(baseline, "observe"));
  assert.equal(utilityFor(unrelated, "plan"), utilityFor(baseline, "plan"));
});

test("measured action success adjusts later utility in proportion to adaptability", () => {
  const input = observation({
    energy: 90,
    rest: 90,
    curiosity: 0.4,
    adaptability: 0.8,
    resourceSavingPreference: 0.7
  });
  const withoutLearning = selectAction(input, () => 0.25);
  const withLearning = selectAction({
    ...input,
    self: {
      ...input.self,
      learning: {
        actionPerformance: { plan: { attempts: 4, successes: 4 } }
      }
    }
  }, () => 0.25);
  const basePlanUtility = withoutLearning.alternatives.find(({ action }) => action === "plan").utility;
  const learnedPlanUtility = withLearning.alternatives.find(({ action }) => action === "plan").utility;
  assert.ok(Math.abs(learnedPlanUtility - basePlanUtility - 4.8) < 1e-10);
});
