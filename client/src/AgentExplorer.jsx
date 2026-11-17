import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Brain,
  HeartPulse,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap
} from "lucide-react";
import { socket } from "./socket.js";
import { apiFetch } from "./apiClient.js";

const COMMUNITY_OPTIONS = [
  { id: "", label: "All communities" },
  { id: "greenfield", label: "Greenfield" },
  { id: "metrocore", label: "MetroCore" },
  { id: "novadistrict", label: "NovaDistrict" }
];

const ROLE_OPTIONS = [
  ["", "All roles"],
  ["entrepreneur", "Entrepreneur"],
  ["farmer", "Farmer"],
  ["engineer", "Engineer"],
  ["researcher", "Researcher"],
  ["trader", "Trader"],
  ["healthcareWorker", "Healthcare worker"],
  ["teacher", "Teacher"],
  ["citizen", "General citizen"]
];

const TRAIT_LABELS = {
  cooperation: "Cooperation",
  riskTolerance: "Risk tolerance",
  curiosity: "Curiosity",
  adaptability: "Adaptability",
  resourceSavingPreference: "Resource saving"
};

function TraitBar({ label, value }) {
  return (
    <div className="trait-row">
      <div className="trait-label"><span>{label}</span><strong>{Math.round(value * 100)}</strong></div>
      <div className="trait-track"><span style={{ width: `${value * 100}%` }} /></div>
    </div>
  );
}

