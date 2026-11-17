import { lazy, Suspense, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Atom,
  BarChart3,
  Bell,
  Blocks,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudSun,
  Command,
  Compass,
  Cpu,
  FlaskConical,
  Leaf,
  LockKeyhole,
  Network,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Zap
} from "lucide-react";
import AgentExplorer from "./AgentExplorer.jsx";
import { apiFetch, getArchitectToken, setArchitectToken } from "./apiClient.js";
import EventTimeline from "./EventTimeline.jsx";
import ResearchLab from "./ResearchLab.jsx";
import SimulationControls from "./SimulationControls.jsx";
import SimulationControlView from "./SimulationControlView.jsx";
import SocialNetworkView from "./SocialNetworkView.jsx";
import { socket } from "./socket.js";

const navigation = [
  { label: "World overview", icon: Compass },
  { label: "City atlas", icon: Blocks, badge: "M8" },
  { label: "Agent explorer", icon: Users, badge: "30" },
  { label: "Social network", icon: Network, badge: "M5" },
  { label: "Simulation control", icon: Activity, badge: "LIVE" },
  { label: "Event timeline", icon: Clock3, badge: "M7" },
  { label: "Research laboratory", icon: FlaskConical, badge: "M9" }
];

const City3DView = lazy(() => import("./City3DView.jsx"));

const iconByCommunity = {
  greenfield: Leaf,
  metrocore: Blocks,
  novadistrict: Atom
};

