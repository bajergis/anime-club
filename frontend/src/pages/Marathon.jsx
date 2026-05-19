import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status === "done" ? "completed" : status === "active" ? "watching" : "pending"}`}>{status}</span>;
}

// ── Manual Edit Panel (owner, done entries) ───────────────────
function ManualEditPanel({ entry, allMembers, marathonId, onSaved }) {
  const lockedMemberIds = new Set(entry.locks.map(l => l.member_id));
  const missingMembers = allMembers.filter(m => !lockedMemberIds.has(m.id));

  const [addMemberId, setAddMemberId] = useState(missingMembers[0]?.id || "");
  const [manualRating, setManualRating] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState("");

  const [editRatings, setEditRatings] = useState(
    Object.fromEntries(entry.locks.map(l => [l.member_id, l.rating ?? ""]))
  );
  const [savingRating, setSavingRating] = useState({});
  const [watchedAt, setWatchedAt] = useState(entry.watched_at?.split('T')[0] || "");
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    if (!missingMembers.length) {
      setAddMemberId("");
      return;
    }

    const stillMissing = missingMembers.some(m => m.id === addMemberId);

    if (!addMemberId || !stillMissing) {
      setAddMemberId(missingMembers[0].id);
    }
  }, [missingMembers, addMemberId]);

  async function addMember() {
    if (!addMemberId) return;
    setAdding(true);
    setAddMsg("");
    const res = await fetch(`${API}/marathons/${marathonId}/entries/${entry.id}/locks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        member_id: addMemberId,
        rating: manualRating !== "" ? Number(manualRating) : null,
        showed_up: 1,
      }),
      credentials: "include",
    }).then(r => r.json());
    setAdding(false);
    if (res.error) return setAddMsg(`Error: ${res.error}`);
    const synced = res.synced_from_anilist ? " (synced from AniList)" : res.rating != null ? ` (manual: ${res.rating}/10)` : " (no rating found)";
    setAddMsg(`Added ✓${synced}`);
    setManualRating("");

    const nextMissing = missingMembers.find(m => m.id !== addMemberId);
    setAddMemberId(nextMissing?.id ?? "");

    setTimeout(() => setAddMsg(""), 4000);
    onSaved();
  }

  async function saveRating(memberId) {
    setSavingRating(s => ({ ...s, [memberId]: true }));
    const rating = editRatings[memberId];
    await fetch(`${API}/marathons/${marathonId}/entries/${entry.id}/locks/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: rating !== "" ? Number(rating) : null }),
      credentials: "include",
    });
    setSavingRating(s => ({ ...s, [memberId]: false }));
    onSaved();
  }

  async function resync(memberId) {
    setSavingRating(s => ({ ...s, [memberId]: true }));
    await fetch(`${API}/marathons/${marathonId}/entries/${entry.id}/locks/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resync: true }),
      credentials: "include",
    });
    setSavingRating(s => ({ ...s, [memberId]: false }));
    onSaved();
  }

  async function saveWatchedAt() {
    setSavingDate(true);
    await fetch(`${API}/marathons/${marathonId}/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watched_at: watchedAt || null }),
      credentials: "include",
    });
    setSavingDate(false);
    onSaved();
  }

  return (
    <div style={{
      marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)",
      display: "flex", flexDirection: "column", gap: 16,
    }}>

      {/* Watched date */}
      <div>
        <div className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
          Watched Date
        </div>
        <div className="flex gap-8 items-center">
          <input
            type="date"
            value={watchedAt}
            onChange={e => setWatchedAt(e.target.value)}
            style={{ width: 180 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={saveWatchedAt} disabled={savingDate}>
            {savingDate ? "Saving..." : "Save Date"}
          </button>
        </div>
      </div>

      {/* Edit existing ratings */}
      {entry.locks.length > 0 && (
        <div>
          <div className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Edit Ratings
          </div>
          <div className="flex flex-col gap-6">
            {entry.locks.map(lock => (
              <div key={lock.member_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", background: "var(--bg3)",
                borderRadius: "var(--radius)", border: "1px solid var(--border)",
              }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, flex: 1 }}>{lock.member_name}</span>
                {lock.synced_at && (
                  <span className="text-muted" style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)" }}>AniList</span>
                )}
                <input
                  type="number"
                  min="0" max="10" step="0.5"
                  value={editRatings[lock.member_id] ?? ""}
                  onChange={e => setEditRatings(r => ({ ...r, [lock.member_id]: e.target.value }))}
                  style={{ width: 70 }}
                  placeholder="—"
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => saveRating(lock.member_id)}
                  disabled={savingRating[lock.member_id]}
                >
                  {savingRating[lock.member_id] ? "..." : "Save"}
                </button>
                {entry.anilist_id && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => resync(lock.member_id)}
                    disabled={savingRating[lock.member_id]}
                    title="Re-fetch from AniList"
                  >
                    ↻
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add missing member */}
      {missingMembers.length > 0 && (
        <div>
          <div className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Add Member
          </div>
          <div className="flex gap-8 items-center" style={{ flexWrap: "wrap" }}>
            <select
              value={addMemberId}
              onChange={e => setAddMemberId(e.target.value)}
              style={{ flex: 1, minWidth: 140 }}
            >
              {missingMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="0" max="10" step="0.5"
              value={manualRating}
              onChange={e => setManualRating(e.target.value)}
              placeholder="Fallback rating (optional)"
              style={{ width: 200 }}
            />
            <button className="btn btn-primary btn-sm" onClick={addMember} disabled={adding || !addMemberId}>
              {adding ? "Adding..." : "Add + Sync AniList"}
            </button>
          </div>
          {addMsg && (
            <div style={{ fontSize: "0.75rem", marginTop: 6, color: addMsg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>
              {addMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Entry Card ────────────────────────────────────────────────
function EntryCard({ entry, member, isOwner, allMembers, marathonId, onLock, onUnlock, onToggleShowedUp, onActivate, onMarkDone, onDelete, onSaved, position, totalEntries, onMoveUp, onMoveDown }) {
  const [showEdit, setShowEdit] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);
  const [watchedAt, setWatchedAt] = useState("");

  const myLock = entry.locks?.find(l => l.member_id === member?.id);
  const isLockedIn = !!myLock;
  const isActive = entry.status === "active";
  const isDone = entry.status === "done";

  const ratedLocks = entry.locks?.filter(l => l.showed_up && l.rating != null) ?? [];
  const avgRating = ratedLocks.length
    ? ratedLocks.reduce((s, l) => s + l.rating, 0) / ratedLocks.length
    : null;

  const aniData = entry.anilist_data;
  const ratingColor = avgRating >= 9 ? "var(--green)"
    : avgRating >= 7 ? "var(--accent2)"
    : avgRating >= 5 ? "var(--text)"
    : avgRating ? "var(--red)" : "var(--text2)";

  async function handleMarkDone() {
    setMarkingDone(true);
    await onMarkDone(entry.id, watchedAt);
    setMarkingDone(false);
  }

  return (
    <div className="card" style={{
      borderLeft: `3px solid ${isActive ? "var(--accent)" : isDone ? "var(--green)" : "var(--border)"}`,
      opacity: entry.status === "upcoming" ? 0.85 : 1,
    }}>
      <div className="flex gap-16">
        {/* Cover */}
        <div style={{ flexShrink: 0, position: "relative" }}>
          {aniData?.cover_image_large || aniData?.cover_image_medium
            ? <img src={aniData.cover_image_large || aniData.cover_image_medium} alt=""
                style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 4 }} />
            : <div style={{ width: 56, height: 80, borderRadius: 4, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", border: "1px dashed var(--border)" }}>番</div>
          }
          <div style={{
            position: "absolute", top: -6, left: -6,
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: 4, padding: "1px 5px",
            fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "var(--text2)", fontWeight: 700,
          }}>#{entry.position + 1}</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
              {aniData?.title_english || aniData?.title_romaji || entry.anime_title}
            </div>
            <div className="flex items-center gap-8">
              {isDone && isOwner && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowEdit(e => !e)}
                  style={{ fontSize: "0.72rem" }}
                >
                  {showEdit ? "Close Edit" : "✎ Edit"}
                </button>
              )}
              <StatusBadge status={entry.status} />
            </div>
          </div>

          {aniData && (
            <div className="flex gap-6 mb-8" style={{ flexWrap: "wrap" }}>
              {aniData.season_year && <span className="genre-chip">{aniData.season} {aniData.season_year}</span>}
              {aniData.format && <span className="genre-chip">{aniData.format}</span>}
              {aniData.episodes && <span className="genre-chip">{aniData.episodes} eps</span>}
              {aniData.genres?.slice(0, 3).map(g => <span key={g} className="genre-chip">{g}</span>)}
            </div>
          )}

          {/* Watched date */}
          {isDone && entry.watched_at && (
            <div className="text-muted mb-8" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
              Watched {fmt(entry.watched_at)}
            </div>
          )}

          {/* Member locks */}
          {entry.locks?.length > 0 && (
            <div className="flex flex-col gap-4 mb-8">
              {entry.locks.map(lock => (
                <div key={lock.member_id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 8px", borderRadius: "var(--radius)",
                  background: "var(--bg3)", border: "1px solid var(--border)",
                  opacity: lock.showed_up ? 1 : 0.5,
                }}>
                  {lock.avatar_url
                    ? <img src={lock.avatar_url} alt={lock.member_name} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                    : <div className="avatar" style={{ width: 20, height: 20, fontSize: "0.55rem" }}>{lock.member_name?.charAt(0)}</div>
                  }
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, flex: 1 }}>{lock.member_name}</span>
                  {!lock.showed_up && (
                    <span style={{ fontSize: "0.62rem", color: "var(--text2)", fontFamily: "var(--font-mono)" }}>no-show</span>
                  )}
                  {lock.rating != null && lock.showed_up && (
                    <span style={{
                      fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 700,
                      color: lock.rating >= 7 ? "var(--green)" : lock.rating >= 5 ? "var(--text)" : "var(--red)"
                    }}>
                      {lock.rating.toFixed(1)}/10
                    </span>
                  )}
                  {lock.anilist_status && lock.showed_up && (
                    <span className={`badge badge-${lock.anilist_status}`} style={{ fontSize: "0.62rem" }}>{lock.anilist_status}</span>
                  )}
                  {isOwner && isDone && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onToggleShowedUp(entry.id, lock.member_id)}
                      style={{ fontSize: "0.62rem", padding: "1px 5px" }}>
                      {lock.showed_up ? "No-show" : "Showed Up"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Group avg */}
          {isDone && avgRating != null && (
            <div style={{ marginBottom: 6 }}>
              <span className="text-muted" style={{ fontSize: "0.75rem" }}>Group avg: </span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: ratingColor }}>
                {avgRating.toFixed(2)}/10
              </span>
              <span className="text-muted" style={{ fontSize: "0.7rem" }}> ({ratedLocks.length} rated)</span>
            </div>
          )}

          {aniData?.average_score && (
            <div style={{ marginBottom: 8 }}>
              <span className="text-muted" style={{ fontSize: "0.72rem" }}>AniList: </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--gold)" }}>
                ★ {(aniData.average_score / 10).toFixed(1)}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-8 items-center" style={{ flexWrap: "wrap" }}>
            {isActive && !isDone && (
              isLockedIn
                ? <button className="btn btn-ghost btn-sm" onClick={() => onUnlock(entry.id)}
                    style={{ color: "var(--green)", borderColor: "rgba(100,200,100,0.3)" }}>
                    ✓ Watching — Un-lock
                  </button>
                : <button className="btn btn-primary btn-sm" onClick={() => onLock(entry.id)}>
                    + I'm Watching This
                  </button>
            )}

            {isOwner && (
              <>
                {entry.status === "upcoming" && (
                  <button className="btn btn-ghost btn-sm" onClick={() => onActivate(entry.id)}
                    style={{ color: "var(--accent)", borderColor: "rgba(192,132,252,0.3)" }}>
                    ▶ Set Active
                  </button>
                )}
                {isActive && (
                  <div className="flex gap-8 items-center" style={{ flexWrap: "wrap" }}>
                    <input
                      type="date"
                      value={watchedAt}
                      onChange={e => setWatchedAt(e.target.value)}
                      style={{ width: 160 }}
                      title="Watched date (optional)"
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleMarkDone} disabled={markingDone}>
                      {markingDone ? "Syncing..." : "Mark Done & Sync →"}
                    </button>
                  </div>
                )}
                {!isDone && (
                  <>
                    {position > 0 && <button className="btn btn-ghost btn-sm" onClick={onMoveUp}>↑</button>}
                    {position < totalEntries - 1 && <button className="btn btn-ghost btn-sm" onClick={onMoveDown}>↓</button>}
                  </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => onDelete(entry.id)}
                  style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)" }}>
                  Remove
                </button>
              </>
            )}
          </div>

          {/* Manual edit panel */}
          {showEdit && isOwner && isDone && (
            <ManualEditPanel
              entry={entry}
              allMembers={allMembers}
              marathonId={marathonId}
              onSaved={() => { onSaved(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Entry Form ────────────────────────────────────────────
function AddEntryForm({ marathonId, onAdded }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [msg, setMsg] = useState("");

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const data = await fetch(`${API}/anime/search?q=${encodeURIComponent(query)}`, { credentials: "include" }).then(r => r.json());
    setResults(data);
    setSearching(false);
  }

  async function addEntry(anime) {
    setAdding(anime.anilist_id);
    await fetch(`${API}/marathons/${marathonId}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anime_title: anime.title_english || anime.title_romaji, anilist_id: anime.anilist_id }),
      credentials: "include",
    });
    setAdding(null);
    setMsg(`Added "${anime.title_english || anime.title_romaji}" ✓`);
    setResults([]);
    setQuery("");
    setTimeout(() => setMsg(""), 3000);
    onAdded();
  }

  return (
    <div className="card mb-16">
      <h2 className="mb-12">Add Entry</h2>
      <div className="flex gap-8 mb-12">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
          placeholder="Search AniList..."
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" onClick={search} disabled={searching}>
          {searching ? "..." : "Search"}
        </button>
      </div>
      {msg && <div style={{ fontSize: "0.8rem", color: "var(--green)", marginBottom: 8 }}>{msg}</div>}
      {results.length > 0 && (
        <div className="flex flex-col gap-6" style={{ maxHeight: 300, overflowY: "auto" }}>
          {results.map(r => (
            <div key={r.anilist_id} className="flex items-center gap-12" style={{
              padding: "8px 12px", background: "var(--bg3)",
              borderRadius: "var(--radius)", border: "1px solid var(--border)",
            }}>
              {r.cover_image_medium && (
                <img src={r.cover_image_medium} alt="" style={{ width: 32, height: 46, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.title_english || r.title_romaji}</div>
                <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                  {r.season_year} · {r.format} · {r.episodes ?? "?"} eps
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => addEntry(r)} disabled={adding === r.anilist_id} style={{ flexShrink: 0 }}>
                {adding === r.anilist_id ? "..." : "+ Add"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Marathon Page ────────────────────────────────────────
export default function Marathon() {
  const { id } = useParams();
  const { member } = useAuth();
  const [marathon, setMarathon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [error, setError] = useState(null);

  const isOwner = !!member?.owner_id && member.owner_id === member.user_id;

  useEffect(() => { load(); }, [id]);

  async function load() {
    const data = await fetch(`${API}/marathons/${id}`, { credentials: "include" }).then(r => r.json());
    if (data.error) return setError(data.error);
    setMarathon(data);
    setMetaForm({
      name: data.name,
      description: data.description || "",
      started_at: data.started_at?.split('T')[0] || "",
      ended_at: data.ended_at?.split('T')[0] || "",
    });
    setLoading(false);
  }

  async function saveMeta() {
    await fetch(`${API}/marathons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaForm),
      credentials: "include",
    });
    setEditingMeta(false);
    load();
  }

  async function lock(entryId) {
    await fetch(`${API}/marathons/${id}/entries/${entryId}/lock`, { method: "POST", credentials: "include" });
    load();
  }

  async function unlock(entryId) {
    await fetch(`${API}/marathons/${id}/entries/${entryId}/lock`, { method: "DELETE", credentials: "include" });
    load();
  }

  async function toggleShowedUp(entryId, memberId) {
    await fetch(`${API}/marathons/${id}/entries/${entryId}/locks/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showed_up: marathon.entries.find(e => e.id === entryId)?.locks.find(l => l.member_id === memberId)?.showed_up ? 0 : 1 }),
      credentials: "include",
    });
    load();
  }

  async function setEntryStatus(entryId, status) {
    await fetch(`${API}/marathons/${id}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      credentials: "include",
    });
    load();
  }

  async function markDone(entryId, watchedAt) {
    await fetch(`${API}/marathons/${id}/entries/${entryId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watched_at: watchedAt || null }),
      credentials: "include",
    });
    load();
  }

  async function moveEntry(entryId, direction) {
    const movable = marathon.entries.filter(e => e.status !== "done");
    const idx = movable.findIndex(e => e.id === entryId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= movable.length) return;
    const a = movable[idx];
    const b = movable[swapIdx];
    await Promise.all([
      fetch(`${API}/marathons/${id}/entries/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: b.position }), credentials: "include",
      }),
      fetch(`${API}/marathons/${id}/entries/${b.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: a.position }), credentials: "include",
      }),
    ]);
    load();
  }

  async function deleteEntry(entryId) {
    if (!confirm("Remove this entry from the marathon?")) return;
    await fetch(`${API}/marathons/${id}/entries/${entryId}`, { method: "DELETE", credentials: "include" });
    load();
  }

  if (loading) return <div className="loading">Loading marathon...</div>;
  if (error || !marathon) return <div className="loading">Marathon not found.</div>;

  const activeEntry = marathon.entries.find(e => e.status === "active");
  const upcomingEntries = marathon.entries.filter(e => e.status === "upcoming");
  const doneEntries = marathon.entries.filter(e => e.status === "done");

  const allRatedLocks = doneEntries.flatMap(e => e.locks?.filter(l => l.showed_up && l.rating != null) ?? []);
  const overallAvg = allRatedLocks.length
    ? allRatedLocks.reduce((s, l) => s + l.rating, 0) / allRatedLocks.length
    : null;

  const entryProps = (entry, i, arr) => ({
    entry,
    member,
    isOwner,
    allMembers: marathon.members || [],
    marathonId: id,
    onLock: lock,
    onUnlock: unlock,
    onToggleShowedUp: toggleShowedUp,
    onActivate: (eid) => setEntryStatus(eid, "active"),
    onMarkDone: markDone,
    onDelete: deleteEntry,
    onSaved: load,
    position: i,
    totalEntries: arr.length,
    onMoveUp: () => moveEntry(entry.id, -1),
    onMoveDown: () => moveEntry(entry.id, 1),
  });

  return (
    <div>
      {/* Banner */}
      <div className="season-banner mb-24">
        <div className="flex items-center justify-between">
          <div style={{ flex: 1 }}>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
              <Link to="/marathons" style={{ color: "var(--text2)", textDecoration: "none" }}>← Marathons</Link>
              {" · "}
              {marathon.status === "completed" ? "COMPLETED" : "ACTIVE"}
            </div>
            {editingMeta ? (
              <div className="flex flex-col gap-8" style={{ maxWidth: 400 }}>
                <input value={metaForm.name} onChange={e => setMetaForm(f => ({ ...f, name: e.target.value }))} style={{ fontWeight: 700, fontSize: "1rem" }} />
                <input value={metaForm.description} onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
                <div className="flex gap-8">
                  <div>
                    <label style={{ fontSize: "0.65rem", color: "var(--text2)", display: "block", marginBottom: 2 }}>Started</label>
                    <input type="date" value={metaForm.started_at} onChange={e => setMetaForm(f => ({ ...f, started_at: e.target.value }))} style={{ width: 160 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.65rem", color: "var(--text2)", display: "block", marginBottom: 2 }}>Ended</label>
                    <input type="date" value={metaForm.ended_at} onChange={e => setMetaForm(f => ({ ...f, ended_at: e.target.value }))} style={{ width: 160 }} />
                  </div>
                </div>
                <div className="flex gap-8">
                  <button className="btn btn-primary btn-sm" onClick={saveMeta}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingMeta(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1>{marathon.name}</h1>
                {marathon.description && (
                  <div className="text-muted mt-4" style={{ fontSize: "0.85rem" }}>{marathon.description}</div>
                )}
                <div className="text-muted mt-4" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                  {marathon.started_at && <>Started {fmt(marathon.started_at)}</>}
                  {marathon.started_at && marathon.ended_at && " → "}
                  {marathon.ended_at && <>Ended {fmt(marathon.ended_at)}</>}
                </div>
                {isOwner && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingMeta(true)} style={{ marginTop: 8, fontSize: "0.72rem" }}>
                    ✎ Edit Details
                  </button>
                )}
              </>
            )}
          </div>
          <div
            className="flex"
            style={{
              gap: 48,
              paddingLeft: 24,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <div className="stat">
              <div className="stat-value">{marathon.entries.length}</div>
              <div className="stat-label">Entries</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: "var(--green)" }}>{doneEntries.length}</div>
              <div className="stat-label">Done</div>
            </div>
            {overallAvg != null && (
              <div className="stat">
                <div className="stat-value" style={{ color: "var(--gold)" }}>{overallAvg.toFixed(2)}</div>
                <div className="stat-label">Avg Rating</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add entry */}
      {isOwner && marathon.status === "active" && (
        <div className="mb-16">
          <button className="btn btn-ghost btn-sm mb-12" onClick={() => setShowAddForm(f => !f)}>
            {showAddForm ? "Cancel" : "+ Add Entry"}
          </button>
          {showAddForm && <AddEntryForm marathonId={id} onAdded={() => { load(); setShowAddForm(false); }} />}
        </div>
      )}

      {/* Active */}
      {activeEntry && (
        <>
          <div className="section-header mb-12"><h2>Now Watching</h2></div>
          <div className="mb-24">
            <EntryCard {...entryProps(activeEntry, 0, [activeEntry])} />
          </div>
        </>
      )}

      {/* Upcoming */}
      {upcomingEntries.length > 0 && (
        <>
          <div className="section-header mb-12">
            <h2>Up Next</h2>
            <span className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>{upcomingEntries.length} remaining</span>
          </div>
          <div className="flex flex-col gap-8 mb-24">
            {upcomingEntries.map((entry, i) => (
              <EntryCard key={entry.id} {...entryProps(entry, i, upcomingEntries)} />
            ))}
          </div>
        </>
      )}

      {/* Done */}
      {doneEntries.length > 0 && (
        <>
          <div className="section-header mb-12">
            <h2>Watched</h2>
            <span className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>{doneEntries.length} entries</span>
          </div>
          <div className="flex flex-col gap-8">
            {doneEntries.map((entry, i) => (
              <EntryCard key={entry.id} {...entryProps(entry, i, doneEntries)} />
            ))}
          </div>
        </>
      )}

      {marathon.entries.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎬</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No entries yet</div>
          <div className="text-muted" style={{ fontSize: "0.85rem" }}>
            {isOwner ? "Add entries above to get started." : "The owner hasn't added any entries yet."}
          </div>
        </div>
      )}
    </div>
  );
}