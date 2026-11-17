import { useEffect, useMemo, useState } from "react";
import { HeartHandshake, Network, Users } from "lucide-react";
import { apiFetch } from "./apiClient.js";
import { socket } from "./socket.js";

const COMMUNITIES = [
  { id: "greenfield", name: "Greenfield", x: 170, tone: "emerald" },
  { id: "metrocore", name: "MetroCore", x: 500, tone: "cyan" },
  { id: "novadistrict", name: "NovaDistrict", x: 830, tone: "violet" }
];

function SocialNetworkView({ world }) {
  const [agents, setAgents] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSocialData() {
      try {
        const [agentResponse, relationshipResponse, interactionResponse] = await Promise.all([
          apiFetch("/api/agents"),
          apiFetch("/api/relationships"),
          apiFetch("/api/social-interactions?limit=100")
        ]);
        if (!agentResponse.ok || !relationshipResponse.ok || !interactionResponse.ok) {
          throw new Error("Social network data could not be loaded.");
        }
        const [agentResult, relationshipResult, interactionResult] = await Promise.all([
          agentResponse.json(),
          relationshipResponse.json(),
          interactionResponse.json()
        ]);
        if (!active) return;
        setAgents(agentResult.agents);
        setRelationships(relationshipResult.relationships);
        setInteractions(interactionResult.interactions);
        setSelectedId((current) =>
          agentResult.agents.some((agent) => agent.id === current)
            ? current
            : agentResult.agents[0]?.id || ""
        );
        setError("");
      } catch (loadError) {
        if (active) setError(loadError.message || "Social network data could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }

    function handleSimulationUpdate(update) {
      if (update.event === "tick" || update.event === "reset") loadSocialData();
    }

    loadSocialData();
    socket.on("simulation:update", handleSimulationUpdate);
    return () => {
      active = false;
      socket.off("simulation:update", handleSimulationUpdate);
    };
  }, []);

  const agentsByCommunity = useMemo(() => {
    const groups = new Map(COMMUNITIES.map((community) => [community.id, []]));
    for (const agent of agents) {
      groups.get(agent.communityId)?.push(agent);
    }
    return groups;
  }, [agents]);

  const positions = useMemo(() => {
    const result = new Map();
    for (const community of COMMUNITIES) {
      const members = agentsByCommunity.get(community.id) || [];
      members.forEach((agent, index) => {
        result.set(agent.id, {
          x: community.x + (index % 2 === 0 ? -43 : 43),
          y: 145 + Math.floor(index / 2) * 76
        });
      });
    }
    return result;
  }, [agentsByCommunity]);

  const selectedAgent = agents.find((agent) => agent.id === selectedId);
  const selectedRelationships = relationships.filter((relationship) =>
    relationship.source === selectedId || relationship.target === selectedId
  );
  const selectedInteractions = interactions.filter((interaction) =>
    interaction.proposerId === selectedId || interaction.targetId === selectedId
  );
  const summary = world.socialSummary || { relationships: 0, interactions: 0, averageTrust: 0 };
  const latestMetrics = world.lastTickMetrics;

  return (
    <div className="page-content social-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> COMMUNITY DYNAMICS <span className="eyebrow-version">SOCIAL NETWORK</span></div>
          <h1>Social network</h1>
          <p className="page-subtitle">Explore how cooperation and trust form between neighbors over time.</p>
        </div>
      </section>

      <section className="social-metrics" aria-label="Social metrics">
        <article className="panel social-stat">
          <span><Network size={15} /> Relationships</span>
          <strong>{summary.relationships}</strong>
          <small>Mutual connections established</small>
        </article>
        <article className="panel social-stat">
          <span><HeartHandshake size={15} /> Collaborations</span>
          <strong>{summary.interactions}</strong>
          <small>Accepted cooperative interactions</small>
        </article>
        <article className="panel social-stat">
          <span><Users size={15} /> Average trust</span>
          <strong>{summary.averageTrust}%</strong>
          <small>Mean across established relationships</small>
        </article>
        <article className="panel social-stat">
          <span><HeartHandshake size={15} /> Latest invitations</span>
          <strong>{latestMetrics?.socialProposals ?? 0}</strong>
          <small>{latestMetrics?.socialInteractions ?? 0} accepted this tick</small>
        </article>
      </section>

      {error && <p className="social-error" role="alert">{error}</p>}

      <section className="social-layout">
        <article className="panel social-map-panel">
          <div className="panel-heading">
            <div><h3>Community connections</h3><p>Each line is a reciprocal relationship; stronger trust appears brighter.</p></div>
            <span className="count-chip">{agents.length} AGENTS</span>
          </div>
          {loading
            ? <div className="social-empty">Loading community connections…</div>
            : (
              <div className="social-map-scroll">
                <svg
                  className="social-map"
                  viewBox="0 0 1000 570"
                  role="img"
                  aria-label={`Social network showing ${agents.length} agents and ${relationships.length} relationships`}
                >
                  <defs>
                    <pattern id="social-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(123,143,171,.08)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="1000" height="570" fill="url(#social-grid)" />
                  {COMMUNITIES.map((community) => (
                    <g key={community.id}>
                      <rect
                        x={community.x - 145}
                        y="55"
                        width="290"
                        height="475"
                        rx="13"
                        className={`social-community-zone ${community.tone}`}
                      />
                      <text x={community.x} y="83" textAnchor="middle" className="social-community-title">
                        {community.name}
                      </text>
                      <text x={community.x} y="101" textAnchor="middle" className="social-community-count">
                        {(agentsByCommunity.get(community.id) || []).length} AGENTS
                      </text>
                    </g>
                  ))}
                  {relationships.map((relationship) => {
                    const source = positions.get(relationship.source);
                    const target = positions.get(relationship.target);
                    if (!source || !target) return null;
                    return (
                      <line
                        key={`${relationship.source}-${relationship.target}`}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        className={`social-edge ${relationship.trust >= 70 ? "high-trust" : relationship.trust < 45 ? "low-trust" : ""}`}
                        style={{ opacity: 0.25 + relationship.trust / 140 }}
                        strokeWidth={0.8 + relationship.trust / 45}
                      >
                        <title>{`${relationship.sourceName} and ${relationship.targetName}: ${relationship.trust}% trust`}</title>
                      </line>
                    );
                  })}
                  {COMMUNITIES.flatMap((community) =>
                    (agentsByCommunity.get(community.id) || []).map((agent) => {
                      const position = positions.get(agent.id);
                      const initials = agent.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
                      return (
                        <g
                          key={agent.id}
                          className={`social-node ${selectedId === agent.id ? "selected" : ""}`}
                          role="button"
                          tabIndex="0"
                          aria-label={`Select ${agent.name}, ${agent.roleLabel}`}
                          onClick={() => setSelectedId(agent.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedId(agent.id);
                            }
                          }}
                        >
                          <circle cx={position.x} cy={position.y} r="18" />
                          <text x={position.x} y={position.y + 3} textAnchor="middle">{initials}</text>
                          <title>{`${agent.name} · ${agent.roleLabel}`}</title>
                        </g>
                      );
                    })
                  )}
                  {!relationships.length && (
                    <text x="500" y="550" textAnchor="middle" className="social-no-edges">
                      No relationships yet · run the simulation to observe cooperation
                    </text>
                  )}
                </svg>
              </div>
            )}
          <div className="social-legend">
            <span><i className="social-legend-line strong" /> High trust</span>
            <span><i className="social-legend-line" /> Acquaintance</span>
            <span><i className="social-legend-node" /> Select an agent</span>
          </div>
        </article>

        <aside className="panel social-detail-panel" aria-live="polite">
          <div className="panel-heading">
            <div><h3>Agent connections</h3><p>Selected profile and known relationships</p></div>
          </div>
          {!selectedAgent
            ? <div className="social-empty">No agent is available to inspect.</div>
            : (
              <>
                <div className="social-selected-agent">
                  <span className="social-selected-avatar">
                    {selectedAgent.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                  </span>
                  <div><strong>{selectedAgent.name}</strong><small>{selectedAgent.roleLabel} · {selectedAgent.community.name}</small></div>
                </div>
                <div className="social-relationship-list">
                  {!selectedRelationships.length
                    ? <div className="social-empty">No established relationships yet.</div>
                    : selectedRelationships.map((relationship) => {
                      const otherId = relationship.source === selectedId
                        ? relationship.target
                        : relationship.source;
                      const otherName = relationship.source === selectedId
                        ? relationship.targetName
                        : relationship.sourceName;
                      return (
                        <div className="social-relationship-row" key={`${relationship.source}-${relationship.target}`}>
                          <span className="social-relationship-avatar">{otherName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                          <div className="social-relationship-copy"><strong>{otherName}</strong><small>{relationship.status} · {relationship.interactions} interactions</small></div>
                          <span className="social-trust">{relationship.trust}%</span>
                          <span className="sr-only">{otherId}</span>
                        </div>
                      );
                    })}
                </div>
                <div className="social-history-note">Recent invitations and responses</div>
                <div className="social-interaction-list">
                  {!selectedInteractions.length
                    ? <div className="social-empty">No social invitations recorded yet.</div>
                    : selectedInteractions.slice(0, 6).map((interaction) => (
                      <div className="social-interaction-row" key={interaction.id}>
                        <span className={`social-outcome-dot ${interaction.accepted ? "accepted" : ""}`} />
                        <span>
                          <strong>{interaction.outcome}</strong>
                          <small>Tick {interaction.tick} · {interaction.proposerName} to {interaction.targetName}</small>
                        </span>
                      </div>
                    ))}
                </div>
              </>
            )}
        </aside>
      </section>
      <p className="simulation-scope-note">Interactions are programmed, seeded proposals. Agents observe public community profiles only; private resources, needs, and memories remain hidden.</p>
    </div>
  );
}

export default SocialNetworkView;
