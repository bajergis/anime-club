import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { Navigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const AUTH = API.replace("/api", "");

export default function GroupManage() {
  const { member } = useAuth();
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [inviteExpiry, setInviteExpiry] = useState(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isOwner = member?.owner_id === member?.user_id || String(member?.owner_id) === String(member?.id);

  useEffect(() => {
    if (!member?.group_id) return;
    load();
  }, [member]);

  async function load() {
    setLoading(true);
    const [mems, reqs] = await Promise.all([
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
      isOwner
        ? fetch(`${AUTH}/api/groups/${member.group_id}/requests`, { credentials: "include" }).then(r => r.json())
        : Promise.resolve([]),
    ]);
    setMembers(Array.isArray(mems) ? mems : []);
    setRequests(Array.isArray(reqs) ? reqs : []);
    setLoading(false);
  }

  async function generateInvite() {
    setGeneratingInvite(true);
    const res = await fetch(`${AUTH}/api/groups/${member.group_id}/invite`, {
      method: "POST",
      credentials: "include",
    }).then(r => r.json());
    setGeneratingInvite(false);
    if (res.error) return setError(res.error);
    setInviteUrl(res.invite_url);
    setInviteExpiry(res.expires_at);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRequest(userId, action) {
    const res = await fetch(`${AUTH}/api/groups/${member.group_id}/requests/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
      credentials: "include",
    }).then(r => r.json());
    if (res.error) return setError(res.error);
    setRequests(prev => prev.filter(r => r.user_id !== userId));
    if (action === "accept") load(); // reload members list
  }

  async function removeMember(memberId) {
    if (!confirm(`Remove this member from the group?`)) return;
    const res = await fetch(`${AUTH}/api/groups/${member.group_id}/members/${memberId}`, {
      method: "DELETE",
      credentials: "include",
    }).then(r => r.json());
    if (res.error) return setError(res.error);
    setMembers(prev => prev.filter(m => m.id !== memberId));
  }

  if (!member) return <Navigate to="/login" replace />;
  if (loading) return <div className="loading">Loading group...</div>;

  return (
    <div>
      <div className="section-header mb-24">
        <div>
          <h1>{member.group_name}</h1>
          <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginTop: 4 }}>
            {members.length} members
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
          borderRadius: "var(--radius)", padding: "10px 16px", marginBottom: 16,
          fontSize: "0.85rem", color: "var(--red)",
        }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* ── Members list ─────────────────────────────────── */}
      <div className="card mb-24">
        <h2 className="mb-16">Members</h2>
        <div className="flex flex-col gap-8">
          {members.map(m => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", background: "var(--bg3)",
              borderRadius: "var(--radius)", border: "1px solid var(--border)",
            }}>
              {m.avatar_url
                ? <img src={m.avatar_url} alt={m.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div className="avatar">{m.name?.charAt(0)}</div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{m.name}</div>
                {m.anilist_username && (
                  <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                    @{m.anilist_username}
                  </div>
                )}
              </div>
              {m.user_id === member.owner_id && (
                <span style={{
                  fontSize: "0.68rem", fontFamily: "var(--font-mono)",
                  color: "var(--gold)", border: "1px solid rgba(251,191,36,0.3)",
                  borderRadius: 4, padding: "2px 6px",
                }}>owner</span>
              )}
              {isOwner && m.id !== member.id && m.user_id !== member.owner_id && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeMember(m.id)}
                  style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)", fontSize: "0.72rem" }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Join requests (owner only) ────────────────────── */}
      {isOwner && (
        <div className="card mb-24">
          <h2 className="mb-16">
            Join Requests
            {requests.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: "0.72rem", fontFamily: "var(--font-mono)",
                background: "rgba(192,132,252,0.15)", color: "var(--accent)",
                border: "1px solid rgba(192,132,252,0.3)", borderRadius: 99,
                padding: "1px 7px",
              }}>{requests.length}</span>
            )}
          </h2>
          {requests.length === 0 ? (
            <div className="text-muted" style={{ fontSize: "0.85rem" }}>No pending requests.</div>
          ) : (
            <div className="flex flex-col gap-8">
              {requests.map(r => (
                <div key={r.user_id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", background: "var(--bg3)",
                  borderRadius: "var(--radius)", border: "1px solid var(--border)",
                }}>
                  {r.avatar_url
                    ? <img src={r.avatar_url} alt={r.anilist_username} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <div className="avatar">{r.anilist_username?.charAt(0)}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.anilist_username}</div>
                    <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                      requested {new Date(r.requested_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleRequest(r.user_id, "accept")}
                    >
                      Accept
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleRequest(r.user_id, "reject")}
                      style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)" }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Invite link (owner only) ──────────────────────── */}
      {isOwner && (
        <div className="card">
          <h2 className="mb-8">Invite Link</h2>
          <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
            Generate a one-time invite link. It expires after 48 hours.
          </div>
          {inviteUrl ? (
            <div>
              <div style={{
                display: "flex", gap: 8, alignItems: "center",
                background: "var(--bg3)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 8,
              }}>
                <div style={{
                  flex: 1, fontSize: "0.78rem", fontFamily: "var(--font-mono)",
                  color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {inviteUrl}
                </div>
                <button className="btn btn-primary btn-sm" onClick={copyInvite}>
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                expires {new Date(inviteExpiry).toLocaleString()}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={generateInvite}
                style={{ marginTop: 12 }}
                disabled={generatingInvite}
              >
                Generate new link
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={generateInvite}
              disabled={generatingInvite}
            >
              {generatingInvite ? "Generating..." : "Generate Invite Link"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}