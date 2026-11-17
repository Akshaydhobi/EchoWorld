const { parentPort, workerData } = require("node:worker_threads");
const { runExperiment } = require("./experimentRunner");

try {
  const results = runExperiment(workerData, (progress) => {
    parentPort.postMessage({ type: "progress", progress });
  });
  parentPort.postMessage({ type: "completed", results });
} catch (error) {
  parentPort.postMessage({
    type: "failed",
    error: error.message || "Experiment execution failed."
  });
}
