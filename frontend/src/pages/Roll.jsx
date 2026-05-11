import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const AUTH = API.replace("/api", "");

const STATUSES = ["pending", "watching", "completed", "dropped", "hiatus"];

const STATUS_MAP = {
  CURRENT: "watching",
  COMPLETED: "completed",
  DROPPED: "dropped",
  PAUSED: "hiatus",
  PLANNING: "pending",
};

function StatusBadge({ status }) {
  return <span className={`badge badge-${status || "pending"}`}>{status || "pending"}</span>;
}

function ForceStartPicker({ groupMembers, generating, onGenerate }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);

  function toggle(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  if (!open) {
    return (
      <button
        className="btn btn-ghost"
        onClick={() => { setOpen(true); setSelected([]); }}
        style={{ width: "100%", fontSize: "0.75rem" }}
      >
        Force Start — Pick Members
      </button>
    );
  }

  return (
    <div style={{ marginTop: 8, padding: 12, background: "var(--bg3)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
      <div className="text-muted mb-8" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Select participating members
      </div>
      <div className="flex flex-col gap-6 mb-12">
        {groupMembers.map(m => (
          <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              onChange={() => toggle(m.id)}
              style={{ width: "auto" }}
            />
            {m.avatar_url && (
              <img src={m.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} />
            )}
            {m.name}
          </label>
        ))}
      </div>
      <div className="flex gap-8">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onGenerate(selected)}
          disabled={generating || selected.length < 2}
          style={{ flex: 1 }}
        >
          {generating ? "Generating..." : `🎲 Start with ${selected.length} members`}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Drafting: Lock-in Lobby ───────────────────────────────────
function DraftingView({ rollId, rollNumber, seasonName, status, member, onRefresh, rollTitle }) {
  const { readiness, groupMembers, roll } = status;
  const [locking, setLocking] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isLockedIn = readiness.some(r => r.member_id === member?.id);
  const isOwner = roll?.owner_id === member?.user_id;
  const allLocked = groupMembers.length > 0 && readiness.length === groupMembers.length;

  async function toggleLockIn() {
    setLocking(true);
    await fetch(`${API}/rolls/${rollId}/lock-in`, {
      method: isLockedIn ? "DELETE" : "POST",
      credentials: "include",
    });
    setLocking(false);
    onRefresh();
  }

  async function generate(force = false) {
    if (!force && !allLocked) return;
    setGenerating(true);
    const res = await fetch(`${API}/rolls/${rollId}/generate`, {
      method: "POST",
      credentials: "include",
    });
    setGenerating(false);
    if (res.ok) onRefresh();
  }

  async function generateWithMembers(memberIds) {
    if (memberIds.length < 2) return;
    setGenerating(true);
    const res = await fetch(`${API}/rolls/${rollId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_ids: memberIds }),
      credentials: "include",
    });
    setGenerating(false);
    if (res.ok) onRefresh();
  }

  return (
    <div>
      <div className="season-banner">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {seasonName} · LOBBY
            </div>
            <h1>Roll #{rollNumber}
                {rollTitle && (
                    <span style={{ color: "var(--text2)", fontWeight: 400 }}> aka "{rollTitle}"</span>
                )}
            </h1>
            <div className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
              Waiting for members to lock in before assignments are generated.
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {readiness.length} / {groupMembers.length}
            </div>
            <div className="stat-label">Locked In</div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, marginTop: 24 }}>
        {/* Member readiness */}
        <div className="card">
          <h2 className="mb-16">Member Status</h2>
          <div className="flex flex-col gap-8">
            {groupMembers.map(m => {
              const locked = readiness.find(r => r.member_id === m.id);
              return (
                <div key={m.id} className="flex items-center gap-12" style={{
                  padding: "10px 14px",
                  background: locked ? "rgba(100,200,100,0.08)" : "var(--bg3)",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${locked ? "rgba(100,200,100,0.3)" : "var(--border)"}`,
                }}>
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt={m.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                    : <div className="avatar">{m.name?.charAt(0)}</div>
                  }
                  <div style={{ flex: 1, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                    {locked
                      ? <span style={{ color: "var(--green)" }}>✓ Ready</span>
                      : <span className="text-muted">waiting...</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h2 className="mb-16">Your Status</h2>
          <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
            Lock in to confirm you're participating in this roll. You can un-ready until the owner generates assignments.
          </div>
          <button
            className={`btn ${isLockedIn ? "btn-ghost" : "btn-primary"}`}
            onClick={toggleLockIn}
            disabled={locking}
            style={{ width: "100%", marginBottom: 12 }}
          >
            {locking ? "..." : isLockedIn ? "✓ Locked In — Click to Un-ready" : "🔒 Lock In"}
          </button>

          {isOwner && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <div className="text-muted mb-12" style={{ fontSize: "0.75rem" }}>Owner controls</div>
              <button
                className="btn btn-primary"
                onClick={() => generate(false)}
                disabled={generating || !allLocked}
                style={{ width: "100%", marginBottom: 8 }}
              >
                {generating ? "Generating..." : `🎲 Generate Assignments${allLocked ? "" : ` (${readiness.length}/${groupMembers.length} ready)`}`}
              </button>
              {!allLocked && (
                <ForceStartPicker
                  groupMembers={groupMembers}
                  generating={generating}
                  onGenerate={(memberIds) => generateWithMembers(memberIds)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Selecting: Pick from planning list ────────────────────────
function SelectingView({ rollId, rollNumber, seasonName, status, member, onRefresh, onRevealed, rollTitle }) {
  const { derangement, selections, groupMembers } = status;
  const [planningList, setPlanningList] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingPlanning, setLoadingPlanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState(null); // { anime_title, anilist_id, anilist_data }

  const myAssigneeId = derangement?.[member?.id];
  const myAssignee = groupMembers.find(m => m.id === myAssigneeId);
  const hasSelected = selections.some(s => s.assigner_id === member?.id);

  useEffect(() => {
    if (!myAssigneeId || !myAssignee) return;
    loadPlanningList();
  }, [myAssigneeId]);

  async function loadPlanningList() {
    setLoadingPlanning(true);
    const res = await fetch(`${API}/anime/anilist-proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($username: String) {
          MediaListCollection(userName: $username, type: ANIME, status: PLANNING) {
            lists { entries { media {
              id title { english romaji }
              coverImage { medium color }
              episodes format season seasonYear genres averageScore
            }}}
          }
        }`,
        variables: { username: myAssignee.anilist_username },
      }),
      credentials: "include",
    }).then(r => r.json()).catch(() => null);

    const entries = res?.data?.MediaListCollection?.lists?.[0]?.entries ?? [];
    setPlanningList(entries.map(e => e.media));
    setLoadingPlanning(false);
  }

  async function searchAniList() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const data = await fetch(`${API}/anime/search?q=${encodeURIComponent(searchQuery)}`, {
      credentials: "include",
    }).then(r => r.json());
    setSearchResults(data);
    setSearching(false);
  }

  async function submitSelection() {
    if (!selected) return;
    setSubmitting(true);
    const res = await fetch(`${API}/rolls/${rollId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anime_title: selected.anime_title,
        anilist_id: selected.anilist_id,
        anilist_data: selected.anilist_data,
      }),
      credentials: "include",
    }).then(r => r.json());
    setSubmitting(false);
    if (res.revealed) {
      onRevealed();
    } else {
      onRefresh();
    }
  }

  // Non-assigner view — just shows who's picked
  const memberMap = Object.fromEntries(groupMembers.map(m => [m.id, m]));

  return (
    <div>
      <div className="season-banner">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {seasonName} · SELECTING
            </div>
            <h1>Roll #{rollNumber}
                {rollTitle && (
                    <span style={{ color: "var(--text2)", fontWeight: 400 }}> aka "{rollTitle}"</span>
                )}
            </h1>
            <div className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
              Each assigner is picking a show for their assigned member. Picks are revealed when everyone is done.
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {selections.length} / {Object.keys(derangement ?? {}).length}
            </div>
            <div className="stat-label">Selections Made</div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 24, marginTop: 24 }}>
        {/* Selection status */}
        <div className="card">
          <h2 className="mb-16">Selection Status</h2>
          <div className="flex flex-col gap-8">
            {Object.entries(derangement ?? {}).map(([assignerId, assigneeId]) => {
              const assigner = memberMap[assignerId];
              const assignee = memberMap[assigneeId];
              const done = selections.some(s => s.assigner_id === assignerId);
              return (
                <div key={assignerId} className="flex items-center gap-12" style={{
                  padding: "10px 14px",
                  background: done ? "rgba(100,200,100,0.08)" : "var(--bg3)",
                  borderRadius: "var(--radius)",
                  border: `1px solid ${done ? "rgba(100,200,100,0.3)" : "var(--border)"}`,
                }}>
                  <div style={{ flex: 1, fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--accent2)", fontWeight: 600 }}>{assigner?.name}</span>
                    <span className="text-muted"> picking for </span>
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>{assignee?.name}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                    {done
                      ? <span style={{ color: "var(--green)" }}>✓ Done</span>
                      : assignerId === member?.id
                        ? <span style={{ color: "var(--gold)" }}>← you</span>
                        : <span className="text-muted">picking...</span>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Picker */}
        <div className="card">
          {!myAssigneeId ? (
            <div className="text-muted" style={{ textAlign: "center", padding: 32 }}>
              You're not an assigner in this roll.
            </div>
          ) : hasSelected ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>✓</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Selection submitted!</div>
              <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                Waiting for others to finish. The roll will reveal automatically.
              </div>
            </div>
          ) : (
            <div>
              <h2 className="mb-4">Pick for {myAssignee?.name}</h2>
              <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
                {loadingPlanning
                  ? "Loading their planning list..."
                  : planningList.length > 0
                    ? `Showing ${myAssignee?.name}'s AniList planning list. You can also search below.`
                    : `${myAssignee?.name} has nothing on their planning list — search AniList instead.`
                }
              </div>

              {selected && (
                <div className="flex items-center gap-12 mb-16" style={{
                  padding: "12px 16px",
                  background: "rgba(100,200,100,0.08)",
                  borderRadius: "var(--radius)",
                  border: "1px solid rgba(100,200,100,0.3)",
                }}>
                  {selected.cover && (
                    <img src={selected.cover} alt="" style={{ width: 36, height: 52, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{selected.anime_title}</div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>Selected</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Change</button>
                  <button className="btn btn-primary btn-sm" onClick={submitSelection} disabled={submitting}>
                    {submitting ? "Submitting..." : "Confirm →"}
                  </button>
                </div>
              )}

              {/* Planning list */}
              {!selected && planningList.length > 0 && (
                <div className="mb-16">
                  <div className="text-muted mb-8" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {myAssignee?.name}'s Planning List
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {planningList.map(m => (
                      <div
                        key={m.id}
                        className="flex items-center gap-10"
                        style={{
                          padding: "8px 12px", borderRadius: "var(--radius)",
                          background: "var(--bg3)", border: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                        onClick={() => setSelected({
                          anime_title: m.title?.english || m.title?.romaji,
                          anilist_id: m.id,
                          anilist_data: {
                            anilist_id: m.id,
                            title_english: m.title?.english,
                            title_romaji: m.title?.romaji,
                            cover_image_medium: m.coverImage?.medium,
                            cover_color: m.coverImage?.color,
                            episodes: m.episodes,
                            format: m.format,
                            season: m.season,
                            season_year: m.seasonYear,
                            genres: m.genres,
                            average_score: m.averageScore,
                          },
                          cover: m.coverImage?.medium,
                        })}
                      >
                        {m.coverImage?.medium && (
                          <img src={m.coverImage.medium} alt="" style={{ width: 32, height: 46, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{m.title?.english || m.title?.romaji}</div>
                          <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                            {m.seasonYear} · {m.format} · {m.episodes ?? "?"} eps
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AniList search fallback */}
              {!selected && (
                <div>
                  <div className="text-muted mb-8" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Search AniList
                  </div>
                  <div className="flex gap-8 mb-8">
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchAniList()}
                      placeholder="Search for any anime..."
                      style={{ flex: 1 }}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={searchAniList} disabled={searching}>
                      {searching ? "..." : "Search"}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                      {searchResults.map(r => (
                        <div
                          key={r.anilist_id}
                          className="flex items-center gap-10"
                          style={{
                            padding: "8px 12px", borderRadius: "var(--radius)",
                            background: "var(--bg3)", border: "1px solid var(--border)",
                            cursor: "pointer",
                          }}
                          onClick={() => setSelected({
                            anime_title: r.title_english || r.title_romaji,
                            anilist_id: r.anilist_id,
                            anilist_data: r,
                            cover: r.cover_image_medium,
                          })}
                        >
                          {r.cover_image_medium && (
                            <img src={r.cover_image_medium} alt="" style={{ width: 32, height: 46, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.title_english || r.title_romaji}</div>
                            <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                              {r.season_year} · {r.format} · {r.episodes ?? "?"} eps
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Active/Completed: Assignment Cards ────────────────────────
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
              MediaList(userName: $username, mediaId: $mediaId) { progress status }
            }`,
            variables: { username: member.anilist_username, mediaId: a.anilist_id },
          }),
          credentials: "include",
        }).then(r => r.json()).catch(() => null);
        const entry = res?.data?.MediaList;
        if (!entry) return null;
        return { id: a.id, episodes_watched: entry.progress, status: STATUS_MAP[entry.status] || a.status };
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
      ...a, ...draft,
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
            ? <img src={aniData.cover_image_large} alt="" style={{ width: 72, height: 102, objectFit: "cover", borderRadius: 6 }} />
            : <div style={{ width: 72, height: 102, borderRadius: 6, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", border: "1px dashed var(--border)" }}>番</div>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between">
            <div style={{ fontWeight: 600, fontSize: "1rem" }}>
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
            <StatusBadge status={a.status} />
            {a.rating != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: ratingColor }}>
                {a.rating}/10
              </span>
            )}
            {progress != null && (a.status === "watching" || a.status === "hiatus") && (
              <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                {a.episodes_watched}/{a.total_episodes} ep ({progress}%)
              </span>
            )}
          </div>
          {progress != null && (a.status === "watching" || a.status === "hiatus") && (
            <div className="rating-track mt-8" style={{ height: 3 }}>
              <div className="rating-fill" style={{ width: `${progress}%`, height: "100%" }} />
            </div>
          )}
          {a.notes && (
            <div className="text-muted mt-8" style={{ fontSize: "0.8rem", fontStyle: "italic" }}>"{a.notes}"</div>
          )}
        </div>
      </div>
      {editing && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="grid-4" style={{ gap: 12 }}>
            <div>
              <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Rating (0–10)</label>
              <input type="number" min="0" max="10" step="0.5" value={draft.rating}
                onChange={e => setDraft(d => ({ ...d, rating: e.target.value }))} placeholder="—" />
            </div>
            <div>
              <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Episodes Watched</label>
              <input type="number" min="0" value={draft.episodes_watched}
                onChange={e => setDraft(d => ({ ...d, episodes_watched: e.target.value }))} placeholder="—" />
            </div>
            <div>
              <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Status</label>
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
            <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>Notes</label>
            <input value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Any thoughts..." />
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveView({ rollId, rollNumber, seasonName, rollState, seasonId, rollTitle }) {
  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/assignments?roll_id=${rollId}`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
    ]).then(async ([data, mems]) => {
      setAssignments(data);
      setMembers(mems);
      setLoading(false);
      setSyncing(true);
      const updates = await syncAniListProgress(data, mems);
      if (updates.length) {
        await Promise.all(updates.map(u =>
          fetch(`${API}/assignments/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ episodes_watched: u.episodes_watched, status: u.status }),
            credentials: "include",
          })
        ));
        setAssignments(prev => prev.map(a => {
          const u = updates.find(u => u.id === a.id);
          return u ? { ...a, ...u } : a;
        }));
      }
      setSyncing(false);
      setLastSynced(new Date());
    });
  }, [rollId]);

  async function manualSync() {
    setSyncing(true);
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

  if (loading) return <div className="loading">Loading roll...</div>;

  const rated = assignments.filter(a => a.rating != null);
  const avgRating = rated.length ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : null;
  const completed = assignments.filter(a => a.status === "completed" || a.status === "dropped").length;

  return (
    <div>
      <div className="season-banner">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              {seasonName}
            </div>
            <h1>Roll #{rollNumber}
                {rollTitle && (
                    <span style={{ color: "var(--text2)", fontWeight: 400 }}> aka "{rollTitle}"</span>
                )}
            </h1>
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
              <Link to={`/season/${seasonId}`} className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()}>
                To Season →
              </Link>
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

// ── Main Roll Page ────────────────────────────────────────────
export default function Roll() {
  const { id } = useParams();
  const { member } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    const data = await fetch(`${API}/rolls/${id}/status`, { credentials: "include" }).then(r => r.ok ? r.json() : null);
    if (data) setStatus(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds during drafting/selecting phases
    const interval = setInterval(() => {
      if (status?.state === "drafting" || status?.state === "selecting") {
        fetchStatus();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus, status?.state]);

  if (loading) return <div className="loading">Loading roll...</div>;
  if (!status) return <div className="loading">Roll not found.</div>;

  const { roll, state } = status;
  const rollNumber = roll?.roll_number;
  const seasonName = roll?.season_name;

  function handleRevealed() {
    fetchStatus();
  }

  if (state === "drafting") {
    return (
      <DraftingView
        rollId={id}
        rollNumber={rollNumber}
        seasonName={seasonName}
        status={status}
        member={member}
        onRefresh={fetchStatus}
        rollTitle={roll?.title}
      />
    );
  }

  if (state === "selecting") {
    return (
      <SelectingView
        rollId={id}
        rollNumber={rollNumber}
        seasonName={seasonName}
        status={status}
        member={member}
        onRefresh={fetchStatus}
        onRevealed={handleRevealed}
        rollTitle={roll?.title}
      />
    );
  }

  return (
    <ActiveView
      rollId={id}
      rollNumber={rollNumber}
      seasonName={seasonName}
      rollState={state}
      seasonId={roll?.season_id}
      rollTitle={roll?.title}
    />
  );
}