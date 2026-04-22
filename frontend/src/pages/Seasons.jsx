import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function NewSeasonForm({ onCreated }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`${API}/seasons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, started_at: date }),
    });
    setSaving(false);
    setName("");
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
        <button className="btn btn-primary" onClick={submit} disabled={saving || !name.trim()}>
          {saving ? "Creating..." : "Create Season"}
        </button>
      </div>
      <div className="text-muted mt-8" style={{ fontSize: "0.75rem" }}>
        Creating a new season will deactivate the current active season.
      </div>
    </div>
  );
}

function NewRollPanel({ seasonId, members, onRollCreated }) {
  const [selectedMembers, setSelectedMembers] = useState(members.map(m => m.id));
  const [rollDate, setRollDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState(null);  // derangement result
  const [rolling, setRolling] = useState(false);
  const [animeTitles, setAnimeTitles] = useState({});  // assigneeId → title
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
    // For each assignment in the derangement: assigner → assignee
    // derangement is { assignerId: assigneeId }
    const { roll_id, derangement } = result;
    const entries = Object.entries(derangement); // [assignerId, assigneeId]
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

export default function Seasons() {
  const [seasons, setSeasons] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentRollComplete, setCurrentRollComplete] = useState(true);
  const [showNewSeason, setShowNewSeason] = useState(false);
  const navigate = useNavigate();

  async function load() {
    Promise.all([
      fetch(`${API}/seasons`).then(r => r.json()),
      fetch(`${API}/members`).then(r => r.json()),
      fetch(`${API}/seasons/active`).then(r => r.ok ? r.json() : null),
    ]).then(([s, m, active]) => {
      setSeasons(s);
      setMembers(m);

      if (active?.rolls?.length) {
          const lastRoll = active.rolls[active.rolls.length - 1];
          const assignments = await fetch(`${API}/assignments?roll_id=${lastRoll.id}`).then(r => r.json());
          const allDone = assignments.length > 0 && assignments.every(a => a.status === "completed" || a.status === "dropped");
          setCurrentRollComplete(allDone);
      } else {
          setCurrentRollComplete(true); // no rolls so allow generating
      }

      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  const activeSeason = seasons.find(s => s.is_active);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="section-header mb-24">
        <h1>Seasons</h1>
        <button className="btn btn-primary" onClick={() => setShowNewSeason(s => !s)}>
          {showNewSeason ? "Cancel" : "+ New Season"}
        </button>
      </div>

      {showNewSeason && (
        <NewSeasonForm onCreated={() => { setShowNewSeason(false); load(); }} />
      )}

      {/* Active season roll generator */}
      {activeSeason && (
        <div className="mb-24">
          <div className="text-muted mb-8" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
            ACTIVE SEASON — {activeSeason.name}
          </div>
          {currentRollComplete ? (
            <NewRollPanel
              seasonId={activeSeason.id}
              members={members}
              onRollCreated={(rollId) => navigate(`/roll/${rollId}`)}
            />
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 32 }}>
              <div className="text-muted">Current roll must be completed or dropped before generating a new one.</div>
            </div>
          )}
        </div>
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