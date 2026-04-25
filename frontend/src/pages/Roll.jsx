import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const STATUSES = ["pending", "watching", "completed", "dropped", "hiatus"];

const STATUS_MAP = {
  CURRENT: "watching",
  COMPLETED: "completed",
  DROPPED: "dropped",
  PAUSED: "hiatus",
  PLANNING: "pending",
};

async function syncAniListProgress(assignments, members) {
  const updates = await Promise.all(
    assignments
      .filter(a => a.anilist_id)
      .map(async a => {
        const member = members.find(m => m.name === a.assignee_name);
        if (!member?.anilist_username) return null;

        const res = await fetch(`${API}/anime/anilist-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query($username: String, $mediaId: Int) {
              MediaList(userName: $username, mediaId: $mediaId) {
                progress
                status
              }
            }`,
            variables: { username: member.anilist_username, mediaId: a.anilist_id },
          }),
          credentials: "include",
        }).then(r => r.json()).catch(() => null);

        const entry = res?.data?.MediaList;
        if (!entry) return null;

        return {
          id: a.id,
          episodes_watched: entry.progress,
          status: STATUS_MAP[entry.status] || a.status,
        };
      })
  );

  return updates.filter(Boolean);
}

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
        {/* Cover */}
        <div style={{ flexShrink: 0 }}>
          {aniData?.cover_image_large
            ? <img src={aniData.cover_image_large} alt="" style={{ width: 72, height: 102, objectFit: "cover", borderRadius: 6 }} />
            : (
              <div style={{
                width: 72, height: 102, borderRadius: 6, background: "var(--bg3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem", border: "1px dashed var(--border)"
              }}>番</div>
            )
          }
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between">
            <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
              {aniData?.title_english || aniData?.title_romaji || a.anime_title}
            </div>
            {isAssignee && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
                {editing ? "Cancel" : "Edit"}
              </button>
            )}
          </div>

          {aniData && aniData.title_romaji !== (aniData.title_english || aniData.title_romaji) && (
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>{aniData.title_romaji}</div>
          )}

          {aniData && (
            <div className="flex gap-8 mt-4" style={{ flexWrap: "wrap" }}>
              {aniData.season_year && <span className="genre-chip">{aniData.season} {aniData.season_year}</span>}
              {aniData.format && <span className="genre-chip">{aniData.format}</span>}
              {aniData.studio && <span className="genre-chip">{aniData.studio}</span>}
              {aniData.genres?.slice(0, 3).map(g => <span key={g} className="genre-chip">{g}</span>)}
            </div>
          )}

          <div className="flex items-center gap-16 mt-8">
            <div style={{ fontSize: "0.8rem" }}>
              <span className="text-muted">Watching: </span>
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>{a.assignee_name}</span>
              <span className="text-muted"> · Picked by: </span>
              <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{a.assigner_name}</span>
            </div>
            {aniData?.average_score && (
              <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--gold)" }}>
                ★ {(aniData.average_score / 10).toFixed(1)} AniList
              </div>
            )}
          </div>

          <div className="flex items-center gap-16 mt-8">
            <span className={`badge badge-${a.status || "pending"}`}>{a.status || "pending"}</span>
            {a.rating != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: ratingColor }}>
                {a.rating}/10
              </span>
            )}
            {progress != null && (
              <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                {a.episodes_watched}/{a.total_episodes} ep ({progress}%)
              </div>
            )}
          </div>

          {progress != null && (
            <div className="rating-track mt-8" style={{ height: 3 }}>
              <div className="rating-fill" style={{ width: `${progress}%`, height: "100%" }} />
            </div>
          )}

          {a.notes && (
            <div className="text-muted mt-8" style={{ fontSize: "0.8rem", fontStyle: "italic" }}>
              "{a.notes}"
            </div>
          )}
        </div>
      </div>

      {/* Edit form — only visible to assignee */}
      {editing && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="grid-4" style={{ gap: 12 }}>
            <div>
              <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                Rating (0–10)
              </label>
              <input
                type="number" min="0" max="10" step="0.5"
                value={draft.rating}
                onChange={e => setDraft(d => ({ ...d, rating: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div>
              <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                Episodes Watched
              </label>
              <input
                type="number" min="0"
                value={draft.episodes_watched}
                onChange={e => setDraft(d => ({ ...d, episodes_watched: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div>
              <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                Status
              </label>
              <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn btn-primary" style={{ width: "100%" }} onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
              Notes
            </label>
            <input
              value={draft.notes}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
              placeholder="Any thoughts..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Roll() {
  const { id } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [rollMeta, setRollMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/assignments?roll_id=${id}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
    ]).then(async ([data, members]) => {
      setAssignments(data);
      if (data.length) {
        setRollMeta({
          season_name: data[0].season_name,
          roll_number: data[0].roll_number,
          roll_date: data[0].roll_date,
        });
      }
      setLoading(false);

      setSyncing(true);
      const updates = await syncAniListProgress(data, members);
      if (updates.length) {
        await Promise.all(updates.map(u =>
          fetch(`${API}/assignments/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodes_watched: u.episodes_watched, status: u.status }),
            credentials: "include",
          })
        ));
        setAssignments(prev =>
          prev.map(a => {
            const u = updates.find(u => u.id === a.id);
            return u ? { ...a, ...u } : a;
          })
        );
      }
      setSyncing(false);
      setLastSynced(new Date());
    });
  }, [id]);

  async function manualSync() {
    setSyncing(true);
    const members = await fetch(`${API}/members`, { credentials: "include" }).then(r => r.json());
    const updates = await syncAniListProgress(assignments, members);
    if (updates.length) {
      await Promise.all(updates.map(u =>
        fetch(`${API}/assignments/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodes_watched: u.episodes_watched, status: u.status }),
          credentials: "include",
        })
      ));
      setAssignments(prev =>
        prev.map(a => {
          const u = updates.find(u => u.id === a.id);
          return u ? { ...a, ...u } : a;
        })
      );
    }
    setSyncing(false);
    setLastSynced(new Date());
  }

  function handleUpdate(updated) {
    setAssignments(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
  }

  if (loading) return <div className="loading">Loading roll...</div>;

  const rated = assignments.filter(a => a.rating != null);
  const avgRating = rated.length ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : null;
  const completed = assignments.filter(a => a.status === "completed").length;

  return (
    <div>
      <div className="season-banner">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {rollMeta?.season_name}
            </div>
            <h1>Roll #{rollMeta?.roll_number}</h1>
            {rollMeta?.roll_date && (
              <div className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
                {new Date(rollMeta.roll_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
          <div className="flex gap-16" style={{ alignItems: "flex-start" }}>
            <div className="stat">
              <div className="stat-value">{avgRating ? avgRating.toFixed(2) : "—"}</div>
              <div className="stat-label">Avg Rating</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: "var(--green)" }}>{completed}/{assignments.length}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={manualSync} disabled={syncing}>
                {syncing ? "↻ syncing..." : "↻ Sync AniList"}
              </button>
              {lastSynced && !syncing && (
                <div className="text-muted" style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)" }}>
                  synced {lastSynced.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-16">
        {assignments.map(a => (
          <AssignmentCard key={a.id} assignment={a} onUpdate={handleUpdate} />
        ))}
        {!assignments.length && (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div className="text-muted">No assignments found for this roll.</div>
          </div>
        )}
      </div>
    </div>
  );
}