import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ── Season Editor ─────────────────────────────────────────────
function SeasonEditor({ season, members, onSaved }) {
  const [form, setForm] = useState({
    name: season.name,
    started_at: season.started_at || "",
    ended_at: season.ended_at || "",
    is_active: !!season.is_active,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    await fetch(`${API}/seasons/${season.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        started_at: form.started_at || null,
        ended_at: form.ended_at || null,
        is_active: form.is_active,
      }),
    });
    setSaving(false);
    setMsg("Saved ✓");
    setTimeout(() => setMsg(""), 2000);
    onSaved();
  }

  return (
    <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-8">
        <h3 style={{ color: "var(--text)", textTransform: "none", letterSpacing: 0 }}>{season.name}</h3>
        <div className="flex gap-8 items-center">
          {msg && <span style={{ fontSize: "0.75rem", color: "var(--green)" }}>{msg}</span>}
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      <div className="grid-4" style={{ gap: 10 }}>
        <div>
          <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Start Date</label>
          <input type="date" value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>End Date</label>
          <input type="date" value={form.ended_at} onChange={e => setForm(f => ({ ...f, ended_at: e.target.value }))} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <label style={{ fontSize: "0.75rem", color: "var(--text2)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              style={{ width: "auto" }}
            />
            Active season
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Manual Roll Builder ───────────────────────────────────────
function ManualRollBuilder({ season, members, onRollAdded }) {
  const [rollDate, setRollDate] = useState("");
  const [rows, setRows] = useState([{ assignee_id: "", assigner_id: "", anime_title: "" }]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function addRow() {
    setRows(r => [...r, { assignee_id: "", assigner_id: "", anime_title: "" }]);
  }
  function removeRow(i) {
    setRows(r => r.filter((_, idx) => idx !== i));
  }
  function updateRow(i, field, val) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  async function submit() {
    const valid = rows.filter(r => r.assignee_id && r.assigner_id && r.anime_title.trim());
    if (!valid.length) return;
    setSaving(true);

    const rollRes = await fetch(`${API}/seasons/${season.id}/rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roll_date: rollDate || undefined, skip_derangement: true }),
    }).then(r => r.json());

    const roll_id = rollRes.roll_id;

    for (const row of valid) {
      await fetch(`${API}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roll_id, ...row }),
      });
    }

    setSaving(false);
    setMsg(`Roll #${rollRes.roll_number} created with ${valid.length} assignments ✓`);
    setRows([{ assignee_id: "", assigner_id: "", anime_title: "" }]);
    setRollDate("");
    setTimeout(() => setMsg(""), 4000);
    onRollAdded();
  }

  return (
    <div className="card mt-16">
      <div className="flex items-center justify-between mb-16">
        <h2>Add Historical Roll — {season.name}</h2>
        {msg && <span style={{ fontSize: "0.75rem", color: "var(--green)" }}>{msg}</span>}
      </div>

      <div className="flex gap-8 mb-16" style={{ alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Roll Date (optional)</label>
          <input type="date" value={rollDate} onChange={e => setRollDate(e.target.value)} style={{ width: 180 }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={addRow}>+ Add Row</button>
      </div>

      <table className="data-table" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Watching (Assignee)</th>
            <th>Picked By (Assigner)</th>
            <th>Anime Title</th>
            <th>Rating</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>
                <select value={row.assignee_id} onChange={e => updateRow(i, "assignee_id", e.target.value)}>
                  <option value="">— select —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </td>
              <td>
                <select value={row.assigner_id} onChange={e => updateRow(i, "assigner_id", e.target.value)}>
                  <option value="">— select —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </td>
              <td>
                <input
                  value={row.anime_title}
                  onChange={e => updateRow(i, "anime_title", e.target.value)}
                  placeholder="e.g. Fullmetal Alchemist"
                />
              </td>
              <td style={{ width: 80 }}>
                <input
                  type="number" min="0" max="10" step="0.5"
                  value={row.rating || ""}
                  onChange={e => updateRow(i, "rating", e.target.value)}
                  placeholder="—"
                />
              </td>
              <td>
                <button className="btn btn-ghost btn-sm" onClick={() => removeRow(i)} style={{ color: "var(--red)" }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !rows.some(r => r.assignee_id && r.assigner_id && r.anime_title)}>
          {saving ? "Saving..." : "Save Roll"}
        </button>
      </div>
    </div>
  );
}

// ── Bulk AniList Refresh ──────────────────────────────────────
function BulkRefresh({ seasons }) {
  const [seasonId, setSeasonId] = useState("all");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [done, setDone] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function run() {
    setRunning(true);
    setDone(false);
    setLog([]);

    const url = seasonId === "all"
      ? `${API}/assignments/bulk-refresh-anilist`
      : `${API}/assignments/bulk-refresh-anilist?season_id=${seasonId}`;

    const res = await fetch(url, { method: "POST" });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "done") {
            setLog(l => [...l, { text: `✓ Done — ${evt.updated} updated, ${evt.skipped} skipped`, color: "var(--green)" }]);
            setDone(true);
          } else if (evt.type === "ok") {
            setLog(l => [...l, { text: `✓ ${evt.title}`, color: "var(--text2)" }]);
          } else if (evt.type === "skip") {
            setLog(l => [...l, { text: `— ${evt.title} (not found)`, color: "var(--border)" }]);
          } else if (evt.type === "error") {
            setLog(l => [...l, { text: `✗ ${evt.title}: ${evt.error}`, color: "var(--red)" }]);
          }
        } catch {}
      }
    }
    setRunning(false);
  }

  return (
    <div className="card mt-24">
      <h2 className="mb-8">Bulk AniList Refresh</h2>
      <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
        Fetches cover art, genres, episode counts and scores for all assignments missing AniList data.
      </div>
      <div className="flex gap-8 mb-16" style={{ alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Season</label>
          <select value={seasonId} onChange={e => setSeasonId(e.target.value)} style={{ width: 200 }}>
            <option value="all">All seasons</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={running}>
          {running ? "Running..." : "▶ Start Refresh"}
        </button>
      </div>

      {log.length > 0 && (
        <div
          ref={logRef}
          style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
            padding: 12, maxHeight: 240, overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: "0.72rem"
          }}
        >
          {log.map((l, i) => (
            <div key={i} style={{ color: l.color, lineHeight: 1.8 }}>{l.text}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entry Editor ──────────────────────────────────────────────
function EntryEditor({ members, seasons }) {
  const [query, setQuery] = useState("");
  const [filterMember, setFilterMember] = useState("");
  const [filterSeason, setFilterSeason] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // AniList search state per assignment being edited
  const [aniQuery, setAniQuery] = useState("");
  const [aniResults, setAniResults] = useState([]);
  const [aniSearching, setAniSearching] = useState(false);
  const [msg, setMsg] = useState({});

  async function search() {
    setSearching(true);
    const params = new URLSearchParams();
    if (filterMember) params.set("member_id", filterMember);
    if (filterSeason) params.set("season_id", filterSeason);
    const data = await fetch(`${API}/assignments?${params}`).then(r => r.json());
    const filtered = query.trim()
      ? data.filter(a => a.anime_title?.toLowerCase().includes(query.toLowerCase()))
      : data;
    setAssignments(filtered);
    setSearching(false);
  }

  async function searchAniList() {
    if (!aniQuery.trim()) return;
    setAniSearching(true);
    const data = await fetch(`${API}/anime/search?q=${encodeURIComponent(aniQuery)}`).then(r => r.json());
    setAniResults(data);
    setAniSearching(false);
  }

  async function linkAndRefresh(assignmentId, anilistId) {
    // patch the anilist_id
    await fetch(`${API}/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anilist_id: anilistId }),
    });
    // trigger refresh to pull metadata
    const fresh = await fetch(`${API}/assignments/${assignmentId}/refresh-anilist`, { method: "POST" }).then(r => r.json());
    // update local state
    setAssignments(prev => prev.map(a => a.id === assignmentId
      ? { ...a, anime_title: fresh.title_english || fresh.title_romaji || a.anime_title, anilist_id: anilistId }
      : a
    ));
    setMsg(m => ({ ...m, [assignmentId]: "Linked ✓" }));
    setTimeout(() => setMsg(m => { const n = { ...m }; delete n[assignmentId]; return n; }), 2000);
    setEditingId(null);
    setAniResults([]);
    setAniQuery("");
  }

  async function saveTitle(assignmentId, newTitle) {
    await fetch(`${API}/assignments/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anime_title: newTitle }),
    });
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, anime_title: newTitle } : a));
    setMsg(m => ({ ...m, [assignmentId]: "Saved ✓" }));
    setTimeout(() => setMsg(m => { const n = { ...m }; delete n[assignmentId]; return n; }), 2000);
  }

  return (
    <div>
      {/* Search bar */}
      <div className="card mb-16">
        <h2 className="mb-16">Edit Entries</h2>
        <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
          Search your assignments and fix titles by linking them to the correct AniList entry.
        </div>
        <div className="flex gap-8" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Search by title</label>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="e.g. Fullmetal..."
            />
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Member</label>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}>
              <option value="">All members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>Season</label>
            <select value={filterSeason} onChange={e => setFilterSeason(e.target.value)}>
              <option value="">All seasons</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={search} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Results */}
      {assignments.length > 0 && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Assignee</th>
                <th>Season / Roll</th>
                <th>AniList</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <>
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.anime_title}</td>
                    <td style={{ color: "var(--accent)" }}>{a.assignee_name}</td>
                    <td className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                      {a.season_name} · #{a.roll_number}
                    </td>
                    <td>
                      {a.anilist_id
                        ? <span style={{ color: "var(--green)", fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>#{a.anilist_id}</span>
                        : <span style={{ color: "var(--text2)", fontSize: "0.75rem" }}>not linked</span>
                      }
                    </td>
                    <td>
                      <div className="flex gap-8 items-center">
                        {msg[a.id] && <span style={{ fontSize: "0.7rem", color: "var(--green)" }}>{msg[a.id]}</span>}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditingId(editingId === a.id ? null : a.id);
                            setAniResults([]);
                            setAniQuery("");
                          }}
                        >
                          {editingId === a.id ? "Cancel" : "Fix"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {editingId === a.id && (
                    <tr key={`${a.id}-edit`}>
                      <td colSpan={5} style={{ background: "var(--bg3)", padding: 16 }}>
                        <div className="flex gap-8 mb-12" style={{ alignItems: "flex-end" }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 3 }}>
                              Search AniList for correct entry
                            </label>
                            <input
                              value={aniQuery}
                              onChange={e => setAniQuery(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && searchAniList()}
                              placeholder="Search AniList..."
                              autoFocus
                            />
                          </div>
                          <button className="btn btn-primary btn-sm" onClick={searchAniList} disabled={aniSearching}>
                            {aniSearching ? "..." : "Search"}
                          </button>
                        </div>

                        {/* AniList results */}
                        {aniResults.length > 0 && (
                          <div className="flex flex-col gap-8">
                            {aniResults.map(r => (
                              <div
                                key={r.anilist_id}
                                className="flex gap-12 items-center"
                                style={{
                                  background: "var(--bg)", borderRadius: "var(--radius)",
                                  padding: "10px 12px", border: "1px solid var(--border)"
                                }}
                              >
                                {r.cover_image_medium && (
                                  <img src={r.cover_image_medium} alt="" style={{ width: 32, height: 46, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                                    {r.title_english || r.title_romaji}
                                  </div>
                                  <div style={{ fontSize: "0.7rem", color: "var(--text2)", fontFamily: "var(--font-mono)" }}>
                                    {r.season_year} · {r.format} · {r.episodes || "?"} eps
                                    {r.average_score ? ` · ★ ${(r.average_score / 10).toFixed(1)}` : ""}
                                  </div>
                                  <div className="flex gap-4 mt-4" style={{ flexWrap: "wrap" }}>
                                    {r.genres?.slice(0, 3).map(g => (
                                      <span key={g} className="genre-chip">{g}</span>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => linkAndRefresh(a.id, r.anilist_id)}
                                  style={{ flexShrink: 0 }}
                                >
                                  Link
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignments.length === 0 && query && !searching && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div className="text-muted">No assignments found. Try a different search.</div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────
export default function Admin() {
  const [seasons, setSeasons] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSeason, setActiveSeason] = useState(null);
  const [tab, setTab] = useState("seasons");

  function load() {
    Promise.all([
      fetch(`${API}/seasons`).then(r => r.json()),
      fetch(`${API}/members`).then(r => r.json()),
    ]).then(([s, m]) => {
      setSeasons(s);
      setMembers(m);
      setActiveSeason(s.find(x => x.is_active) || s[0] || null);
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading">Loading admin...</div>;

  const tabs = [
    { id: "seasons", label: "Edit Seasons" },
    { id: "entries", label: "Edit Entries" },
    { id: "rolls", label: "Add Historical Rolls" },
    { id: "anilist", label: "AniList Refresh" },
  ];

  return (
    <div>
      <div className="section-header mb-24">
        <h1>Admin</h1>
        <span className="badge badge-dropped" style={{ fontSize: "0.7rem" }}>Local only</span>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "seasons" && (
        <div className="card">
          <h2 className="mb-8">Seasons</h2>
          <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
            Edit names, dates, and active status. Only one season should be active at a time.
          </div>
          {seasons.map(s => (
            <SeasonEditor key={s.id} season={s} members={members} onSaved={load} />
          ))}
        </div>
      )}

      {tab === "entries" && (
        <EntryEditor members={members} seasons={seasons} />
      )}

      {tab === "rolls" && (
        <div>
          <div className="card">
            <h2 className="mb-8">Add Historical Rolls</h2>
            <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
              Manually enter rolls from older seasons. Rolls are created without a derangement.
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 6 }}>
                Target Season
              </label>
              <select
                value={activeSeason?.id || ""}
                onChange={e => setActiveSeason(seasons.find(s => String(s.id) === e.target.value))}
                style={{ width: 240 }}
              >
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {activeSeason && (
            <ManualRollBuilder season={activeSeason} members={members} onRollAdded={load} />
          )}
        </div>
      )}

      {tab === "anilist" && (
        <BulkRefresh seasons={seasons} />
      )}
    </div>
  );
}