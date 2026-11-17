const DEFINITIONS = {
  cooperation: {
    title: "Cooperation vs. independence",
    description: "Compare how reduced and unmodified cooperation traits affect social outcomes.",
    independentVariable: "Agent cooperation trait multiplier",
    variants: [
      {
        id: "lower-cooperation",
        label: "Lower cooperation",
        description: "Cooperation traits are scaled to 20%.",
        agentGenerationOptions: { cooperationMultiplier: 0.2 }
      },
      {
        id: "baseline-cooperation",
        label: "Baseline cooperation",
        description: "Agents retain their seeded cooperation traits.",
        agentGenerationOptions: { cooperationMultiplier: 1 }
      }
    ]
  },
  memory: {
    title: "Memory-enabled vs. memory-disabled",
    description: "Compare adaptive agents that record experience with agents that do not retain learning records.",
    independentVariable: "Experience and reflection recording",
    variants: [
      {
        id: "memory-disabled",
        label: "Memory disabled",
        description: "Agents do not record experiences, reflections, or learned action performance.",
        simulationOptions: { memoryEnabled: false }
      },
      {
        id: "memory-enabled",
        label: "Memory enabled",
        description: "Agents retain bounded experiences and use measured performance.",
        simulationOptions: { memoryEnabled: true }
      }
    ]
  },
  scarcity: {
    title: "Resource scarcity",
    description: "Compare a constrained starting inventory with the normal seeded inventory.",
    independentVariable: "Starting resource multiplier",
    variants: [
      {
        id: "scarce-resources",
        label: "Scarce resources",
        description: "All starting resource balances are scaled to 25%.",
        agentGenerationOptions: { startingResourceMultiplier: 0.25 }
      },
      {
        id: "baseline-resources",
        label: "Baseline resources",
        description: "Agents retain their normal seeded resource balances.",
        agentGenerationOptions: { startingResourceMultiplier: 1 }
      }
    ]
  },
  diversity: {
    title: "Personality diversity",
    description: "Compare a narrow personality distribution with the full seeded range.",
    independentVariable: "Personality trait spread",
    variants: [
      {
        id: "low-diversity",
        label: "Low diversity",
        description: "Traits are drawn from a narrow range around 0.5.",
        agentGenerationOptions: { personalityDiversity: 0.2 }
      },
      {
        id: "high-diversity",
        label: "High diversity",
        description: "Traits use the full seeded range from 0.15 to 0.85.",
        agentGenerationOptions: { personalityDiversity: 1 }
      }
    ]
  },
  coordination: {
    title: "Centralized vs. decentralized coordination",
    description: "Compare peer-driven exchange with a central rule that reallocates essential-resource surpluses.",
    independentVariable: "Essential-resource coordination rule",
    variants: [
      {
        id: "decentralized",
        label: "Decentralized",
        description: "Agents rely on their own inventories and peer market trades.",
        simulationOptions: { coordinationMode: "decentralized" }
      },
      {
        id: "centralized",
        label: "Centralized",
        description: "A deterministic coordinator transfers available food and energy to agents unable to meet consumption.",
        simulationOptions: { coordinationMode: "centralized" }
      }
    ]
  },
  adaptability: {
    title: "Adaptability",
    description: "Compare constrained and unmodified adaptability traits while keeping other seeded traits constant.",
    independentVariable: "Agent adaptability trait multiplier",
    variants: [
      {
        id: "lower-adaptability",
        label: "Lower adaptability",
        description: "Adaptability traits are scaled to 20%.",
        agentGenerationOptions: { adaptabilityMultiplier: 0.2 }
      },
      {
        id: "baseline-adaptability",
        label: "Baseline adaptability",
        description: "Agents retain their seeded adaptability traits.",
        agentGenerationOptions: { adaptabilityMultiplier: 1 }
      }
    ]
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getExperimentDefinition(type) {
  const definition = DEFINITIONS[type];
  return definition ? clone({ type, ...definition }) : null;
}

function listExperimentDefinitions() {
  return Object.keys(DEFINITIONS).map((type) => getExperimentDefinition(type));
}

module.exports = {
  getExperimentDefinition,
  listExperimentDefinitions
};
