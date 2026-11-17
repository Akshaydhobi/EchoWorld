import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FlaskConical,
  Play,
  Radio,
  ShieldCheck
} from "lucide-react";
import { socket } from "./socket.js";
import { apiFetch } from "./apiClient.js";

const METRICS = [
  ["Average wellbeing", "averageWellbeing", "/ 100"],
  ["Final wellbeing", "finalWellbeing", "/ 100"],
  ["Cooperation rate", "cooperationRatePct", "%"],
  ["Decision success", "decisionSuccessRatePct", "%"],
  ["Wealth inequality", "wealthGiniPct", " Gini %"],
  ["Recovery time", "recoveryTimeTicks", " ticks"]
];

const RESOURCES = [
  ["food", "Food"],
  ["money", "Credits"],
  ["energy", "Energy"],
  ["materials", "Materials"],
  ["knowledge", "Knowledge"],
  ["healthcare", "Healthcare"]
];

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Number(value).toFixed(2)}${suffix}`;
}

function ExperimentMetric({ label, summary, suffix }) {
  return (
    <div className="research-metric">
      <span>{label}</span>
      <strong>{formatNumber(summary?.mean, suffix)}</strong>
      <small>
        {summary?.standardDeviation === null || summary?.standardDeviation === undefined
          ? "No measurable samples"
          : `SD ${formatNumber(summary.standardDeviation)} · n=${summary.count}`}
      </small>
    </div>
  );
}

function ResearchLab({ world }) {
  const [catalog, setCatalog] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [seed, setSeed] = useState(world.seed);
  const [repeats, setRepeats] = useState(3);
  const [ticks, setTicks] = useState(20);
  const [comparisonId, setComparisonId] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadExperiments = useCallback(async () => {
    const response = await apiFetch("/api/experiments");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Experiments API returned ${response.status}`);
    setExperiments(result.experiments);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/experiments/catalog").then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Research catalog returned ${response.status}`);
        return result.experiments;
      }),
      apiFetch("/api/experiments").then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Experiments API returned ${response.status}`);
        return result.experiments;
      })
    ]).then(([definitions, savedExperiments]) => {
      if (cancelled) return;
      setCatalog(definitions);
      setExperiments(savedExperiments);
      if (savedExperiments.length) setSelectedId(savedExperiments[0].id);
      if (definitions.length) setSelectedType(definitions[0].type);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message || "Could not load the research laboratory.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleResearchUpdate(update) {
      const experiment = update.experiment;
      if (!experiment) return;
      setExperiments((current) => [
        experiment,
        ...current.filter((item) => item.id !== experiment.id)
      ]);
      setSelectedExperiment((current) =>
        current?.id === experiment.id ? experiment : current
      );
      if (update.event === "completed" || update.event === "failed") {
        setError(update.event === "failed" ? experiment.error : "");
      }
    }
    socket.on("research:update", handleResearchUpdate);
    return () => socket.off("research:update", handleResearchUpdate);
  }, []);

  const hasActiveExperiment = experiments.some((item) =>
    item.status === "queued" || item.status === "running"
  );

  useEffect(() => {
    if (!hasActiveExperiment) return undefined;
    const timer = setInterval(async () => {
      try {
        await loadExperiments();
        if (selectedId) {
          const response = await apiFetch(`/api/experiments/${encodeURIComponent(selectedId)}`);
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || `Experiment API returned ${response.status}`);
          setSelectedExperiment(result.experiment);
        }
      } catch (loadError) {
        setError(loadError.message || "Could not refresh experiment progress.");
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [hasActiveExperiment, loadExperiments, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedExperiment(null);
      return undefined;
    }
    let cancelled = false;
    apiFetch(`/api/experiments/${encodeURIComponent(selectedId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Experiment API returned ${response.status}`);
        if (!cancelled) setSelectedExperiment(result.experiment);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not load experiment details.");
      });
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (!comparisonId || !selectedExperiment ||
        selectedExperiment.status !== "completed") {
      setComparison(null);
      return undefined;
    }
    let cancelled = false;
    const query = new URLSearchParams({
      first: selectedExperiment.id,
      second: comparisonId
    });
    apiFetch(`/api/experiments/compare?${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Comparison API returned ${response.status}`);
        if (!cancelled) setComparison(result);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Could not compare experiments.");
      });
    return () => { cancelled = true; };
  }, [comparisonId, selectedExperiment?.id, selectedExperiment?.status]);

  const definition = useMemo(
    () => catalog.find((item) => item.type === selectedType),
    [catalog, selectedType]
  );
  const comparableExperiments = experiments.filter((item) =>
    item.id !== selectedId &&
    item.type === selectedExperiment?.type &&
    item.status === "completed"
  );

  async function createExperiment(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await apiFetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          seed: Number(seed),
          repeats: Number(repeats),
          ticks: Number(ticks)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Experiment API returned ${response.status}`);
      setSelectedExperiment(result.experiment);
      setSelectedId(result.experiment.id);
      setComparisonId("");
      setComparison(null);
      setExperiments((current) => [
        result.experiment,
        ...current.filter((item) => item.id !== result.experiment.id)
      ]);
    } catch (requestError) {
      setError(requestError.message || "Could not start the experiment.");
    } finally {
      setBusy(false);
    }
  }

  const progress = selectedExperiment?.progress;
  const progressPercent = progress?.totalRuns
    ? Math.round(progress.completedRuns / progress.totalRuns * 100)
    : 0;
  const completedVariants = selectedExperiment?.results?.variants || [];

  return (
    <div className="page-content research-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> CONTROLLED STUDIES <span className="eyebrow-version">M9 RESEARCH LAB</span></div>
          <h1>Research laboratory</h1>
          <p className="page-subtitle">Run repeatable interventions and inspect measured outcomes across seeded societies.</p>
        </div>
      </section>

      <section className="research-integrity panel">
        <span className="research-integrity-icon"><ShieldCheck size={17} /></span>
        <div>
          <strong>Isolated, seeded experiments</strong>
          <p>Each study runs in a separate worker and cannot change ECHO CITY. Results are programmed-model measurements, not claims about conscious agents.</p>
        </div>
        <span className="research-seed"><Radio size={12} /> REPRODUCIBLE RUNS</span>
      </section>

      {error && <p className="research-error" role="alert"><CircleAlert size={14} /> {error}</p>}

      <section className="research-layout">
        <div className="research-sidebar">
          <article className="panel research-setup">
            <div className="panel-heading">
              <div><h3>Configure experiment</h3><p>Paired variants share the same random seeds.</p></div>
              <span className="event-form-icon"><FlaskConical size={15} /></span>
            </div>
            <form className="event-form" onSubmit={createExperiment}>
              <label>
                Research question
                <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} disabled={busy || hasActiveExperiment}>
                  {catalog.map((item) => <option value={item.type} key={item.type}>{item.title}</option>)}
                </select>
              </label>
              {definition && <p className="research-question">{definition.description}</p>}
              <label>
                Base random seed
                <input type="number" value={seed} min={-2147483648} max={2147483647} step="1" onChange={(event) => setSeed(event.target.value)} disabled={busy || hasActiveExperiment} />
              </label>
              <div className="event-form-row">
                <label>
                  Repeats
                  <select value={repeats} onChange={(event) => setRepeats(event.target.value)} disabled={busy || hasActiveExperiment}>
                    {[1, 2, 3, 4, 5].map((count) => <option value={count} key={count}>{count} seeds</option>)}
                  </select>
                </label>
                <label>
                  Ticks per run
                  <select value={ticks} onChange={(event) => setTicks(event.target.value)} disabled={busy || hasActiveExperiment}>
                    {[5, 10, 20, 40, 60, 100].map((count) => <option value={count} key={count}>{count} ticks</option>)}
                  </select>
                </label>
              </div>
              <p className="research-run-count">
                <Activity size={13} /> {definition ? `${definition.variants.length * Number(repeats)} total runs` : "Select an experiment"}
              </p>
              <button className="primary-button event-submit" type="submit" disabled={busy || hasActiveExperiment || loading || !definition}>
                <Play size={14} /> {hasActiveExperiment ? "Experiment running…" : busy ? "Starting…" : "Run experiment"}
              </button>
            </form>
          </article>

          <article className="panel research-history">
            <div className="panel-heading">
              <div><h3>Experiment history</h3><p>In-memory records for this API session</p></div>
              <span className="count-chip">{String(experiments.length).padStart(2, "0")}</span>
            </div>
            <div className="research-history-list">
              {loading ? <div className="event-empty">Loading research records…</div> :
                experiments.length ? experiments.map((experiment) => (
                  <button
                    className={`research-history-item${selectedId === experiment.id ? " selected" : ""}`}
                    key={experiment.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(experiment.id);
                      setComparisonId("");
                      setComparison(null);
                    }}
                  >
                    <span className={`research-state-dot ${experiment.status}`} />
                    <span className="research-history-copy">
                      <strong>{experiment.title}</strong>
                      <small>{experiment.id} · seed {experiment.seed} · {experiment.status}</small>
                    </span>
                    <ArrowRight size={13} />
                  </button>
                )) : <div className="event-empty">No experiments yet. Configure a study to begin.</div>}
            </div>
          </article>
        </div>

        <div className="research-results">
          {selectedExperiment ? (
            <article className="panel research-detail">
              <div className="panel-heading">
                <div>
                  <span className={`research-status ${selectedExperiment.status}`}>{selectedExperiment.status}</span>
                  <h3>{selectedExperiment.title}</h3>
                  <p>{selectedExperiment.description}</p>
                </div>
                <span className="research-id">{selectedExperiment.id}</span>
              </div>

              {selectedExperiment.status === "running" || selectedExperiment.status === "queued" ? (
                <div className="research-progress">
                  <div className="research-progress-heading">
                    <span><Activity size={14} /> {progress?.currentRun || "Preparing seeded runs"}</span>
                    <strong>{progressPercent}%</strong>
                  </div>
                  <div className="research-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
                  <small>{progress?.completedRuns || 0} / {progress?.totalRuns || 0} paired runs complete
                    {progress?.currentTick ? ` · tick ${progress.currentTick} of ${progress.totalTicks}` : ""}
                  </small>
                </div>
              ) : null}

              {selectedExperiment.status === "failed" && (
                <p className="research-error"><CircleAlert size={14} /> {selectedExperiment.error}</p>
              )}

              {selectedExperiment.status === "completed" && selectedExperiment.results && (
                <>
                  <div className="research-run-meta">
                    <span><Clock3 size={13} /> {selectedExperiment.results.ticks} ticks per run</span>
                    <span><BarChart3 size={13} /> {selectedExperiment.results.totalRuns} total runs</span>
                    <span>Seeds: {selectedExperiment.results.seeds.join(", ")}</span>
                  </div>

                  <div className="research-variant-grid">
                    {completedVariants.map((variant) => (
                      <section className="research-variant" key={variant.id}>
                        <div className="research-variant-heading">
                          <div><strong>{variant.label}</strong><p>{variant.description}</p></div>
                          <CheckCircle2 size={15} />
                        </div>
                        <div className="research-metrics-grid">
                          {METRICS.map(([label, key, suffix]) => (
                            <ExperimentMetric key={key} label={label} summary={variant.summary[key]} suffix={suffix} />
                          ))}
                        </div>
                        <div className="research-resource-heading">Mean resources available</div>
                        <div className="research-resource-grid">
                          {RESOURCES.map(([key, label]) => (
                            <span key={key}><small>{label}</small><strong>{formatNumber(variant.summary.resourcesAvailable[key]?.mean)}</strong></span>
                          ))}
                        </div>
                        <div className="research-recovery">
                          <span>Recovery outcomes</span>
                          {Object.entries(variant.summary.recoveryStatuses).map(([status, count]) => (
                            <small key={status}>{status.replaceAll("-", " ")} <strong>{count}</strong></small>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  <section className="research-paired panel">
                    <div className="panel-heading">
                      <div><h3>Paired outcome differences</h3><p>Comparison variant minus baseline, matched by random seed.</p></div>
                      <ArrowDownRight size={15} />
                    </div>
                    <div className="research-delta-grid">
                      {METRICS.map(([label, key, suffix]) => {
                        const difference = selectedExperiment.results.pairedDifferences[key];
                        return (
                          <div className="research-delta" key={key}>
                            <span>{label}</span>
                            <strong>{formatNumber(difference?.mean, suffix)}</strong>
                            <small>{difference?.count || 0} paired seeds · SD {formatNumber(difference?.standardDeviation)}</small>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {comparableExperiments.length > 0 && (
                    <section className="research-compare panel">
                      <div className="panel-heading">
                        <div><h3>Compare another experiment</h3><p>Compare the same intervention across different seed sets.</p></div>
                        <BarChart3 size={15} />
                      </div>
                      <label className="research-compare-select">
                        Completed {selectedExperiment.type} experiment
                        <select value={comparisonId} onChange={(event) => setComparisonId(event.target.value)}>
                          <option value="">Select a saved run</option>
                          {comparableExperiments.map((experiment) => (
                            <option value={experiment.id} key={experiment.id}>{experiment.id} · seed {experiment.seed}</option>
                          ))}
                        </select>
                      </label>
                      {comparison && (
                        <div className="research-cross-compare">
                          {comparison.first.results.variants.map((variant) => {
                            const other = comparison.second.results.variants.find((item) => item.id === variant.id);
                            if (!other) return null;
                            const wellbeingDelta = other.summary.averageWellbeing.mean - variant.summary.averageWellbeing.mean;
                            const inequalityDelta = other.summary.wealthGiniPct.mean - variant.summary.wealthGiniPct.mean;
                            return (
                              <div className="research-cross-row" key={variant.id}>
                                <strong>{variant.label}</strong>
                                <span>Wellbeing {formatNumber(variant.summary.averageWellbeing.mean)} <ArrowRight size={12} /> {formatNumber(other.summary.averageWellbeing.mean)}</span>
                                <small>Δ {formatNumber(wellbeingDelta)} · wealth Gini Δ {formatNumber(inequalityDelta)}</small>
                              </div>
                            );
                          })}
                          <p>These are observed differences between sampled seed sets; they do not establish causation.</p>
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}

              {selectedExperiment.status === "completed" && !selectedExperiment.results && (
                <div className="event-empty">The run completed without a results payload.</div>
              )}
            </article>
          ) : (
            <article className="panel research-empty">
              <span><FlaskConical size={23} /></span>
              <strong>Select or run an experiment</strong>
              <p>Choose a research question to compare measured outcomes across repeatable seeded runs.</p>
            </article>
          )}
        </div>
      </section>
      <footer className="research-footnote">
        <Radio size={13} /> Worker-thread runs use the JavaScript simulation engine. Records are held in memory and clear when the API restarts.
      </footer>
    </div>
  );
}

export default ResearchLab;
