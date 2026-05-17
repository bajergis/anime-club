import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { syncAniListProgress, applySync } from "../lib/anilistSync";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const STATUSES = ["pending", "watching", "completed", "dropped", "hiatus"];

function StatusBadge({ status }) {
  return <span className={`badge badge-${status || "pending"}`}>{status || "pending"}</span>;
}

// ── Assignment Card (inline, same as Roll.jsx) ────────────────
function AssignmentCard({ assignment: initialA, onUpdate }) {
  const { member } = useAuth();
  const [a, setA] = useState(initialA);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    rating: initialA.rating ?? "",
    episodes_watched: initialA.episodes_watched ?? "",
    status: initialA.status ?? "pending",
    notes: initialA.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setA(initialA);
    setDraft(d => ({
      ...d,
      episodes_watched: initialA.episodes_watched ?? "",
      status: initialA.status ?? "pending",
    }));
  }, [initialA]);

  const isAssignee = member?.name === a.assignee_name;

  const aniData = a.anilist_data
    ? (() => { try { return JSON.parse(a.anilist_data); } catch { return null; } })()
    : null;

  const progress = a.episodes_watched && a.total_episodes
    ? Math.round((a.episodes_watched / a.total_episodes) * 100)
    : null;

  const ratingColor = a.rating >= 9 ? "var(--green)"
    : a.rating >= 7 ? "var(--accent2)"
    : a.rating >= 5 ? "var(--text)"
    : a.rating ? "var(--red)" : "var(--text2)";

  async function save() {
    setSaving(true);
    await fetch(`${API}/assignments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rating: draft.rating !== "" ? Number(draft.rating) : null,
        episodes_watched: draft.episodes_watched !== "" ? Number(draft.episodes_watched) : null,
        status: draft.status,
        notes: draft.notes || null,
      }),
      credentials: "include",
    });
    const updated = {
      ...a,
      ...draft,
      rating: draft.rating !== "" ? Number(draft.rating) : null,
      episodes_watched: draft.episodes_watched !== "" ? Number(draft.episodes_watched) : null,
    };
    setA(updated);
    setSaving(false);
    setEditing(false);
    onUpdate?.(updated);
  }

  return (
    <div className="card" style={{ borderLeft: `3px solid ${aniData?.cover_color || "var(--border)"}` }}>
      <div className="flex gap-16">
        <div style={{ flexShrink: 0 }}>
          {aniData?.cover_image_large
            ? <img src={aniData.cover_image_large} alt="" style={{ width: 60, height: 85, objectFit: "cover", borderRadius: 4 }} />
            : (
              <div style={{
                width: 60, height: 85, borderRadius: 4, background: "var(--bg3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.5rem", border: "1px dashed var(--border)"
              }}>番</div>
            )
          }
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between">
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text)" }}>
              {aniData?.title_english || aniData?.title_romaji || a.anime_title}
            </div>
            {isAssignee && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </button>
            )}
          </div>

          {aniData && (
            <div className="flex gap-8 mt-4" style={{ flexWrap: "wrap" }}>
              {aniData.season_year && <span className="genre-chip">{aniData.season} {aniData.season_year}</span>}
              {aniData.format && <span className="genre-chip">{aniData.format}</span>}
              {aniData.genres?.slice(0, 3).map(g => <span key={g} className="genre-chip">{g}</span>)}
            </div>
          )}

          <div className="flex items-center gap-12 mt-8">
            <div style={{ fontSize: "0.8rem" }}>
              <span className="text-muted">Assigned to: </span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{a.assignee_name}</span>
              <span className="text-muted"> Picked by: </span>
              <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{a.assigner_name}</span>
            </div>
            {aniData?.average_score && (
              <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--gold)" }}>
                ★ {(aniData.average_score / 10).toFixed(1)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-12 mt-8">
            <StatusBadge status={a.status} />
            {a.rating != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.95rem", fontWeight: 700, color: ratingColor }}>
                {a.rating}/10
              </span>
            )}
            {progress != null && (a.status === "watching" || a.status === "hiatus") && (
              <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                {a.episodes_watched}/{a.total_episodes} ep
              </span>
            )}
          </div>

          {progress != null && (a.status === "watching" || a.status === "hiatus") && (
            <div className="rating-track mt-6" style={{ height: 2 }}>
              <div className="rating-fill" style={{ width: `${progress}%`, height: "100%" }} />
            </div>
          )}

          {a.notes && (
            <div className="text-muted mt-6" style={{ fontSize: "0.78rem", fontStyle: "italic" }}>
              "{a.notes}"
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
          <div style={{ marginTop: 8 }}>
            <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Notes</label>
            <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Any thoughts..." />
          </div>
          <div className="grid-4" style={{ gap: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn btn-primary" style={{ width: "100%", marginTop: "5px" }} onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RollPanel({ roll, members, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [assignments, setAssignments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  async function load() {
    const data = await fetch(`${API}/assignments?roll_id=${roll.id}`, { credentials: "include" }).then(r => r.json());
    setAssignments(data);
    setLoaded(true);

    // Auto-sync on open, same as Roll.jsx
    setSyncing(true);
    const updates = await syncAniListProgress(data, members);
    if (updates.length) {
      await applySync(updates, API);
      setAssignments(prev => prev.map(a => {
        const u = updates.find(u => u.id === a.id);
        return u ? { ...a, ...u } : a;
      }));
    }
    setSyncing(false);
    setLastSynced(new Date());
  }

  // If open by default, load data immediately so panel doesn't show "Loading..."
  useEffect(() => {
    if (defaultOpen) load();
  }, []);

  async function handleOpen() {
    setOpen(o => !o);
    if (!loaded) await load();
  }

  async function manualSync() {
    setSyncing(true);
    const updates = await syncAniListProgress(assignments, members);
    if (updates.length) {
      await applySync(updates, API);
      setAssignments(prev => prev.map(a => {
        const u = updates.find(u => u.id === a.id);
        return u ? { ...a, ...u } : a;
      }));
    }
    setSyncing(false);
    setLastSynced(new Date());
  }

  function handleUpdate(updated) {
    setAssignments(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
  }

  const rated = assignments.filter(a => a.rating != null);
  const avgRating = rated.length ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : null;
  const completed = assignments.filter(a => a.status === "completed" || a.status === "dropped").length;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Roll header — always visible, click to toggle */}
      <div
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", cursor: "pointer",
          borderBottom: open ? "1px solid var(--border)" : "none",
          background: open ? "var(--bg3)" : "transparent",
          transition: "background 0.15s",
        }}
      >
        <div className="flex items-center gap-16">
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 700, fontSize: "0.9rem" }}>
            #{roll.roll_number}
          </div>
          {roll.roll_date && (
            <div className="text-muted" style={{ fontSize: "0.78rem" }}>
              {new Date(roll.roll_date + 'T00:00:00').toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          )}
          <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
            {roll.assignment_count ?? 0} shows
          </div>
          {roll.title && (
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
              {roll.title}
            </div>
          )}
        </div>

        <div className="flex items-center gap-16">
          {roll.avg_rating != null && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
              <span className="text-muted" style={{ fontSize: "0.7rem" }}>avg </span>
              <span style={{ color: "var(--gold)", fontWeight: 600 }}>{roll.avg_rating.toFixed(2)}</span>
            </div>
          )}
          {(roll.max_rating != null || roll.min_rating != null) && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
              <span style={{ color: "var(--green)" }}>{roll.max_rating ?? "—"}</span>
              <span className="text-muted"> / </span>
              <span style={{ color: "var(--red)" }}>{roll.min_rating ?? "—"}</span>
            </div>
          )}
          <div style={{ color: "var(--text2)", fontSize: "0.8rem", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
            ›
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: "16px 20px" }}>
          {/* Sync bar */}
          <div className="flex items-center justify-between mb-16">
            <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>
              {loaded ? `${completed}/${assignments.length} completed or dropped` : "Loading..."}
            </div>
            <div className="flex items-center gap-8">
              {lastSynced && !syncing && (
                <span className="text-muted" style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)" }}>
                  synced {lastSynced.toLocaleTimeString()}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); manualSync(); }} disabled={syncing || !loaded}>
                {syncing ? "↻ syncing..." : "↻ Sync AniList"}
              </button>
              <Link to={`/roll/${roll.id}`} className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
                Full page →
              </Link>
            </div>
          </div>

          {loaded ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 10 }}>
              {assignments.map(a => (
                <AssignmentCard key={a.id} assignment={a} onUpdate={handleUpdate} />
              ))}
              {!assignments.length && (
                <div className="text-muted" style={{ textAlign: "center", padding: 24, gridColumn: "1/-1" }}>No assignments in this roll.</div>
              )}
            </div>
          ) : (
            <div className="text-muted" style={{ textAlign: "center", padding: 24 }}>Loading...</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Season Page ───────────────────────────────────────────────
export default function Season() {
  const { id } = useParams();
  const [stats, setStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/stats/season/${id}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/assignments?season_id=${id}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
    ]).then(([s, a, m]) => {
      setStats(s);
      setAssignments(a);
      setMembers(m);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="loading">Loading season...</div>;
  if (!stats?.season) return <div className="loading">Season not found.</div>;

  const { season, rollStats, memberBreakdown } = stats;

  // Derive season-level stats from assignments
  const rated = assignments.filter(a => a.rating != null);
  const seasonAvg = rated.length ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : null;
  const best = rated.length ? rated.reduce((a, b) => a.rating > b.rating ? a : b) : null;
  const worst = rated.length ? rated.reduce((a, b) => a.rating < b.rating ? a : b) : null;

  return (
    <div>
      {/* Banner */}
      <div className="season-banner">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>

          {/* Left — title */}
          <div style={{ flex: 1 }}>
            <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", marginBottom: 6, letterSpacing: "0.08em" }}>
              {season.is_active ? "ACTIVE SEASON" : "FINISHED SEASON"}
            </div>
            <h1>{season.name}</h1>
            <div className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
              {season.started_at}
              {" → "}
              {season.ended_at
                ? season.ended_at
                : <span style={{ color: "var(--green)" }}>ongoing</span>
              }
            </div>
          </div>

          {/* Center — avg */}
          <div style={{
            textAlign: "center", padding: "12px 28px",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--gold)", lineHeight: 1 }}>
              {seasonAvg ? seasonAvg.toFixed(2) : "—"}
            </div>
            <div className="stat-label" style={{ marginTop: 4 }}>Season Avg</div>
          </div>

          {/* Right — best/worst cards */}
          <div style={{ display: "flex", gap: 12, flex: 1, justifyContent: "flex-end" }}>
            {best && (() => {
              let cover = null;
              try { const d = JSON.parse(best.anilist_data); cover = d?.cover_image_medium; } catch {}
              return (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius)",
                  border: "1px solid rgba(100,200,100,0.3)",
                  padding: "10px 14px", width: 110,
                }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Best</div>
                  {cover
                    ? <img src={cover} alt="" style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 4, border: "2px solid var(--green)" }} />
                    : <div style={{ width: 56, height: 80, borderRadius: 4, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>番</div>
                  }
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", textAlign: "center", lineHeight: 1.3, maxWidth: 90 }}>{best.anime_title}</div>
                  <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--green)", fontWeight: 700 }}>{best.rating}/10</div>
                </div>
              );
            })()}

            {worst && best?.id !== worst?.id && (() => {
              let cover = null;
              try { const d = JSON.parse(worst.anilist_data); cover = d?.cover_image_medium; } catch {}
              return (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius)",
                  border: "1px solid rgba(200,80,80,0.3)",
                  padding: "10px 14px", width: 110,
                }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Worst</div>
                  {cover
                    ? <img src={cover} alt="" style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 4, border: "2px solid var(--red)" }} />
                    : <div style={{ width: 56, height: 80, borderRadius: 4, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>番</div>
                  }
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text)", textAlign: "center", lineHeight: 1.3, maxWidth: 90 }}>{worst.anime_title}</div>
                  <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--red)", fontWeight: 700 }}>{worst.rating}/10</div>
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      {/* Rolls — collapsible */}
      <div className="section-header mb-16">
        <h2>Rolls</h2>
        <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
          {rollStats.length} total
        </div>
      </div>
      <div className="flex flex-col gap-8 mb-24">
        {rollStats.length ? rollStats.map((r, i) => (
          <RollPanel
            key={r.id}
            roll={r}
            members={members}
          />
        )) : (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div className="text-muted">No rolls yet.</div>
          </div>
        )}
      </div>

      {/* Member breakdown */}
      <div className="section-header mb-16">
        <h2>Member Breakdown</h2>
      </div>
      <div className="card mb-24">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Shows</th>
              <th>Avg Rating</th>
              <th>Completed</th>
              <th>Dropped</th>
            </tr>
          </thead>
          <tbody>
            {memberBreakdown.map(m => (
              <tr key={m.id}>
                <td>
                  <Link to={`/member/${m.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{m.name}</Link>
                </td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{m.total ?? 0}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {m.avg_rating != null ? m.avg_rating.toFixed(2) : "—"}
                </td>
                <td style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{m.completed ?? 0}</td>
                <td style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>{m.dropped ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}