function AgentDetail({ agent, agents }) {
  const agentsById = new Map(agents.map((person) => [person.id, person]));
  const memoriesByTick = new Map(agent.state.memory.shortTerm.map((memory) => [memory.tick, memory]));

  return (
    <div className="agent-detail">
      <div className="agent-detail-top">
        <div className="agent-portrait">{agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
        <div><h2>{agent.name}</h2><p>{agent.roleLabel}<span> · </span>{agent.community.name}</p></div>
        <span className="agent-id">{agent.id.toUpperCase()}</span>
      </div>

      <section className="detail-section">
        <div className="detail-heading"><Sparkles size={14} /><h3>Personality profile</h3></div>
        <div className="trait-list">
          {Object.entries(agent.personality).map(([trait, value]) => (
            <TraitBar key={trait} label={TRAIT_LABELS[trait]} value={value} />
          ))}
        </div>
      </section>

      <section className="detail-section">
        <div className="detail-heading"><Target size={14} /><h3>Goals</h3></div>
        <div className="goal-card"><span>SHORT-TERM</span><p>{agent.goals.shortTerm[0]}</p></div>
        <div className="goal-card"><span>LONG-TERM</span><p>{agent.goals.longTerm[0]}</p></div>
      </section>

      <section className="detail-section">
        <div className="detail-heading"><HeartPulse size={14} /><h3>Current wellbeing</h3></div>
        <div className="wellbeing-grid">
          <div className="wellbeing-card"><span><Zap size={13} /> Energy</span><strong>{agent.state.energy}<small>/100</small></strong></div>
          <div className="wellbeing-card"><span><HeartPulse size={13} /> Wellbeing</span><strong>{agent.state.wellbeing}<small>/100</small></strong></div>
        </div>
        <div className="needs-grid">{Object.entries(agent.state.needs).map(([need, value]) => (
          <div className="need-pill" key={need}><span>{need}</span><strong>{value}</strong></div>
        ))}</div>
      </section>

      <section className="detail-section">
        <div className="detail-heading"><Shield size={14} /><h3>Current resources</h3></div>
        <div className="agent-resource-list">{Object.entries(agent.state.resources).map(([resource, amount]) => (
          <div className="agent-resource" key={resource}><span>{resource === "money" ? "Credits" : resource}</span><strong>{amount}</strong></div>
        ))}</div>
      </section>

      <section className="detail-section">
        <div className="detail-heading"><Users size={14} /><h3>Relationships</h3></div>
        {!agent.state.relationships.length
          ? <p>No relationships established yet. Cooperative decisions can build trust with neighbors.</p>
          : <div className="agent-relationship-list">{agent.state.relationships.map((relationship) => {
            const person = agentsById.get(relationship.agentId);
            return (
              <span key={relationship.agentId}>
                {person?.name || relationship.agentId} · {relationship.trust}% trust
              </span>
            );
          })}</div>}
      </section>

      <section className="detail-section history-section">
        <div className="detail-heading"><Brain size={14} /><h3>Memory &amp; decisions</h3></div>
        <p>Experiences are retained privately; measured action outcomes adjust future utility scores.</p>
        <div className="history-counts">
          <span>{agent.state.memory.shortTerm.length} short-term memories</span>
          <span>{agent.state.decisionHistory.length} decisions</span>
          <span>{agent.state.socialHistory.length} social records</span>
          <span>{agent.state.learning.reflections} reflections</span>
        </div>
        <div className="learning-summary">
          <span>{agent.state.learning.preferredAction
            ? `Most effective so far: ${agent.state.learning.preferredAction}`
            : "Collecting evidence before preferring an action"}</span>
          <small>{agent.state.learning.strategyAdjustments} strategy adjustments</small>
        </div>
        <div className="decision-history-list">
          {agent.state.decisionHistory.slice(-4).reverse().map((decision) => (
            <div className="decision-history-row" key={`${decision.tick}-${decision.action}`}>
              <span>Tick {decision.tick} · {decision.action}</span>
              <small>
                {decision.outcome}
                {memoriesByTick.has(decision.tick) && (
                  <i className={`learning-result ${memoriesByTick.get(decision.tick).successful ? "success" : ""}`}>
                    {memoriesByTick.get(decision.tick).successful ? " · effective" : " · ineffective"}
                  </i>
                )}
              </small>
            </div>
          ))}
          {!agent.state.decisionHistory.length && (
            <div className="agent-list-message">No decisions recorded yet.</div>
          )}
        </div>
        {agent.state.memory.longTerm.slice(-3).reverse().map((reflection) => (
          <div className="reflection-card" key={`reflection-${reflection.tick}`}>
            <span>REFLECTION · TICK {reflection.tick} · {reflection.successRate}% SUCCESS</span>
            <p>{reflection.insight}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function AgentExplorer({ onBack }) {
  const [agents, setAgents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [community, setCommunity] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAgents() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (community) params.set("community", community);
      if (role) params.set("role", role);
      if (search.trim()) params.set("search", search.trim());
      try {
        const response = await apiFetch(`/api/agents?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Agent API returned ${response.status}`);
        const result = await response.json();
        setAgents(result.agents);
        setSelectedId((current) => result.agents.some((agent) => agent.id === current)
          ? current
          : result.agents[0]?.id || "");
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load agents.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadAgents();
    return () => controller.abort();
  }, [community, role, search]);

  useEffect(() => {
    function handleSimulationUpdate(update) {
      if (!update.agentUpdates) return;
      const updatesById = new Map(update.agentUpdates.map((item) => [item.id, item.state]));
      setAgents((currentAgents) => currentAgents.map((agent) => {
        const state = updatesById.get(agent.id);
        return state ? { ...agent, state: { ...agent.state, ...state } } : agent;
      }));
    }
    socket.on("simulation:update", handleSimulationUpdate);
    return () => socket.off("simulation:update", handleSimulationUpdate);
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId),
    [agents, selectedId]
  );

  return (
    <div className="page-content explorer-content">
      <section className="page-heading explorer-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> POPULATION DIRECTORY <span className="eyebrow-version">30 INITIAL AGENTS</span></div>
          <h1>Agent explorer</h1>
          <p className="page-subtitle">Inspect each profile, starting state, and programmed goals.</p>
        </div>
        <button className="secondary-button" onClick={onBack}><ArrowLeft size={14} /> World overview</button>
      </section>

      <section className="agent-explorer-layout">
        <article className="panel agent-list-panel">
          <div className="agent-list-header">
            <div><h3>Population</h3><p>Seeded from world seed 2026</p></div>
            <span className="count-chip">{loading ? "…" : String(agents.length).padStart(2, "0")}</span>
          </div>
          <label className="agent-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or role" /></label>
          <div className="agent-filters">
            <select aria-label="Filter by community" value={community} onChange={(event) => setCommunity(event.target.value)}>
              {COMMUNITY_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <select aria-label="Filter by role" value={role} onChange={(event) => setRole(event.target.value)}>
              {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="agent-list" aria-live="polite">
            {error && <div className="agent-list-message error-message">{error}</div>}
            {!error && loading && <div className="agent-list-message">Loading population…</div>}
            {!error && !loading && agents.length === 0 && <div className="agent-list-message">No agents match these filters.</div>}
            {!loading && !error && agents.map((agent) => (
              <button className={`agent-list-item${selectedId === agent.id ? " selected" : ""}`} key={agent.id} onClick={() => setSelectedId(agent.id)}>
                <span className="agent-avatar">{agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                <span className="agent-list-copy"><strong>{agent.name}</strong><small>{agent.roleLabel}<span> · </span>{agent.community.name}</small></span>
                <span className="agent-energy"><Zap size={11} /> {agent.state.energy}</span>
              </button>
            ))}
          </div>
          <div className="agent-list-footer"><Users size={13} /> Profiles reset to the same initial state on server restart.</div>
        </article>

        <article className="panel agent-profile-panel">
          {selectedAgent
            ? <AgentDetail agent={selectedAgent} agents={agents} />
            : <div className="empty-agent-detail"><Users size={24} /><strong>Select an agent</strong><span>Choose a profile from the population list.</span></div>}
        </article>
      </section>
    </div>
  );
}

export default AgentExplorer;
