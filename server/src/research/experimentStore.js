const { getExperimentDefinition } = require("./experimentDefinitions");

const MAX_EXPERIMENTS = 50;
const MAX_TICKS = 100;
const MAX_REPEATS = 5;
const SEED_STEP = 7919;

let experiments = [];
let sequence = 0;

class ExperimentStoreError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ExperimentStoreError";
    this.statusCode = statusCode;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateExperimentInput(input) {
  const allowedFields = new Set(["type", "seed", "repeats", "ticks"]);
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !allowedFields.has(key))) {
    throw new ExperimentStoreError("Experiment request contains unsupported fields.");
  }
  if (typeof input.type !== "string" || !getExperimentDefinition(input.type)) {
    throw new ExperimentStoreError("Experiment type is not recognized.");
  }
  const seed = input.seed === undefined ? 2026 : input.seed;
  const repeats = input.repeats === undefined ? 3 : input.repeats;
  const ticks = input.ticks === undefined ? 20 : input.ticks;
  if (!Number.isSafeInteger(seed) ||
      !Number.isSafeInteger(seed + (repeats - 1) * SEED_STEP)) {
    throw new ExperimentStoreError("Experiment seed and repeat range must be safe integers.");
  }
  if (!Number.isSafeInteger(repeats) || repeats < 1 || repeats > MAX_REPEATS) {
    throw new ExperimentStoreError(`Experiment repeats must be from 1 to ${MAX_REPEATS}.`);
  }
  if (!Number.isSafeInteger(ticks) || ticks < 5 || ticks > MAX_TICKS) {
    throw new ExperimentStoreError(`Experiment ticks must be from 5 to ${MAX_TICKS}.`);
  }
  return { type: input.type, seed, repeats, ticks };
}

function createExperiment(input) {
  const configuration = validateExperimentInput(input);
  if (experiments.some((experiment) =>
    experiment.status === "queued" || experiment.status === "running"
  )) {
    throw new ExperimentStoreError("Another experiment is already running.", 409);
  }
  if (experiments.length >= MAX_EXPERIMENTS) {
    throw new ExperimentStoreError(
      `The in-memory experiment limit of ${MAX_EXPERIMENTS} has been reached. Restart the API to clear it.`,
      429
    );
  }
  const definition = getExperimentDefinition(configuration.type);
  sequence += 1;
  const experiment = {
    id: `experiment-${String(sequence).padStart(4, "0")}`,
    type: configuration.type,
    title: definition.title,
    description: definition.description,
    seed: configuration.seed,
    repeats: configuration.repeats,
    ticks: configuration.ticks,
    status: "queued",
    progress: {
      completedRuns: 0,
      totalRuns: definition.variants.length * configuration.repeats,
      currentRun: null,
      currentTick: 0,
      totalTicks: configuration.ticks
    },
    results: null,
    error: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  experiments.push(experiment);
  return clone(experiment);
}

function getExperiment(id) {
  const experiment = experiments.find((item) => item.id === id);
  return experiment ? clone(experiment) : null;
}

function listExperiments() {
  return {
    count: experiments.length,
    experiments: experiments.slice().reverse().map((experiment) => ({
      ...clone(experiment),
      results: experiment.results ? {
        seeds: [...experiment.results.seeds],
        variants: experiment.results.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          summary: clone(variant.summary)
        })),
        pairedDifferences: clone(experiment.results.pairedDifferences)
      } : null
    }))
  };
}

function updateExperiment(id, update) {
  const experiment = experiments.find((item) => item.id === id);
  if (!experiment) throw new ExperimentStoreError("Experiment was not found.", 404);
  Object.assign(experiment, update);
  return clone(experiment);
}

function markExperimentRunning(id) {
  return updateExperiment(id, { status: "running" });
}

function updateExperimentProgress(id, progress) {
  const current = experiments.find((item) => item.id === id);
  if (!current || current.status !== "running") return null;
  return updateExperiment(id, { progress: { ...current.progress, ...progress } });
}

function completeExperiment(id, results) {
  return updateExperiment(id, {
    status: "completed",
    results: clone(results),
    progress: {
      completedRuns: results.totalRuns,
      totalRuns: results.totalRuns,
      currentRun: null,
      currentTick: results.ticks,
      totalTicks: results.ticks
    },
    completedAt: new Date().toISOString(),
    error: null
  });
}

function failExperiment(id, message) {
  return updateExperiment(id, {
    status: "failed",
    error: message,
    completedAt: new Date().toISOString(),
    progress: { ...experiments.find((item) => item.id === id)?.progress }
  });
}

module.exports = {
  ExperimentStoreError,
  completeExperiment,
  createExperiment,
  failExperiment,
  getExperiment,
  listExperiments,
  markExperimentRunning,
  updateExperimentProgress,
  validateExperimentInput
};
