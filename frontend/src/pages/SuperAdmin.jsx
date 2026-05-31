import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const AUTH = API.replace("/api", "");

const ADMIN_IDS = (import.meta.env.VITE_ADMIN_USER_IDS || "").split(",").map(s => s.trim());

// ── Group Row ─────────────────────────────────────────────────
function GroupRow({ group, allGroups, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [banReason, setBanReason] = useState({});
  const [reassignTarget, setReassignTarget] = useState({});
  const [working, setWorking] = useState({});
  const [msg, setMsg] = useState({});

  async function loadDetail() {
    if (detail) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    const data = await fetch(`${AUTH}/api/superadmin/groups/${group.id}`, { credentials: "include" }).then(r => r.json());
    setDetail(data);
    setLoading(false);
  }

  async function ban(userId) {
    setWorking(w => ({ ...w, [userId]: true }));
    await fetch(`${AUTH}/api/superadmin/users/${userId}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: banReason[userId] || null }),
      credentials: "include",
    });
    setWorking(w => ({ ...w, [userId]: false }));
    setMsg(m => ({ ...m, [userId]: "Banned ✓" }));
    setTimeout(() => setMsg(m => { const n = { ...m }; delete n[userId]; return n; }), 3000);
    // Reload detail
    const data = await fetch(`${AUTH}/api/superadmin/groups/${group.id}`, { credentials: "include" }).then(r => r.json());
    setDetail(data);
    onRefresh();
  }

  async function unban(userId) {
    setWorking(w => ({ ...w, [userId]: true }));
    await fetch(`${AUTH}/api/superadmin/users/${userId}/ban`, { method: "DELETE", credentials: "include" });
    setWorking(w => ({ ...w, [userId]: false }));
    setMsg(m => ({ ...m, [userId]: "Unbanned ✓" }));
    setTimeout(() => setMsg(m => { const n = { ...m }; delete n[userId]; return n; }), 3000);
    const data = await fetch(`${AUTH}/api/superadmin/groups/${group.id}`, { credentials: "include" }).then(r => r.json());
    setDetail(data);
    onRefresh();
  }

  async function reassign(memberId, userId) {
    const target = reassignTarget[memberId];
    if (!target) return;
    if (!confirm(`Move this member to group ${target}? Their assignment history stays.`)) return;
    setWorking(w => ({ ...w, [memberId]: true }));
    const res = await fetch(`${AUTH}/api/superadmin/members/${memberId}/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_group_id: target }),
      credentials: "include",
    }).then(r => r.json());
    setWorking(w => ({ ...w, [memberId]: false }));
    if (res.error) return setMsg(m => ({ ...m, [memberId]: `Error: ${res.error}` }));
    setMsg(m => ({ ...m, [memberId]: "Moved ✓" }));
    setTimeout(() => setMsg(m => { const n = { ...m }; delete n[memberId]; return n; }), 3000);
    const data = await fetch(`${AUTH}/api/superadmin/groups/${group.id}`, { credentials: "include" }).then(r => r.json());
    setDetail(data);
    onRefresh();
  }

  const otherGroups = allGroups.filter(g => g.id !== group.id);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 8 }}>
      {/* Group header */}
      <div
        onClick={loadDetail}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", cursor: "pointer",
          borderBottom: open ? "1px solid var(--border)" : "none",
          background: open ? "var(--bg3)" : "transparent",
        }}
      >
        <div className="flex items-center gap-16">
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{group.name}</div>
          <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
            #{group.id}
          </div>
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
            owner: <span style={{ color: "var(--accent)" }}>{group.owner_username}</span>
            {group.owner_banned_at && <span style={{ color: "var(--red)", marginLeft: 6 }}>⚠ banned</span>}
          </div>
        </div>
        <div className="flex items-center gap-16">
          <span className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
            {group.member_count} members · {group.season_count} seasons
          </span>
          <div style={{ color: "var(--text2)", transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none" }}>›</div>
        </div>
      </div>

      {/* Group detail */}
      {open && (
        <div style={{ padding: "16px 20px" }}>
          {loading && <div className="text-muted" style={{ fontSize: "0.85rem" }}>Loading...</div>}
          {detail && (
            <div className="flex flex-col gap-8">
              {detail.members.map(m => (
                <div key={m.member_id} style={{
                  padding: "12px 16px", borderRadius: "var(--radius)",
                  background: "var(--bg3)", border: `1px solid ${m.banned_at ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    {/* Avatar */}
                    {m.avatar_url
                      ? <img src={m.avatar_url} alt={m.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                      : <div className="avatar" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>{m.name?.charAt(0)}</div>
                    }

                    {/* Name + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8 }}>
                        {m.name}
                        {m.banned_at && (
                          <span style={{
                            fontSize: "0.65rem", color: "var(--red)",
                            border: "1px solid rgba(248,113,113,0.4)", borderRadius: 4, padding: "1px 5px",
                          }}>BANNED</span>
                        )}
                        {detail.owner_id === m.user_id && (
                          <span style={{
                            fontSize: "0.65rem", color: "var(--gold)",
                            border: "1px solid rgba(251,191,36,0.3)", borderRadius: 4, padding: "1px 5px",
                          }}>owner</span>
                        )}
                      </div>
                      <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                        @{m.anilist_username}
                        {m.user_id && <span style={{ marginLeft: 8, color: "var(--text2)" }}>{m.user_id}</span>}
                        <span style={{ marginLeft: 8 }}>{m.assignment_count} assignments</span>
                      </div>
                      {m.banned_at && m.ban_reason && (
                        <div style={{ fontSize: "0.7rem", color: "var(--red)", marginTop: 2 }}>
                          Reason: {m.ban_reason}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-8 items-center" style={{ flexWrap: "wrap" }}>
                      {msg[m.user_id] && (
                        <span style={{ fontSize: "0.72rem", color: msg[m.user_id].startsWith("Error") ? "var(--red)" : "var(--green)" }}>
                          {msg[m.user_id]}
                        </span>
                      )}
                      {msg[m.member_id] && (
                        <span style={{ fontSize: "0.72rem", color: msg[m.member_id].startsWith("Error") ? "var(--red)" : "var(--green)" }}>
                          {msg[m.member_id]}
                        </span>
                      )}

                      {/* Ban/unban */}
                      {m.user_id && (
                        m.banned_at ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => unban(m.user_id)}
                            disabled={working[m.user_id]}
                            style={{ color: "var(--green)", borderColor: "rgba(100,200,100,0.3)" }}
                          >
                            {working[m.user_id] ? "..." : "Unban"}
                          </button>
                        ) : (
                          <div className="flex gap-6 items-center">
                            <input
                              value={banReason[m.user_id] || ""}
                              onChange={e => setBanReason(r => ({ ...r, [m.user_id]: e.target.value }))}
                              placeholder="Ban reason (optional)"
                              style={{ width: 180, fontSize: "0.75rem", padding: "4px 8px" }}
                            />
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => ban(m.user_id)}
                              disabled={working[m.user_id]}
                              style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)" }}
                            >
                              {working[m.user_id] ? "..." : "Ban"}
                            </button>
                          </div>
                        )
                      )}

                      {/* Reassign */}
                      {otherGroups.length > 0 && (
                        <div className="flex gap-6 items-center">
                          <select
                            value={reassignTarget[m.member_id] || ""}
                            onChange={e => setReassignTarget(r => ({ ...r, [m.member_id]: e.target.value }))}
                            style={{ fontSize: "0.72rem", padding: "4px 6px" }}
                          >
                            <option value="">Move to group...</option>
                            {otherGroups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => reassign(m.member_id, m.user_id)}
                            disabled={working[m.member_id] || !reassignTarget[m.member_id]}
                            style={{ fontSize: "0.72rem" }}
                          >
                            {working[m.member_id] ? "..." : "Move"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!detail.members.length && (
                <div className="text-muted" style={{ fontSize: "0.85rem" }}>No members in this group.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main SuperAdmin Page ──────────────────────────────────────
export default function SuperAdmin() {
  const { member } = useAuth();
  const [groups, setGroups] = useState([]);
  const [ungrouped, setUngrouped] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isAdmin = member?.user_id && ADMIN_IDS.includes(member.user_id);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);  // ← moved above early return

  if (!isAdmin) return <Navigate to="/" replace />;

  async function load() {
    const [g, s, u] = await Promise.all([
      fetch(`${AUTH}/api/superadmin/groups`, { credentials: "include" }).then(r => r.json()),
      fetch(`${AUTH}/api/superadmin/stats`, { credentials: "include" }).then(r => r.json()),
      fetch(`${AUTH}/api/superadmin/users`, { credentials: "include" }).then(r => r.json()),
    ]);
    setGroups(Array.isArray(g) ? g : []);
    setStats(s);
    setUngrouped((Array.isArray(u) ? u : []).filter(x => !x.group_id));
    setLoading(false);
  }

  if (loading) return <div className="loading">Loading...</div>;

  const filtered = groups.filter(g =>
    !search.trim() ||
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.owner_username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="section-header mb-24">
        <div>
          <h1>Site Admin</h1>
          <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
            Visible only to you
          </div>
        </div>
      </div>

      {/* Site-wide stats */}
      {stats && (
        <div className="card mb-24">
          <div className="grid-4">
            <div className="stat">
              <div className="stat-value">{stats.total_users}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat">
              <div className="stat-value" style={{ color: "var(--red)" }}>{stats.banned_users}</div>
              <div className="stat-label">Banned</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.total_groups}</div>
              <div className="stat-label">Groups</div>
            </div>
            <div className="stat">
              <div className="stat-value">{stats.total_assignments}</div>
              <div className="stat-label">Assignments</div>
            </div>
          </div>
        </div>
      )}

      {/* Group list */}
      <div className="section-header mb-16">
        <h2>Groups ({groups.length})</h2>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or owner..."
          style={{ width: 240, fontSize: "0.8rem" }}
        />
      </div>

      <div className="flex flex-col gap-0">
        {filtered.map(g => (
          <GroupRow key={g.id} group={g} allGroups={groups} onRefresh={load} />
        ))}
        {!filtered.length && (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <div className="text-muted">No groups found.</div>
          </div>
        )}
      </div>

      {ungrouped.length > 0 && (
        <>
          <div className="section-header mb-16" style={{ marginTop: 32 }}>
            <h2>Ungrouped Users ({ungrouped.length})</h2>
          </div>
          <div className="card">
            <div className="flex flex-col gap-8">
              {ungrouped.map(u => (
                <div key={u.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", background: "var(--bg3)",
                  borderRadius: "var(--radius)", border: `1px solid ${u.banned_at ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
                }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.username} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                    : <div className="avatar" style={{ width: 32, height: 32, fontSize: "0.7rem" }}>{u.username?.charAt(0)}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 8 }}>
                      {u.username}
                      {u.banned_at && (
                        <span style={{ fontSize: "0.65rem", color: "var(--red)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 4, padding: "1px 5px" }}>BANNED</span>
                      )}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                      {u.id} · joined {new Date(u.created_at).toLocaleDateString()}
                    </div>
                    {u.banned_at && u.ban_reason && (
                      <div style={{ fontSize: "0.7rem", color: "var(--red)", marginTop: 2 }}>Reason: {u.ban_reason}</div>
                    )}
                  </div>
                  <div className="flex gap-8 items-center">
                    {u.banned_at ? (
                      <button className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          await fetch(`${AUTH}/api/superadmin/users/${u.id}/ban`, { method: "DELETE", credentials: "include" });
                          load();
                        }}
                        style={{ color: "var(--green)", borderColor: "rgba(100,200,100,0.3)" }}>
                        Unban
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          await fetch(`${AUTH}/api/superadmin/users/${u.id}/ban`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ reason: "" }),
                            credentials: "include",
                          });
                          load();
                        }}
                        style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)" }}>
                        Ban
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}