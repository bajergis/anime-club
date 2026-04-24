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

function NewRollPanel({ seasonId, members, onRollCreated }) {
  const [selectedMembers, setSelectedMembers] = useState(members.map(m => m.id));
  const [rollDate, setRollDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [animeTitles, setAnimeTitles] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelectedMembers(members.map(m => m.id));
  }, [members]);

  function toggleMember(id) {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setResult(null);
  }

  async function generateRoll() {
    if (selectedMembers.length < 2) return;
    setRolling(true);
    const data = await fetch(`${API}/seasons/${seasonId}/rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_ids: selectedMembers, roll_date: rollDate }),
    }).then(r => r.json());
    setResult(data);
    setAnimeTitles({});
    setRolling(false);
  }

  async function submitAssignments() {
    if (!result) return;
    const { roll_id, derangement } = result;
    const entries = Object.entries(derangement);
    setSubmitting(true);
    for (const [assignerId, assigneeId] of entries) {
      const title = animeTitles[assigneeId];
      if (!title?.trim()) continue;
      await fetch(`${API}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roll_id, assignee_id: assigneeId, assigner_id: assignerId, anime_title: title }),
      });
    }
    setSubmitting(false);
    setResult(null);
    setAnimeTitles({});
    onRollCreated(roll_id);
  }

  const memberMap = Object.fromEntries(members.map(m => [m.id, m.name]));
  const allTitlesEntered = result
    ? Object.values(result.derangement).every(assigneeId => animeTitles[assigneeId]?.trim())
    : false;

  return (
    <div className="card">
      <h2 className="mb-16">Generate New Roll</h2>

      <div className="mb-16">
        <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
          Participating Members
        </label>
        <div className="flex gap-8" style={{ flexWrap: "wrap" }}>
          {members.map(m => (
            <button
              key={m.id}
              className={`btn ${selectedMembers.includes(m.id) ? "btn-primary" : "btn-ghost"}`}
              onClick={() => toggleMember(m.id)}
              style={{ minWidth: 80 }}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-8 mb-16" style={{ alignItems: "flex-end" }}>
        <div>
          <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
            Roll Date
          </label>
          <input type="date" value={rollDate} onChange={e => setRollDate(e.target.value)} style={{ width: 180 }} />
        </div>
        <button
          className="btn btn-primary"
          onClick={generateRoll}
          disabled={rolling || selectedMembers.length < 2 || !!result}
        >
          {rolling ? "Rolling..." : "🎲 Roll Derangement"}
        </button>
        {result && (
          <button className="btn btn-ghost" onClick={() => setResult(null)}>
            Re-roll
          </button>
        )}
      </div>

      {result && (
        <div>
          <div className="divider" />
          <h3 className="mb-16">Roll #{result.roll_number} — Enter Anime Picks</h3>
          <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
            Each assigner picks an anime for their assigned person. Enter the title below.
          </div>
          <div className="flex flex-col gap-12">
            {Object.entries(result.derangement).map(([assignerId, assigneeId]) => (
              <div key={assignerId} className="flex items-center gap-12" style={{ background: "var(--bg3)", borderRadius: "var(--radius)", padding: "12px 16px" }}>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Assigner</div>
                  <div style={{ color: "var(--accent2)", fontWeight: 600 }}>{memberMap[assignerId]}</div>
                </div>
                <div style={{ fontSize: "1.2rem", color: "var(--border)" }}>→</div>
                <div style={{ minWidth: 120 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Picks for</div>
                  <div style={{ color: "var(--accent)", fontWeight: 600 }}>{memberMap[assigneeId]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    value={animeTitles[assigneeId] || ""}
                    onChange={e => setAnimeTitles(t => ({ ...t, [assigneeId]: e.target.value }))}
                    placeholder={`Anime for ${memberMap[assigneeId]}...`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-8 mt-16" style={{ justifyContent: "flex-end" }}>
            <div className="text-muted" style={{ fontSize: "0.75rem", alignSelf: "center" }}>
              {Object.values(animeTitles).filter(t => t?.trim()).length}/{Object.keys(result.derangement).length} titles entered
            </div>
            <button
              className="btn btn-primary"
              onClick={submitAssignments}
              disabled={submitting || !allTitlesEntered}
            >
              {submitting ? "Saving..." : "Save Assignments"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Determines the state of the active season's rolls:
//   "in_progress"    — current roll not yet finished
//   "ready_for_roll" — last roll done, season has rolls remaining
//   "season_complete" — all rolls for the season are done
async function getSeasonRollState(active) {
  if (!active) return null;

  const rollCount = active.roll_count ?? Infinity; // fall back gracefully if field missing
  const completedRolls = active.rolls ?? [];

  if (completedRolls.length === 0) return "ready_for_roll";

  const lastRoll = completedRolls[completedRolls.length - 1];
  const assignments = await fetch(`${API}/assignments?roll_id=${lastRoll.id}`).then(r => r.json());
  const lastRollDone = assignments.length > 0 && assignments.every(a => a.status === "completed" || a.status === "dropped");

  if (!lastRollDone) return "in_progress";
  if (completedRolls.length >= rollCount) return "season_complete";
  return "ready_for_roll";
}

export default function Seasons() {
  const [seasons, setSeasons] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  // "in_progress" | "ready_for_roll" | "season_complete" | null
  const [rollState, setRollState] = useState(null);
  const [showNewSeason, setShowNewSeason] = useState(false);
  const navigate = useNavigate();

  function load() {
    Promise.all([
      fetch(`${API}/seasons`).then(r => r.json()),
      fetch(`${API}/members`).then(r => r.json()),
      fetch(`${API}/seasons/active`).then(r => r.ok ? r.json() : null),
    ]).then(async ([s, m, active]) => {
      setSeasons(s);
      setMembers(m);
      setRollState(await getSeasonRollState(active));
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const activeSeason = seasons.find(s => s.is_active);

  // Roll progress label for the active season header, e.g. "Roll 2 / 4"
  const rollProgressLabel = activeSeason && activeSeason.roll_count
    ? `Roll ${activeSeason.rolls_completed ?? 0} / ${activeSeason.roll_count}`
    : null;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="section-header mb-24">
        <h1>Seasons</h1>
        {/* Only show manual New Season button when there's no active season */}
        {!activeSeason && (
          <button className="btn btn-primary" onClick={() => setShowNewSeason(s => !s)}>
            {showNewSeason ? "Cancel" : "+ New Season"}
          </button>
        )}
      </div>

      {showNewSeason && (
        <NewSeasonForm onCreated={() => { setShowNewSeason(false); load(); }} />
      )}

      {/* Active season roll area */}
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
              members={members}
              onRollCreated={(rollId) => navigate(`/roll/${rollId}`)}
            />
          )}

          {rollState === "in_progress" && (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div className="text-muted">Current roll must be completed or dropped before generating a new one.</div>
            </div>
          )}
        </div>
      )}

      {/* No active season and form not shown */}
      {!activeSeason && !showNewSeason && (
        <div className="card mb-24" style={{ textAlign: "center", padding: 32 }}>
          <div className="text-muted mb-16">No active season. Start one to begin rolling!</div>
          <button className="btn btn-primary" onClick={() => setShowNewSeason(true)}>+ New Season</button>
        </div>
      )}

      {/* New season form triggered from banner (active season present) */}
      {activeSeason && showNewSeason && (
        <NewSeasonForm onCreated={() => { setShowNewSeason(false); load(); }} />
      )}

      {/* All seasons */}
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