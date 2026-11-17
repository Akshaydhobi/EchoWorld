const path = require("node:path");
const { Worker } = require("node:worker_threads");
const {
  completeExperiment,
  createExperiment,
  failExperiment,
  getExperiment,
  markExperimentRunning,
  updateExperimentProgress
} = require("./experimentStore");

function startExperiment(input, publish = () => {}) {
  const experiment = createExperiment(input);
  let worker;
  try {
    worker = new Worker(path.join(__dirname, "experimentWorker.js"), {
      workerData: {
        type: experiment.type,
        seed: experiment.seed,
        repeats: experiment.repeats,
        ticks: experiment.ticks
      }
    });
  } catch (error) {
    failExperiment(experiment.id, error.message);
    throw error;
  }

  const runningExperiment = markExperimentRunning(experiment.id);
  publish("started", runningExperiment);
  worker.on("message", (message) => {
    if (message.type === "progress") {
      const updated = updateExperimentProgress(experiment.id, message.progress);
      if (updated) publish("progress", updated);
    } else if (message.type === "completed") {
      publish("completed", completeExperiment(experiment.id, message.results));
    } else if (message.type === "failed") {
      publish("failed", failExperiment(experiment.id, message.error));
    }
  });
  worker.on("error", (error) => {
    publish("failed", failExperiment(experiment.id, error.message));
  });
  worker.on("exit", (code) => {
    const latest = getExperiment(experiment.id);
    if (code !== 0 && latest?.status !== "failed") {
      publish("failed", failExperiment(experiment.id, `Experiment worker exited with code ${code}.`));
    } else if (latest?.status === "running") {
      publish("failed", failExperiment(experiment.id, "Experiment worker exited without returning results."));
    }
  });
  return runningExperiment;
}

module.exports = { startExperiment };
