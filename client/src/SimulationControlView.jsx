import { Activity, ArrowLeftRight, Brain, CloudSun, HeartHandshake, HeartPulse, Sparkles, Users, Zap } from "lucide-react";
import SimulationControls from "./SimulationControls.jsx";

function SimulationControlView({ world, onCommand, busy, error }) {
  const metrics = world.lastTickMetrics;
  const actionEntries = Object.entries(metrics?.actionCounts || {});
  const maxActionCount = Math.max(1, ...actionEntries.map(([, count]) => count));

  return (
    <div className="page-content simulation-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> WORLD ARCHITECT CONSOLE <span className="eyebrow-version">SEEDED RUN</span></div>
          <h1>Simulation control</h1>
          <p className="page-subtitle">Advance the world one decision cycle at a time, or let it run at a controlled speed.</p>
        </div>
      </section>

      <SimulationControls world={world} onCommand={onCommand} busy={busy} error={error} />

      <section className="simulation-metrics" aria-label="Simulation metrics">
        <article className="panel simulation-stat">
          <span><Activity size={15} /> Current tick</span>
          <strong>{world.tick.toLocaleString()}</strong>
          <small>{metrics ? "Completed decision cycles" : "No tick has completed yet"}</small>
        </article>
        <article className="panel simulation-stat">
          <span><Users size={15} /> Active agents</span>
          <strong>{world.population.active} <small>/ {world.population.total}</small></strong>
          <small>Profiles participating in the simulation</small>
        </article>
        <article className="panel simulation-stat">
          <span><ArrowLeftRight size={15} /> Market trades</span>
          <strong>{metrics?.trades ?? 0}</strong>
          <small>Completed resource exchanges</small>
        </article>
        <article className="panel simulation-stat">
          <span><HeartHandshake size={15} /> Social interactions</span>
          <strong>{metrics?.socialInteractions ?? 0}</strong>
          <small>{metrics?.socialProposals ?? 0} invitations · {metrics?.relationshipsFormed ?? 0} new relationships</small>
        </article>
        <article className="panel simulation-stat">
          <span><Zap size={15} /> Blocked consumption</span>
          <strong>{metrics?.blockedConsumption ?? 0}</strong>
          <small>Unmet food or energy use</small>
        </article>
        <article className="panel simulation-stat">
          <span><Activity size={15} /> Decisions this tick</span>
          <strong>{metrics?.decisions ?? 0}</strong>
          <small>Utility-selected agent actions</small>
        </article>
        <article className="panel simulation-stat">
          <span><Brain size={15} /> Successful outcomes</span>
          <strong>{metrics ? `${metrics.decisionSuccessRate}%` : "—"}</strong>
          <small>{metrics?.successfulDecisions ?? 0} decisions recorded as effective</small>
        </article>
        <article className="panel simulation-stat">
          <span><Sparkles size={15} /> Reflections</span>
          <strong>{metrics?.reflections ?? 0}</strong>
          <small>Programmatic reflections this tick</small>
        </article>
        <article className="panel simulation-stat">
          <span><CloudSun size={15} /> Active world events</span>
          <strong>{world.eventSummary.active}</strong>
          <small>{metrics?.generatedEvents?.length ?? 0} generated · {metrics?.resolvedEvents?.length ?? 0} resolved this tick</small>
        </article>
        <article className="panel simulation-stat">
          <span><HeartPulse size={15} /> Average wellbeing</span>
          <strong>{metrics ? `${metrics.averageWellbeing}%` : "—"}</strong>
          <small>Measured after the latest tick</small>
        </article>
      </section>

      <section className="panel action-distribution">
        <div className="panel-heading">
          <div><h3>Latest decision distribution</h3><p>Observed outcomes, not a predicted or assumed result</p></div>
          <span className="count-chip">{String(actionEntries.reduce((sum, [, count]) => sum + count, 0)).padStart(2, "0")}</span>
        </div>
        {actionEntries.length ? (
          <div className="action-bars">
            {actionEntries.map(([action, count]) => (
              <div className="action-bar-row" key={action}>
                <span>{action}</span>
                <div className="action-bar-track"><span style={{ width: `${(count / maxActionCount) * 100}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-tick-yet">Run or step the simulation to measure actual agent decisions.</div>
        )}
      </section>
      <p className="simulation-scope-note">M6 stores bounded private experiences, periodically reflects on measured outcomes, and adjusts future utility scores. Memories remain local to each agent's own perception.</p>
    </div>
  );
}

export default SimulationControlView;
