import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock3, CloudSun, Plus, Radio, Sparkles } from "lucide-react";
import { apiFetch } from "./apiClient.js";

const EVENT_TYPES = [
  { value: "weather-disruption", label: "Weather disruption" },
  { value: "energy-shortage", label: "Energy shortage" },
  { value: "resource-scarcity", label: "Resource scarcity" },
  { value: "market-change", label: "Market shift" },
  { value: "technology-discovery", label: "Technology discovery" },
  { value: "business-opportunity", label: "Business opportunity" },
  { value: "infrastructure-problem", label: "Infrastructure problem" }
];

const FILTERS = ["all", "active", "scheduled", "resolved"];

function EventTimeline({ world, onWorldUpdate }) {
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventType, setEventType] = useState(EVENT_TYPES[0].value);
  const [communityId, setCommunityId] = useState("");
  const [resource, setResource] = useState("food");
  const [direction, setDirection] = useState("surge");
  const [severity, setSeverity] = useState(2);
  const [duration, setDuration] = useState(3);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsResource = ["resource-scarcity", "market-change"].includes(eventType);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/events?limit=100")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Events API returned ${response.status}`);
        if (!cancelled) setEvents(result.events);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Could not load world events.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [world.tick, world.eventSummary.total]);

  async function createEvent(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const body = { type: eventType, severity: Number(severity), duration: Number(duration) };
    if (communityId && eventType !== "market-change") body.communityId = communityId;
    if (needsResource) body.resource = resource;
    if (eventType === "market-change") body.direction = direction;
    try {
      const response = await apiFetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Events API returned ${response.status}`);
      setEvents((current) => [result.event, ...current.filter((item) => item.id !== result.event.id)]);
      onWorldUpdate(result.world);
    } catch (requestError) {
      setError(requestError.message || "Could not schedule the event.");
    } finally {
      setBusy(false);
    }
  }

  const visibleEvents = events.filter((event) =>
    statusFilter === "all" || event.status === statusFilter
  );
  const activeCount = world.eventSummary.active;
  const EventIcon = activeCount ? AlertTriangle : CloudSun;

  return (
    <div className="page-content event-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> WORLD ARCHITECT CONSOLE <span className="eyebrow-version">M7 DYNAMIC EVENTS</span></div>
          <h1>Event timeline</h1>
          <p className="page-subtitle">Track environmental changes and introduce controlled interventions.</p>
        </div>
      </section>

      <section className="event-summary-grid" aria-label="World event summary">
        <article className="panel event-summary-card">
          <span><EventIcon size={15} /> Active events</span>
          <strong>{activeCount}</strong>
          <small>Currently affecting the world</small>
        </article>
        <article className="panel event-summary-card">
          <span><Clock3 size={15} /> Scheduled</span>
          <strong>{world.eventSummary.scheduled}</strong>
          <small>Manual interventions begin next tick</small>
        </article>
        <article className="panel event-summary-card">
          <span><Sparkles size={15} /> Environment generated</span>
          <strong>{world.eventSummary.environmental}</strong>
          <small>Seeded probability-based events</small>
        </article>
        <article className="panel event-summary-card">
          <span><Activity size={15} /> Architect introduced</span>
          <strong>{world.eventSummary.manual}</strong>
          <small>Recorded manual interventions</small>
        </article>
      </section>

      <section className="event-layout">
        <article className="panel event-form-panel">
          <div className="panel-heading">
            <div><h3>Introduce an event</h3><p>Changes take effect on the next simulation tick.</p></div>
            <span className="event-form-icon"><Plus size={16} /></span>
          </div>
          <form className="event-form" onSubmit={createEvent}>
            <label>
              Event type
              <select value={eventType} onChange={(input) => setEventType(input.target.value)}>
                {EVENT_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label>
              Community scope
              <select
                value={eventType === "market-change" ? "" : communityId}
                onChange={(input) => setCommunityId(input.target.value)}
                disabled={eventType === "market-change"}
              >
                <option value="">All communities</option>
                {world.communities.map((community) => (
                  <option value={community.id} key={community.id}>{community.name}</option>
                ))}
              </select>
            </label>
            {needsResource && (
              <label>
                Resource
                <select value={resource} onChange={(input) => setResource(input.target.value)}>
                  {world.resources.filter((item) => item.id !== "money").map((item) => (
                    <option value={item.id} key={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
            )}
            {eventType === "market-change" && (
              <label>
                Market direction
                <select value={direction} onChange={(input) => setDirection(input.target.value)}>
                  <option value="surge">Price surge</option>
                  <option value="drop">Price drop</option>
                </select>
              </label>
            )}
            <div className="event-form-row">
              <label>
                Severity
                <select value={severity} onChange={(input) => setSeverity(input.target.value)}>
                  <option value="1">1 · Low</option>
                  <option value="2">2 · Moderate</option>
                  <option value="3">3 · High</option>
                </select>
              </label>
              <label>
                Duration
                <select value={duration} onChange={(input) => setDuration(input.target.value)}>
                  {[1, 2, 3, 5, 10].map((ticks) => <option value={ticks} key={ticks}>{ticks} ticks</option>)}
                </select>
              </label>
            </div>
            {error && <p className="event-error" role="alert">{error}</p>}
            <button className="primary-button event-submit" type="submit" disabled={busy}>
              <Plus size={14} /> {busy ? "Scheduling…" : "Schedule event"}
            </button>
          </form>
          <p className="event-integrity-note"><Radio size={13} /> Events are deterministic for a seed; manual interventions are recorded separately.</p>
        </article>

        <article className="panel event-history-panel">
          <div className="panel-heading">
            <div><h3>World event history</h3><p>Observed events and their current lifecycle state</p></div>
            <span className="count-chip">{String(events.length).padStart(2, "0")}</span>
          </div>
          <div className="event-filters" aria-label="Filter events by status">
            {FILTERS.map((filter) => (
              <button
                className={statusFilter === filter ? "selected" : ""}
                key={filter}
                onClick={() => setStatusFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="event-history-list">
            {loading ? (
              <div className="event-empty">Loading event ledger…</div>
            ) : visibleEvents.length ? visibleEvents.map((event) => (
              <article className="event-row" key={event.id}>
                <span className={`event-row-icon ${event.status}`}><CloudSun size={16} /></span>
                <div className="event-row-copy">
                  <div className="event-row-heading">
                    <strong>{event.title}</strong>
                    <span className={`event-status ${event.status}`}>{event.status}</span>
                  </div>
                  <p>{event.description}</p>
                  <small>
                    Tick {event.startsAtTick}–{event.expiresTick} · Severity {event.severity} · {event.communityId
                      ? world.communities.find((community) => community.id === event.communityId)?.name
                      : "All communities"} · {event.source === "manual" ? "Architect intervention" : "Environment"}
                  </small>
                </div>
              </article>
            )) : (
              <div className="event-empty">
                {statusFilter === "all"
                  ? "No world events yet. Environmental events may emerge as ticks advance."
                  : `No ${statusFilter} events in the current record.`}
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default EventTimeline;
