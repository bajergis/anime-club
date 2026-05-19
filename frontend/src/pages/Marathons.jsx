import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00')).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

export default function Marathons() {
  const { member } = useAuth();
  const [marathons, setMarathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", started_at: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isOwner = !!member?.owner_id && member.owner_id === member.user_id;

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await fetch(`${API}/marathons`, { credentials: "include" }).then(r => r.json());
    setMarathons(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function create() {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await fetch(`${API}/marathons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
      credentials: "include",
    }).then(r => r.json());
    setSaving(false);
    if (res.error) return setError(res.error);
    setForm({ name: "", description: "", started_at: "" });
    setCreating(false);
    load();
  }

  async function markComplete(id) {
    await fetch(`${API}/marathons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", ended_at: new Date().toISOString().split('T')[0] }),
      credentials: "include",
    });
    load();
  }

  async function deleteMarathon(id) {
    if (!confirm("Delete this marathon and all its entries?")) return;
    await fetch(`${API}/marathons/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  if (loading) return <div className="loading">Loading marathons...</div>;

  const active = marathons.filter(m => m.status === "active");
  const completed = marathons.filter(m => m.status === "completed");

  return (
    <div>
      <div className="section-header mb-24">
        <div>
          <h1>Marathons</h1>
          <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
            Themed watch-alongs tracked as a group
          </div>
        </div>
        {isOwner && (
          <button className="btn btn-primary" onClick={() => setCreating(c => !c)}>
            {creating ? "Cancel" : "+ New Marathon"}
          </button>
        )}
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

      {creating && (
        <div className="card mb-24">
          <h2 className="mb-16">New Marathon</h2>
          <div className="flex flex-col gap-12">
            <div>
              <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>
                Name <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && create()}
                placeholder="e.g. Ghibli Marathon, Makoto Shinkai Films..."
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="A short note about the theme or goal"
              />
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", color: "var(--text2)", display: "block", marginBottom: 4 }}>Start Date (optional)</label>
              <input
                type="date"
                value={form.started_at}
                onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))}
                style={{ width: 200 }}
              />
            </div>
            <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={saving || !form.name.trim()}>
                {saving ? "Creating..." : "Create Marathon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <>
          <div className="section-header mb-16">
            <h2>Active</h2>
            <span className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>{active.length}</span>
          </div>
          <div className="flex flex-col gap-8 mb-24">
            {active.map(m => (
              <MarathonCard key={m.id} marathon={m} isOwner={isOwner}
                onComplete={() => markComplete(m.id)} onDelete={() => deleteMarathon(m.id)} />
            ))}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <div className="section-header mb-16">
            <h2>Completed</h2>
            <span className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>{completed.length}</span>
          </div>
          <div className="flex flex-col gap-8">
            {completed.map(m => (
              <MarathonCard key={m.id} marathon={m} isOwner={isOwner} onDelete={() => deleteMarathon(m.id)} />
            ))}
          </div>
        </>
      )}

      {marathons.length === 0 && !creating && (
        <div className="card" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🎬</div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>No marathons yet</div>
          <div className="text-muted" style={{ fontSize: "0.85rem" }}>
            {isOwner ? "Create one to start tracking themed watch-alongs." : "The group owner hasn't created any marathons yet."}
          </div>
        </div>
      )}
    </div>
  );
}

function MarathonCard({ marathon, isOwner, onComplete, onDelete }) {
  const progress = marathon.entry_count > 0
    ? Math.round((marathon.done_count / marathon.entry_count) * 100)
    : 0;

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          width: 4, alignSelf: "stretch", flexShrink: 0,
          background: marathon.status === "completed" ? "var(--green)"
            : marathon.has_active ? "var(--accent)" : "var(--border)",
        }} />
        <div style={{ flex: 1, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <Link to={`/marathon/${marathon.id}`} style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", textDecoration: "none" }}>
                  {marathon.name}
                </Link>
                {marathon.status === "completed" && <span className="badge badge-completed">completed</span>}
                {marathon.has_active > 0 && <span className="badge badge-watching">watching now</span>}
              </div>
              {marathon.description && (
                <div className="text-muted" style={{ fontSize: "0.8rem", marginBottom: 6 }}>{marathon.description}</div>
              )}
              {/* Dates */}
              <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
                {marathon.started_at && <>Started {fmt(marathon.started_at)}</>}
                {marathon.started_at && marathon.ended_at && <span> → </span>}
                {marathon.ended_at && <>Ended {fmt(marathon.ended_at)}</>}
              </div>
              <div className="flex items-center gap-16">
                <span className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                  {marathon.done_count}/{marathon.entry_count} entries done
                </span>
                {marathon.entry_count > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, maxWidth: 200 }}>
                    <div className="rating-track" style={{ flex: 1 }}>
                      <div className="rating-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", flexShrink: 0 }}>{progress}%</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-8 items-center" style={{ flexShrink: 0 }}>
              <Link to={`/marathon/${marathon.id}`} className="btn btn-ghost btn-sm">View →</Link>
              {isOwner && marathon.status === "active" && onComplete && (
                <button className="btn btn-ghost btn-sm" onClick={onComplete}
                  style={{ color: "var(--green)", borderColor: "rgba(100,200,100,0.3)" }}>
                  Mark Done
                </button>
              )}
              {isOwner && (
                <button className="btn btn-ghost btn-sm" onClick={onDelete}
                  style={{ color: "var(--red)", borderColor: "rgba(248,113,113,0.3)" }}>
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}