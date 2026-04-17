import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const STATUSES = ["pending", "watching", "completed", "dropped", "hiatus"];

function AnimeSearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const data = await fetch(`${API}/anime/search?q=${encodeURIComponent(query)}`).then(r => r.json());
    setResults(data);
    setSearching(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
    }}>
      <div className="card" style={{ width: 480, maxHeight: "80vh", overflow: "auto" }}>
        <div className="flex items-center justify-between mb-16">
          <h2>Search AniList</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="flex gap-8 mb-16">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="e.g. Fullmetal Alchemist"
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={search} style={{ whiteSpace: "nowrap" }}>
            {searching ? "..." : "Search"}
          </button>
        </div>
        <div className="flex flex-col gap-8">
          {results.map(r => (
            <div
              key={r.anilist_id}
              className="anime-card"
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(r)}
            >
              {r.cover_image_medium && (
                <img className="anime-thumb" src={r.cover_image_medium} alt="" />
              )}
              <div className="anime-info">
                <div className="anime-title">{r.title_english || r.title_romaji}</div>
                <div className="anime-meta">{r.season_year} · {r.format} · {r.episodes || "?"} eps</div>
                <div className="anime-meta text-mono" style={{ color: "var(--gold)", fontSize: "0.7rem" }}>
                  ★ {r.average_score ? (r.average_score / 10).toFixed(1) : "—"} AniList
                </div>
                <div className="flex" style={{ flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                  {r.genres?.slice(0, 3).map(g => <span key={g} className="genre-chip">{g}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment: initialA, onUpdate }) {
  const [a, setA] = useState(initialA);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    rating: a.rating ?? "",
    episodes_watched: a.episodes_watched ?? "",
    status: a.status,
    notes: a.notes ?? ""
  });
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const aniData = a.anilist_data
    ? (() => { try { return JSON.parse(a.anilist_data); } catch { return null; } })()
    : null;

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
    });
    const updated = { ...a, ...draft, rating: draft.rating !== "" ? Number(draft.rating) : null };
    setA(updated);
    setSaving(false);
    setEditing(false);
    onUpdate?.(updated);
  }

  async function refreshAniList() {
    setRefreshing(true);
    const data = await fetch(`${API}/assignments/${a.id}/refresh-anilist`, { method: "POST" }).then(r => r.json());
    if (!data.error) {
      setA(prev => ({ ...prev, anilist_data: JSON.stringify(data), anilist_id: data.anilist_id, total_episodes: data.episodes }));
    }
    setRefreshing(false);
  }

  async function linkAniList(selected) {
    await fetch(`${API}/assignments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilist_id: selected.anilist_id }),
    });
    await fetch(`${API}/assignments/${a.id}/refresh-anilist`, { method: "POST" });
    const fresh = await fetch(`${API}/assignments/${a.id}`).then(r => r.json());
    setA(fresh);
    setShowSearch(false);
  }

  const progress = a.episodes_watched && a.total_episodes
    ? Math.round((a.episodes_watched / a.total_episodes) * 100)
    : null;

  const ratingColor = a.rating >= 9 ? "var(--green)"
    : a.rating >= 7 ? "var(--accent2)"
    : a.rating >= 5 ? "var(--text)"
    : a.rating ? "var(--red)" : "var(--text2)";

  return (
    <>
      {showSearch && <AnimeSearchModal onSelect={linkAniList} onClose={() => setShowSearch(false)} />}
      <div className="card" style={{ borderLeft: `3px solid ${aniData?.cover_color || "var(--border)"}` }}>
        <div className="flex gap-16">
          {/* Cover */}
          <div style={{ flexShrink: 0 }}>
            {aniData?.cover_image_large
              ? <img src={aniData.cover_image_large} alt="" style={{ width: 72, height: 102, objectFit: "cover", borderRadius: 6 }} />
              : (
                <div
                  style={{
                    width: 72, height: 102, borderRadius: 6, background: "var(--bg3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "2rem", cursor: "pointer", border: "1px dashed var(--border)"
                  }}
                  onClick={() => setShowSearch(true)}
                  title="Link AniList"
                >番</div>
              )
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
                  {aniData?.title_english || aniData?.title_romaji || a.anime_title}
                </div>
                {aniData && aniData.title_romaji !== (aniData.title_english || aniData.title_romaji) && (
                  <div className="text-muted" style={{ fontSize: "0.75rem" }}>{aniData.title_romaji}</div>
                )}
              </div>
              <div className="flex gap-8">
                {!aniData && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowSearch(true)}>🔗 Link</button>
                )}
                {aniData && (
                  <button className="btn btn-ghost btn-sm" onClick={refreshAniList} disabled={refreshing}>
                    {refreshing ? "..." : "↻"}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(!editing)}>
                  {editing ? "Cancel" : "Edit"}
                </button>
              </div>
            </div>

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
    </>
  );
}

export default function Roll() {
  const { id } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [rollMeta, setRollMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/assignments?roll_id=${id}`)
      .then(r => r.json())
      .then(data => {
        setAssignments(data);
        if (data.length) {
          setRollMeta({
            season_name: data[0].season_name,
            roll_number: data[0].roll_number,
            roll_date: data[0].roll_date
          });
        }
        setLoading(false);
      });
  }, [id]);

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
          <div className="flex gap-16">
            <div className="stat">
              <div className="stat-value">{avgRating ? avgRating.toFixed(2) : "—"}</div>
              <div className="stat-label">Avg Rating</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: "var(--green)" }}>{completed}/{assignments.length}</div>
              <div className="stat-label">Completed</div>
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