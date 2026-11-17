const { stepSimulation } = require("./engine");
const worldStore = require("./worldStore");
const { resetTransactions } = require("../economy/transactionStore");
const { resetSocialInteractions } = require("../social/socialInteractionStore");

const BASE_TICK_INTERVAL_MS = 2500;

class SimulationControlError extends Error {
  constructor(message, statusCode = 409) {
    super(message);
    this.name = "SimulationControlError";
    this.statusCode = statusCode;
  }
}

class SimulationController {
  constructor(publish) {
    this.publish = publish;
    this.timer = null;
  }

  start() {
    const world = worldStore.getWorld();
    if (world.simulationStatus === "running") {
      throw new SimulationControlError("Simulation is already running.");
    }
    if (world.simulationStatus === "paused") {
      throw new SimulationControlError("Simulation is paused; use resume instead.");
    }
    worldStore.setSimulationStatus("running");
    worldStore.setRuntimeError(null);
    this.publish("started", { world: worldStore.getWorld() });
    this.scheduleNextTick();
    return worldStore.getWorld();
  }

  pause() {
    if (worldStore.getWorld().simulationStatus !== "running") {
      throw new SimulationControlError("Only a running simulation can be paused.");
    }
    this.clearTimer();
    worldStore.setSimulationStatus("paused");
    this.publish("paused", { world: worldStore.getWorld() });
    return worldStore.getWorld();
  }

  resume() {
    if (worldStore.getWorld().simulationStatus !== "paused") {
      throw new SimulationControlError("Only a paused simulation can be resumed.");
    }
    worldStore.setSimulationStatus("running");
    worldStore.setRuntimeError(null);
    this.publish("resumed", { world: worldStore.getWorld() });
    this.scheduleNextTick();
    return worldStore.getWorld();
  }

  step() {
    if (worldStore.getWorld().simulationStatus === "running") {
      throw new SimulationControlError("Pause the simulation before single-stepping.");
    }
    const result = stepSimulation();
    this.publish("tick", result);
    return result;
  }

  reset(seed) {
    this.clearTimer();
    worldStore.resetWorld(seed);
    resetTransactions();
    resetSocialInteractions();
    const resetWorld = worldStore.getWorld();
    this.publish("reset", { world: resetWorld });
    return resetWorld;
  }

  setSpeed(speedMultiplier) {
    try {
      worldStore.setSpeedMultiplier(speedMultiplier);
    } catch (error) {
      throw new SimulationControlError(error.message, 400);
    }
    const world = worldStore.getWorld();
    this.publish("configuration", { world });
    if (world.simulationStatus === "running") {
      this.clearTimer();
      this.scheduleNextTick();
    }
    return world;
  }

  clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduleNextTick() {
    const world = worldStore.getWorld();
    const delay = BASE_TICK_INTERVAL_MS / world.speedMultiplier;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (worldStore.getWorld().simulationStatus !== "running") return;
      try {
        this.publish("tick", stepSimulation());
      } catch (error) {
        this.clearTimer();
        worldStore.setSimulationStatus("paused");
        worldStore.setRuntimeError(error.message);
        console.error("Simulation tick failed:", error);
        try {
          this.publish("error", { world: worldStore.getWorld() });
        } catch (broadcastError) {
          console.error("Could not broadcast simulation failure:", broadcastError);
        }
        return;
      }
      if (worldStore.getWorld().simulationStatus === "running") {
        this.scheduleNextTick();
      }
    }, delay);
  }
}

module.exports = { SimulationControlError, SimulationController };