function MetricCard({ label, value, note, icon: Icon, tone }) {
  return (
    <article className="metric-card panel">
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon ${tone}`}><Icon size={17} /></span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </article>
  );
}

function CityMap({ communities }) {
  return (
    <div className="city-map" aria-label="Schematic map of ECHO CITY communities">
      <div className="map-grid" />
      <div className="map-glow map-glow-one" />
      <div className="map-glow map-glow-two" />
      <svg className="map-roads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M22 49 C31 43, 35 33, 49 29 S66 37, 73 58" />
        <path d="M24 50 C39 57, 55 64, 72 59" />
        <path d="M48 30 C47 41, 47 50, 49 60" />
      </svg>
      <span className="map-label map-label-north">N</span>
      <span className="map-scale"><span /> 2 km</span>
      {communities.map((community) => {
        const Icon = iconByCommunity[community.id] || Blocks;
        return (
          <div
            className={`community-node ${community.accent}`}
            key={community.id}
            style={{
              left: `${community.mapPosition.x}%`,
              top: `${community.mapPosition.y}%`
            }}
          >
            <div className="node-orbit"><div className="node-core"><Icon size={19} /></div></div>
            <div className="node-label">
              <strong>{community.name}</strong>
              <span>{community.type}</span>
            </div>
          </div>
        );
      })}
      <div className="map-legend">
        <span><i className="legend-dot emerald" /> Residential</span>
        <span><i className="legend-dot cyan" /> Commerce</span>
        <span><i className="legend-dot violet" /> Research</span>
      </div>
      <div className="map-status"><span className="status-dot" /> WORLD FRAMEWORK</div>
    </div>
  );
}

function App() {
  const [world, setWorld] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [activeView, setActiveView] = useState("World overview");
  const [controlError, setControlError] = useState("");
  const [controlBusy, setControlBusy] = useState(false);
  const [architectTokenInput, setArchitectTokenInput] = useState(() => getArchitectToken());
  const [accessRequired, setAccessRequired] = useState(false);

  async function sendSimulationCommand(command, body = {}) {
    setControlError("");
    setControlBusy(true);
    try {
      const response = await apiFetch(`/api/simulation/${command}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Simulation API returned ${response.status}`);
      if (result.world) setWorld(result.world);
      return result;
    } catch (error) {
      setControlError(error.message || "Simulation command failed.");
      return null;
    } finally {
      setControlBusy(false);
    }
  }

  async function loadWorld() {
    setLoadError("");
    try {
      const response = await apiFetch("/api/world");
      if (response.status === 401) setAccessRequired(true);
      if (!response.ok) throw new Error(`World API returned ${response.status}`);
      setAccessRequired(false);
      setWorld(await response.json());
    } catch (error) {
      setLoadError(error.message || "Could not load the world.");
    }
  }

  async function connectWorldArchitect(event) {
    event.preventDefault();
    setArchitectToken(architectTokenInput);
    socket.auth = { token: architectTokenInput.trim() };
    if (socket.connected) socket.disconnect();
    socket.connect();
    await loadWorld();
  }

  useEffect(() => {
    loadWorld();
  }, []);

  useEffect(() => {
    function handleSimulationUpdate(update) {
      if (update.world) setWorld(update.world);
    }
    socket.on("simulation:update", handleSimulationUpdate);
    return () => socket.off("simulation:update", handleSimulationUpdate);
  }, []);

  if (loadError) {
    return (
      <main className="load-error">
        <div className="error-mark"><Radio size={22} /></div>
        <h1>{accessRequired ? "World Architect access" : "World connection unavailable"}</h1>
        <p>{accessRequired
          ? "Enter the server's World Architect token. It is stored only for this browser session."
          : <>{loadError}. Start the API with <code>npm run dev</code> from the project folder.</>}</p>
        {accessRequired ? (
          <form className="architect-access-form" onSubmit={connectWorldArchitect}>
            <label htmlFor="architect-token">Access token</label>
            <input
              id="architect-token"
              type="password"
              autoComplete="current-password"
              value={architectTokenInput}
              onChange={(event) => setArchitectTokenInput(event.target.value)}
              required
            />
            <button className="primary-button" type="submit"><LockKeyhole size={15} /> Connect</button>
          </form>
        ) : null}
        <button className="primary-button" onClick={loadWorld}><RotateCcw size={15} /> Try again</button>
      </main>
    );
  }

  if (!world) {
    return <main className="loading-screen"><div className="loading-orbit" /><span>Establishing world link…</span></main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="EchoWorld home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">ECHO<span>WORLD</span></span>
        </a>
        <div className="workspace-switcher">
          <div className="workspace-icon"><Command size={17} /></div>
          <div className="workspace-copy"><strong>World Architect</strong><span>Personal workspace</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>
        <div className="nav-heading">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, disabled, badge }) => (
            <button
              className={`nav-item${activeView === label ? " active" : ""}${disabled ? " disabled" : ""}`}
              key={label}
              disabled={disabled}
              onClick={() => !disabled && setActiveView(label)}
              title={disabled ? `Available in ${badge}` : label}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {badge && <small>{badge}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="build-card">
            <div className="build-card-icon"><Sparkles size={16} /></div>
            <strong>Research laboratory</strong>
            <p>Run repeatable, worker-isolated experiments and compare measured outcomes.</p>
            <div className="build-progress"><span style={{ width: "90%" }} /></div>
            <div className="build-footer"><span>MILESTONE 09</span><span>09 / 10</span></div>
          </div>
          <button className="help-link"><CircleHelp size={16} /> Documentation <ArrowUpRight size={13} /></button>
          <div className="profile-row">
            <div className="avatar">WA</div>
            <div className="profile-copy"><strong>World Architect</strong><span>Local session</span></div>
            <Settings2 size={16} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Worlds</span><span className="crumb-slash">/</span><strong>{world.name}</strong></div>
          <div className="topbar-actions">
            <div className="save-status"><span className="status-dot" /> Configuration loaded</div>
            <button className="icon-button" aria-label="Search"><Search size={17} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><i /></button>
            <div className="top-avatar">WA</div>
          </div>
        </header>

        {activeView === "Agent explorer" ? (
          <AgentExplorer onBack={() => setActiveView("World overview")} />
        ) : activeView === "City atlas" ? (
          <div className="page-content city3d-page">
            <section className="page-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> INTERACTIVE WORLD MODEL <span className="eyebrow-version">M8 THREE-DIMENSIONAL ATLAS</span></div>
                <h1>City atlas</h1>
                <p className="page-subtitle">Inspect community infrastructure and resident wellbeing in ECHO CITY.</p>
              </div>
            </section>
            <Suspense fallback={<div className="panel city3d-loading">Loading the interactive city model…</div>}>
              <City3DView world={world} />
            </Suspense>
          </div>
        ) : activeView === "Social network" ? (
          <SocialNetworkView world={world} />
        ) : activeView === "Simulation control" ? (
          <SimulationControlView
            world={world}
            onCommand={sendSimulationCommand}
            busy={controlBusy}
            error={controlError}
          />
        ) : activeView === "Event timeline" ? (
          <EventTimeline world={world} onWorldUpdate={setWorld} />
        ) : activeView === "Research laboratory" ? (
          <ResearchLab world={world} />
        ) : <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> CIVILIZATION SIMULATOR <span className="eyebrow-version">M9 RESEARCH LAB</span></div>
              <h1>World overview</h1>
              <p className="page-subtitle">A living society, shaped by the choices of its people.</p>
            </div>
          </section>

          <section className="world-banner panel">
            <div className="banner-decoration"><div /><div /><div /></div>
            <div className="banner-content">
              <div className="banner-overline"><span className="live-indicator" /> WORLD INITIALIZED</div>
              <h2>{world.name}</h2>
              <p>{world.description}</p>
              <div className="banner-meta">
                <span><Compass size={14} /> 3 connected communities</span>
                <span><ShieldCheck size={14} /> Seed {world.seed} · No AI API required</span>
              </div>
            </div>
            <div className="banner-emblem" aria-hidden="true"><div className="emblem-ring ring-outer" /><div className="emblem-ring ring-inner" /><div className="emblem-core"><Zap size={24} /></div></div>
          </section>

          <SimulationControls
            world={world}
            onCommand={sendSimulationCommand}
            busy={controlBusy}
            error={controlError}
          />

          <section className="metrics-grid" aria-label="World metrics">
            <MetricCard label="Population" value={world.population.total.toLocaleString()} note={`${world.population.active} active · programmed agents`} icon={Users} tone="violet-tone" />
            <MetricCard label="Simulation tick" value={world.tick.toLocaleString()} note={world.lastTickMetrics ? `${world.lastTickMetrics.decisions} decisions recorded` : "Awaiting first simulation run"} icon={Activity} tone="cyan-tone" />
            <MetricCard label="World status" value={world.simulationStatus === "running" ? "Running" : world.simulationStatus === "paused" ? "Paused" : "Ready"} note={world.simulationStatus === "running" ? "Discrete ticks are advancing" : "Simulation is not running"} icon={Radio} tone="emerald-tone" />
            <MetricCard label="Communities" value={world.communities.length.toString().padStart(2, "0")} note="Connected city districts" icon={Blocks} tone="amber-tone" />
          </section>

          <section className="content-grid">
            <article className="panel map-panel">
              <div className="panel-heading">
                <div><h3>City atlas</h3><p>Community layout &amp; infrastructure zones</p></div>
                <button className="panel-action" onClick={() => setActiveView("City atlas")} aria-label="Open interactive 3D city atlas" title="Open 3D city atlas"><Blocks size={16} /></button>
              </div>
              <CityMap communities={world.communities} />
            </article>

            <article className="panel community-panel">
              <div className="panel-heading">
                <div><h3>Communities</h3><p>Three districts, one evolving city</p></div>
                <span className="count-chip">03</span>
              </div>
              <div className="community-list">
                {world.communities.map((community) => {
                  const Icon = iconByCommunity[community.id] || Blocks;
                  return (
                    <div className="community-row" key={community.id}>
                      <div className={`community-icon ${community.accent}`}><Icon size={17} /></div>
                      <div className="community-info">
                        <div className="community-name-line"><strong>{community.name}</strong><span className={`community-tag ${community.accent}`}>{community.type.split(" & ")[0]}</span></div>
                        <p>{community.description}</p>
                        <div className="facility-line">{community.facilities.slice(0, 4).map((facility) => <span key={facility}>{facility}</span>)}</div>
                      </div>
                      <div className="community-pop"><strong>{world.population.byCommunity[community.id] || 0}</strong><span>/ {community.targetPopulation} residents</span></div>
                    </div>
                  );
                })}
              </div>
              <div className="community-footnote"><span className="status-dot" /> Ten initial agent profiles assigned to each community.</div>
            </article>
          </section>

          <section className="lower-grid">
            <article className="panel resources-panel">
              <div className="panel-heading">
                <div><h3>Resource economy</h3><p>Current agent inventory · fictional credits</p></div>
                <span className="framework-tag">WORLD TOTALS</span>
              </div>
              <div className="resource-grid">
                {world.resources.map((resource, index) => {
                  const icons = [Leaf, BarChart3, Zap, Blocks, Cpu, ShieldCheck];
                  const Icon = icons[index];
                  const price = world.marketPrices[resource.id];
                  return <div className="resource-item" key={resource.id}><span className={`resource-icon resource-${index}`}><Icon size={15} /></span><span><strong>{resource.name}</strong><small>{resource.unit}{price ? ` · ${price} credits/unit` : " held by agents"}</small></span><span className="resource-value">{world.resourceTotals[resource.id].toLocaleString()}</span></div>;
                })}
              </div>
            </article>
            <article className="panel activity-panel">
              <div className="panel-heading">
                <div><h3>World activity</h3><p>Recent milestones &amp; system status</p></div>
                <span className="activity-count">01</span>
              </div>
              <div className="activity-item">
                <div className="activity-icon"><Compass size={16} /></div>
                <div className="activity-copy">
                  <strong>{world.lastTickMetrics ? `Tick ${world.lastTickMetrics.tick} completed` : "ECHO CITY initialized"}</strong>
                  <p>{world.lastTickMetrics
                    ? `${world.lastTickMetrics.decisions} decisions · ${world.lastTickMetrics.trades} trades · ${world.lastTickMetrics.blockedConsumption} blocked consumption`
                    : "Three communities and six resource categories are configured."}</p>
                  <span>{world.lastTickMetrics ? "UTILITY DECISIONS · SEEDED RUN" : "FOUNDATION · TICK 000"}</span>
                </div>
              </div>
              <div className="activity-item muted-activity">
                <div className="activity-icon"><CloudSun size={16} /></div>
                <div className="activity-copy">
                  <strong>{world.eventSummary.active
                    ? `${world.eventSummary.active} world event${world.eventSummary.active === 1 ? "" : "s"} active`
                    : "Environment monitoring"}</strong>
                  <p>{world.activeEvents.length
                    ? world.activeEvents.map((event) => event.title).join(" · ")
                    : "Seeded environmental events can emerge as the simulation advances."}</p>
                  <span>{world.eventSummary.total} EVENTS RECORDED · M7</span>
                </div>
              </div>
            </article>
          </section>

          <footer className="page-footer">
            <span>ECHOWORLD <span className="footer-dot">·</span> A SOCIETY THAT EVOLVES WITHOUT A SCRIPT.</span>
            <span><ArrowDownRight size={13} /> Agents are programmed models, not conscious beings.</span>
          </footer>
        </div>}
      </main>
    </div>
  );
}

export default App;
