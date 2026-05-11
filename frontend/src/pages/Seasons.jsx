import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function NewSeasonForm({ onCreated }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rollCount, setRollCount] = useState(4);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || rollCount < 1) return;
    setSaving(true);
    await fetch(`${API}/seasons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, started_at: date, roll_count: rollCount }),
      credentials: "include",
    });
    setSaving(false);
    setName("");
    setRollCount(4);
    onCreated();
  }

  return (
    <div className="card mb-24">
      <h2 className="mb-16">New Season</h2>
      <div className="grid-3" style={{ gap: 12, alignItems: "flex-end" }}>
        <div>
          <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
            Season Name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Season 5"
            onKeyDown={e => e.key === "Enter" && submit()}
          />
        </div>
        <div>
          <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
            Start Date
          </label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
            Number of Rolls
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={rollCount}
            onChange={e => setRollCount(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: "100%" }}
          />
        </div>
      </div>
      <div className="flex gap-8 mt-16" style={{ alignItems: "center" }}>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !name.trim() || rollCount < 1}>
          {saving ? "Creating..." : "Create Season"}
        </button>
        <div className="text-muted" style={{ fontSize: "0.75rem" }}>
          Creating a new season will deactivate the current active season.
        </div>
      </div>
    </div>
  );
}

function SeasonCompleteBanner({ onStartNewSeason }) {
  return (
    <div className="card mb-24" style={{
      textAlign: "center",
      padding: "40px 32px",
      border: "1px solid var(--accent)",
      background: "linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)",
    }}>
      <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎉</div>
      <h2 style={{ marginBottom: 8 }}>Season Complete!</h2>
      <div className="text-muted mb-24" style={{ fontSize: "0.875rem" }}>
        All rolls for this season have been finished. Ready to start a new one?
      </div>
      <button className="btn btn-primary" onClick={onStartNewSeason}>
        + Start New Season
      </button>
    </div>
  );
}

function NewRollPanel({ seasonId, onRollCreated }) {
  const [rollDate, setRollDate] = useState(new Date().toISOString().split("T")[0]);
  const [useTitle, setUseTitle] = useState(false);
  const [rollTitle, setRollTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function createRoll() {
    setCreating(true);
    const data = await fetch(`${API}/seasons/${seasonId}/rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          roll_date: rollDate,
          title: useTitle && rollTitle.trim() ? rollTitle.trim() : null,
      }),
      credentials: "include",
    }).then(r => r.json());
    setCreating(false);
    if (data.roll_id) onRollCreated(data.roll_id);
  }

  return (
    <div className="card">
      <h2 className="mb-8">Start New Roll</h2>
      <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
        Creating a roll opens a lobby where members lock in before assignments are generated.
      </div>
      <div className="flex gap-8 mb-12" style={{ alignItems: "flex-end" }}>
        <div>
          <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
            Roll Date
          </label>
          <input type="date" value={rollDate} onChange={e => setRollDate(e.target.value)} style={{ width: 180 }} />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer", fontSize: "0.85rem" }}>
        <input
          type="checkbox"
          checked={useTitle}
          onChange={e => setUseTitle(e.target.checked)}
          style={{ width: "auto" }}
        />
        Give this roll a theme / title
      </label>
      {useTitle && (
        <input
          value={rollTitle}
          onChange={e => setRollTitle(e.target.value)}
          placeholder="e.g. Sports Anime, Viewer's Choice..."
          style={{ marginBottom: 12 }}
          onKeyDown={e => e.key === "Enter" && createRoll()}
        />
      )}
      <button className="btn btn-primary" onClick={createRoll} disabled={creating}>
        {creating ? "Creating..." : "🎲 Create Roll Lobby"}
      </button>
    </div>
  );
}

function getSeasonRollState(active) {
  if (!active) return null;
  const rollCount = active.roll_count ?? Infinity;
  const rolls = active.rolls ?? [];
  if (rolls.length === 0) return "ready_for_roll";
  const currentRollState = active.currentRollState;
  if (currentRollState && currentRollState !== "completed") return "in_progress";
  if (rolls.length >= rollCount) return "season_complete";
  return "ready_for_roll";
}

export default function Seasons() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rollState, setRollState] = useState(null);
  const [currentRollId, setCurrentRollId] = useState(null);
  const [showNewSeason, setShowNewSeason] = useState(false);
  const navigate = useNavigate();

  function load() {
    Promise.all([
      fetch(`${API}/seasons`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/seasons/active`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([s, active]) => {
      setSeasons(s);
      setRollState(getSeasonRollState(active));
      if (active?.rolls?.length) {
        setCurrentRollId(active.rolls[active.rolls.length - 1].id);
      }
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const activeSeason = seasons.find(s => s.is_active);
  const rollProgressLabel = activeSeason?.roll_count
    ? `Roll ${activeSeason.rolls_completed ?? 0} / ${activeSeason.roll_count}`
    : null;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="section-header mb-24">
        <h1>Seasons</h1>
        {!activeSeason && (
          <button className="btn btn-primary" onClick={() => setShowNewSeason(s => !s)}>
            {showNewSeason ? "Cancel" : "+ New Season"}
          </button>
        )}
      </div>

      {showNewSeason && !activeSeason && (
        <NewSeasonForm onCreated={() => { setShowNewSeason(false); load(); }} />
      )}

      {activeSeason && (
        <div className="mb-24">
          <div className="flex gap-12 mb-8" style={{ alignItems: "center" }}>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
              ACTIVE SEASON — {activeSeason.name}
            </div>
            {rollProgressLabel && (
              <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                · {rollProgressLabel}
              </div>
            )}
          </div>

          {rollState === "season_complete" && (
            <SeasonCompleteBanner
              onStartNewSeason={() => {
                setShowNewSeason(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}

          {rollState === "ready_for_roll" && (
            <NewRollPanel
              seasonId={activeSeason.id}
              onRollCreated={(rollId) => navigate(`/roll/${rollId}`)}
            />
          )}

          {rollState === "in_progress" && currentRollId && (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div className="text-muted mb-16">A roll is currently in progress.</div>
              <Link to={`/roll/${currentRollId}`} className="btn btn-primary">
                Go to Current Roll →
              </Link>
            </div>
          )}
        </div>
      )}

      {activeSeason && showNewSeason && (
        <NewSeasonForm onCreated={() => { setShowNewSeason(false); load(); }} />
      )}

      {!activeSeason && !showNewSeason && (
        <div className="card mb-24" style={{ textAlign: "center", padding: 32 }}>
          <div className="text-muted mb-16">No active season. Start one to begin rolling!</div>
          <button className="btn btn-primary" onClick={() => setShowNewSeason(true)}>+ New Season</button>
        </div>
      )}

      <div className="section-header mb-16">
        <h2>All Seasons</h2>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Season</th>
              <th>Started</th>
              <th>Ended</th>
              <th>Rolls</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {seasons.map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>
                  <Link to={`/season/${s.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                    {s.name}
                  </Link>
                </td>
                <td className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{s.started_at}</td>
                <td className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>{s.ended_at || "—"}</td>
                <td className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  {s.rolls_completed ?? 0}{s.roll_count ? ` / ${s.roll_count}` : ""}
                </td>
                <td>
                  {s.is_active
                    ? <span className="badge badge-watching">Active</span>
                    : <span className="badge badge-completed">Finished</span>
                  }
                </td>
                <td>
                  <Link to={`/season/${s.id}`} className="btn btn-ghost btn-sm">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}