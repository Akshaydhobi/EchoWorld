const { createRandom } = require("../simulation/seededRandom");

const ROLE_COUNTS = {
  entrepreneur: 4,
  farmer: 4,
  engineer: 3,
  researcher: 3,
  trader: 4,
  healthcareWorker: 3,
  teacher: 3,
  citizen: 6
};

const ROLE_DETAILS = {
  entrepreneur: {
    label: "Entrepreneur",
    shortTerm: "Find a viable opportunity for a small business.",
    longTerm: "Build a resilient business that serves the community."
  },
  farmer: {
    label: "Farmer",
    shortTerm: "Maintain a reliable supply of fresh food.",
    longTerm: "Improve sustainable food production."
  },
  engineer: {
    label: "Engineer",
    shortTerm: "Keep essential infrastructure dependable.",
    longTerm: "Develop practical improvements for the city."
  },
  researcher: {
    label: "Researcher",
    shortTerm: "Gather useful knowledge from the local environment.",
    longTerm: "Turn discoveries into shared community benefits."
  },
  trader: {
    label: "Trader",
    shortTerm: "Connect people with goods they need.",
    longTerm: "Build fair and dependable trade relationships."
  },
  healthcareWorker: {
    label: "Healthcare worker",
    shortTerm: "Help neighbors maintain their health.",
    longTerm: "Improve access to reliable community care."
  },
  teacher: {
    label: "Teacher",
    shortTerm: "Share a useful skill with community members.",
    longTerm: "Support learning and knowledge sharing."
  },
  citizen: {
    label: "General citizen",
    shortTerm: "Meet daily needs and stay connected with neighbors.",
    longTerm: "Contribute to a safe and thriving community."
  }
};

const NAMES = [
  "Maya Chen", "Noah Okafor", "Sofia Ramirez", "Idris Hassan", "Leila Morgan",
  "Arjun Patel", "Elena Petrova", "Kai Nakamura", "Amara Diallo", "Daniel Brooks",
  "Priya Shah", "Mateo Silva", "Hana Kim", "Lucas Moreau", "Zuri Ndlovu",
  "Aisha Rahman", "Theo Bennett", "Mei Lin", "Omar Haddad", "Nia Campbell",
  "Ravi Desai", "Clara Jensen", "Samuel Ortiz", "Yuki Sato", "Fatima Zahra",
  "Ethan Cole", "Ines Costa", "David Mensah", "Anika Bose", "Julian Reyes"
];

const PERSONALITY_TRAITS = [
  "cooperation",
  "riskTolerance",
  "curiosity",
  "adaptability",
  "resourceSavingPreference"
];

function validateGenerationOptions(options = {}) {
  const allowed = new Set([
    "cooperationMultiplier",
    "adaptabilityMultiplier",
    "personalityDiversity",
    "startingResourceMultiplier"
  ]);
  if (!options || typeof options !== "object" || Array.isArray(options) ||
      Object.keys(options).some((key) => !allowed.has(key))) {
    throw new TypeError("Agent generation options contain unsupported fields.");
  }
  const normalized = {
    cooperationMultiplier: options.cooperationMultiplier ?? 1,
    adaptabilityMultiplier: options.adaptabilityMultiplier ?? 1,
    personalityDiversity: options.personalityDiversity ?? 1,
    startingResourceMultiplier: options.startingResourceMultiplier ?? 1
  };
  for (const [name, value] of Object.entries(normalized)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new TypeError(`${name} must be a number from 0 to 1.`);
    }
  }
  return normalized;
}

function buildRoleList() {
  return Object.entries(ROLE_COUNTS).flatMap(([role, count]) =>
    Array.from({ length: count }, () => role)
  );
}

function createInitialAgentRecords(seed = 2026, communities = [], options = {}) {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError("Agent factory seed must be a safe integer.");
  }
  if (communities.length !== 3) {
    throw new TypeError("The initial agent factory requires exactly three communities.");
  }
  const generationOptions = validateGenerationOptions(options);

  const random = createRandom(seed);
  const roles = buildRoleList();
  const profiles = [];
  const states = [];
  const resourceRange = (min, max) => Math.floor(random() * (max - min + 1)) + min;

  for (let index = 0; index < NAMES.length; index += 1) {
    const id = `agent-${String(index + 1).padStart(2, "0")}`;
    const role = roles[index];
    const community = communities[index % communities.length];
    const goals = ROLE_DETAILS[role];
    const startingResource = (min, max) =>
      Math.floor(resourceRange(min, max) * generationOptions.startingResourceMultiplier);
    const personality = Object.fromEntries(PERSONALITY_TRAITS.map((trait) => {
      const baseValue = 0.15 + random() * 0.7;
      const diverseValue = 0.5 +
        (baseValue - 0.5) * generationOptions.personalityDiversity;
      const multiplier = trait === "cooperation"
        ? generationOptions.cooperationMultiplier
        : trait === "adaptability"
          ? generationOptions.adaptabilityMultiplier
          : 1;
      return [
        trait,
        Math.round(diverseValue * multiplier * 100) / 100
      ];
    }));

    profiles.push({
      id,
      worldId: "echo-city",
      name: NAMES[index],
      role,
      roleLabel: goals.label,
      communityId: community.id,
      personality,
      goals: {
        shortTerm: [goals.shortTerm],
        longTerm: [goals.longTerm]
      }
    });

    states.push({
      agentId: id,
      tick: 0,
      status: "idle",
      needs: {
        food: resourceRange(65, 95),
        rest: resourceRange(60, 95),
        social: resourceRange(45, 85),
        health: resourceRange(75, 100)
      },
      resources: {
        food: startingResource(8, 20),
        money: startingResource(80, 180),
        energy: startingResource(10, 25),
        materials: startingResource(0, 5),
        knowledge: startingResource(0, 5),
        healthcare: startingResource(0, 2)
      },
      energy: resourceRange(65, 95),
      wellbeing: resourceRange(65, 90),
      currentFocus: null,
      relationships: [],
      socialHistory: [],
      memory: {
        shortTerm: [],
        longTerm: []
      },
      learning: {
        actionPerformance: {},
        preferredAction: null,
        reflections: 0,
        strategyAdjustments: 0,
        lastReflectionTick: null
      },
      decisionHistory: []
    });
  }

  return { profiles, states };
}

module.exports = {
  PERSONALITY_TRAITS,
  ROLE_COUNTS,
  ROLE_DETAILS,
  createInitialAgentRecords
};
