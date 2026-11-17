import {
  Gauge,
  Pause,
  Play,
  RotateCcw,
  StepForward
} from "lucide-react";

function SimulationControls({ world, onCommand, busy, error }) {
  const isRunning = world.simulationStatus === "running";
  const isPaused = world.simulationStatus === "paused";
  const action = isRunning ? "pause" : isPaused ? "resume" : "start";
  const actionLabel = isRunning ? "Pause" : isPaused ? "Resume" : "Start";

  function resetWorld() {
    if (window.confirm("Reset ECHO CITY and recreate all 30 agents from the current seed?")) {
      onCommand("reset", { seed: world.seed });
    }
  }

  return (
    <section className="simulation-controls panel" aria-label="Simulation controls">
      <div className="simulation-control-main">
        <div className="simulation-state">
          <span className={`simulation-state-dot ${isRunning ? "running" : ""}`} />
          <span className="simulation-state-copy">
            <strong>{isRunning ? "Simulation running" : isPaused ? "Simulation paused" : "Simulation ready"}</strong>
            <small>Tick {world.tick.toLocaleString()} <span>·</span> Seed {world.seed}</small>
          </span>
        </div>
        <div className="simulation-buttons">
          <button className="primary-button" disabled={busy} onClick={() => onCommand(action)}>
            {isRunning ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            {actionLabel}
          </button>
          <button
            className="secondary-button"
            disabled={busy || isRunning}
            onClick={() => onCommand("step")}
            title={isRunning ? "Pause the simulation before single-stepping" : "Advance exactly one tick"}
          >
            <StepForward size={14} /> Step
          </button>
          <button className="icon-button reset-control" disabled={busy} onClick={resetWorld} aria-label="Reset world" title="Reset world and agents">
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
      <div className="speed-control">
        <Gauge size={14} />
        <label htmlFor="simulation-speed">Tick speed</label>
        <select
          id="simulation-speed"
          value={world.speedMultiplier}
          disabled={busy}
          onChange={(event) => onCommand("speed", { speedMultiplier: Number(event.target.value) })}
        >
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
          <option value="4">4×</option>
        </select>
      </div>
      {(error || world.lastError) && (
        <p className="simulation-error" role="alert">{error || `Simulation paused after an error: ${world.lastError}`}</p>
      )}
    </section>
  );
}

export default SimulationControls;
