import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

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

function AssignmentCard({ assignment: a }) {
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
          <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text)" }}>
            {aniData?.title_english || aniData?.title_romaji || a.anime_title}
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
      fetch(`${API}/assignments?roll_id=${id}`).then(r => r.json()),
      fetch(`${API}/members`).then(r => r.json()),
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

      // auto-sync from AniList on load
      setSyncing(true);
      const updates = await syncAniListProgress(data, members);
      if (updates.length) {
        await Promise.all(updates.map(u =>
          fetch(`${API}/assignments/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodes_watched: u.episodes_watched, status: u.status }),
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
    const members = await fetch(`${API}/members`).then(r => r.json());
    const updates = await syncAniListProgress(assignments, members);
    if (updates.length) {
      await Promise.all(updates.map(u =>
        fetch(`${API}/assignments/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodes_watched: u.episodes_watched, status: u.status }),
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
              <button
                className="btn btn-ghost btn-sm"
                onClick={manualSync}
                disabled={syncing}
              >
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
          <AssignmentCard key={a.id} assignment={a} />
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