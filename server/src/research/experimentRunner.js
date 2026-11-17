const { getAgentRecords } = require("../agents/agentStore");
const { resetTransactions } = require("../economy/transactionStore");
const { resetSocialInteractions } = require("../social/socialInteractionStore");
const { stepSimulation } = require("../simulation/engine");
const worldStore = require("../simulation/worldStore");
const { getExperimentDefinition } = require("./experimentDefinitions");

const RESOURCES = ["food", "money", "energy", "materials", "knowledge", "healthcare"];
const SEED_STEP = 7919;

function round(value) {
  return Math.round(value * 100) / 100;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function summarize(values) {
  const average = mean(values);
  if (average === null) return { mean: null, standardDeviation: null, count: 0 };
  const variance = mean(values.map((value) => (value - average) ** 2));
  return {
    mean: round(average),
    standardDeviation: round(Math.sqrt(variance)),
    count: values.length
  };
}

function calculateGini(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (!sorted.length || total === 0) return 0;
  const weightedTotal = sorted.reduce(
    (sum, value, index) => sum + (2 * (index + 1) - sorted.length - 1) * value,
    0
  );
  return round(Math.max(0, weightedTotal / (sorted.length * total) * 100));
}

function meanResourceTotals(resourceSamples) {
  return Object.fromEntries(RESOURCES.map((resource) => [
    resource,
    round(mean(resourceSamples.map((sample) => sample[resource])) || 0)
  ]));
}

function runVariant(seed, ticks, variant, reportProgress) {
  worldStore.resetWorld(seed, variant.agentGenerationOptions);
  resetTransactions();
  resetSocialInteractions();
  const initialAgents = getAgentRecords();
  const baselineWellbeing = mean(initialAgents.map(({ state }) => state.wellbeing));
  const resourceSamples = [];
  const wellbeingSamples = [];
  let totalProposals = 0;
  let totalInteractions = 0;
  let totalSuccessfulDecisions = 0;
  let totalDecisions = 0;
  let eventsGenerated = 0;
  let coordinatedTransfers = 0;
  let recoveryStartedAt = null;
  let recoveryTimeTicks = null;
  let finalTickMetrics = null;

  for (let tick = 1; tick <= ticks; tick += 1) {
    const result = stepSimulation({
      memoryEnabled: variant.simulationOptions?.memoryEnabled ?? true,
      coordinationMode: variant.simulationOptions?.coordinationMode ?? "decentralized"
    });
    finalTickMetrics = result.metrics;
    totalProposals += result.metrics.socialProposals;
    totalInteractions += result.metrics.socialInteractions;
    totalSuccessfulDecisions += result.metrics.successfulDecisions;
    totalDecisions += result.metrics.decisions;
    eventsGenerated += result.metrics.generatedEvents.length;
    coordinatedTransfers += result.metrics.coordinatedTransfers;
    resourceSamples.push(result.metrics.resourceTotals);
    wellbeingSamples.push(result.metrics.averageWellbeing);

    if (recoveryStartedAt === null &&
        result.metrics.averageWellbeing < baselineWellbeing) {
      recoveryStartedAt = tick;
    } else if (recoveryStartedAt !== null &&
        recoveryTimeTicks === null &&
        result.metrics.averageWellbeing >= baselineWellbeing) {
      recoveryTimeTicks = tick - recoveryStartedAt;
    }

    reportProgress({
      currentRun: `${variant.label} · seed ${seed}`,
      currentTick: tick,
      totalTicks: ticks
    });
  }

  const finalAgents = getAgentRecords();
  const recovered = recoveryTimeTicks !== null;
  const recoveryStatus = recovered
    ? "recovered"
    : recoveryStartedAt === null
      ? "no-decline-observed"
      : "not-recovered-within-run";
  return {
    seed,
    metrics: {
      averageWellbeing: round(mean(wellbeingSamples) || 0),
      finalWellbeing: finalTickMetrics.averageWellbeing,
      cooperationRatePct: totalProposals
        ? round(totalInteractions / totalProposals * 100)
        : null,
      decisionSuccessRatePct: totalDecisions
        ? round(totalSuccessfulDecisions / totalDecisions * 100)
        : null,
      wealthGiniPct: calculateGini(finalAgents.map(({ state }) => state.resources.money)),
      resourcesAvailable: meanResourceTotals(resourceSamples),
      finalResources: finalTickMetrics.resourceTotals,
      recoveryTimeTicks,
      recoveryStatus,
      eventsGenerated,
      coordinatedTransfers
    }
  };
}

function aggregateVariantRuns(runs) {
  const metrics = runs.map((run) => run.metrics);
  return {
    averageWellbeing: summarize(metrics.map((item) => item.averageWellbeing)),
    finalWellbeing: summarize(metrics.map((item) => item.finalWellbeing)),
    cooperationRatePct: summarize(metrics
      .map((item) => item.cooperationRatePct)
      .filter((value) => value !== null)),
    decisionSuccessRatePct: summarize(metrics
      .map((item) => item.decisionSuccessRatePct)
      .filter((value) => value !== null)),
    wealthGiniPct: summarize(metrics.map((item) => item.wealthGiniPct)),
    recoveryTimeTicks: summarize(metrics
      .map((item) => item.recoveryTimeTicks)
      .filter((value) => value !== null)),
    recoveryStatuses: Object.fromEntries([
      "recovered",
      "no-decline-observed",
      "not-recovered-within-run"
    ].map((status) => [
      status,
      metrics.filter((item) => item.recoveryStatus === status).length
    ])),
    resourcesAvailable: Object.fromEntries(RESOURCES.map((resource) => [
      resource,
      summarize(metrics.map((item) => item.resourcesAvailable[resource]))
    ])),
    finalResources: Object.fromEntries(RESOURCES.map((resource) => [
      resource,
      summarize(metrics.map((item) => item.finalResources[resource]))
    ])),
    eventsGenerated: summarize(metrics.map((item) => item.eventsGenerated)),
    coordinatedTransfers: summarize(metrics.map((item) => item.coordinatedTransfers))
  };
}

function calculatePairedDifferences(variants) {
  const [baseline, comparison] = variants;
  const metrics = [
    "averageWellbeing",
    "finalWellbeing",
    "cooperationRatePct",
    "decisionSuccessRatePct",
    "wealthGiniPct",
    "recoveryTimeTicks"
  ];
  return Object.fromEntries(metrics.map((metric) => {
    const baselineBySeed = new Map(baseline.runs.map((run) => [run.seed, run.metrics[metric]]));
    const differences = comparison.runs
      .filter((run) => baselineBySeed.has(run.seed) &&
        baselineBySeed.get(run.seed) !== null &&
        run.metrics[metric] !== null)
      .map((run) => run.metrics[metric] - baselineBySeed.get(run.seed));
    return [metric, summarize(differences)];
  }));
}

function runExperiment(configuration, reportProgress = () => {}) {
  const definition = getExperimentDefinition(configuration.type);
  if (!definition) throw new TypeError("Experiment type is not recognized.");
  const totalRuns = definition.variants.length * configuration.repeats;
  let completedRuns = 0;
  const variants = definition.variants.map((variant) => {
    const runs = [];
    for (let repetition = 0; repetition < configuration.repeats; repetition += 1) {
      const seed = configuration.seed + repetition * SEED_STEP;
      const run = runVariant(seed, configuration.ticks, variant, (progress) => {
        reportProgress({
          ...progress,
          completedRuns,
          totalRuns
        });
      });
      runs.push(run);
      completedRuns += 1;
      reportProgress({
        completedRuns,
        totalRuns,
        currentRun: null,
        currentTick: configuration.ticks,
        totalTicks: configuration.ticks
      });
    }
    return {
      id: variant.id,
      label: variant.label,
      description: variant.description,
      runs,
      summary: aggregateVariantRuns(runs)
    };
  });
  return {
    type: definition.type,
    ticks: configuration.ticks,
    repeats: configuration.repeats,
    totalRuns,
    seeds: Array.from(
      { length: configuration.repeats },
      (_value, index) => configuration.seed + index * SEED_STEP
    ),
    variants,
    pairedDifferences: calculatePairedDifferences(variants)
  };
}

module.exports = {
  calculateGini,
  runExperiment
};
