import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function TasteLabel({ offset }) {
  if (offset == null) return <span className="text-muted">—</span>;
  const label = offset > 1 ? "Generous" : offset < -1 ? "Harsh" : "On-trend";
  const color = offset > 1 ? "var(--green)" : offset < -1 ? "var(--red)" : "var(--text2)";
  return (
    <span style={{ color, fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
      {offset > 0 ? "+" : ""}{offset.toFixed(2)} ({label})
    </span>
  );
}

function HeadToHeadMatrix({ data, members }) {
  if (!data.length || !members.length) return null;

  const memberIds = members.map(m => m.id);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Assigner ↓ / Assignee →</th>
            {members.map(m => <th key={m.id}>{m.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {members.map(assigner => (
            <tr key={assigner.id}>
              <td style={{ color: "var(--text)", fontWeight: 500 }}>{assigner.name}</td>
              {members.map(assignee => {
                if (assigner.id === assignee.id) {
                  return <td key={assignee.id} style={{ background: "var(--bg3)", color: "var(--border)", textAlign: "center" }}>—</td>;
                }
                const cell = data.find(d => d.assigner_id === assigner.id && d.assignee_id === assignee.id);
                if (!cell) return <td key={assignee.id} className="text-muted" style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>—</td>;
                const hue = cell.avg_rating >= 8 ? "var(--green)" : cell.avg_rating >= 6 ? "var(--accent2)" : "var(--red)";
                return (
                  <td key={assignee.id} style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: hue }}>
                    {cell.avg_rating.toFixed(1)}
                    <div style={{ fontSize: "0.65rem", color: "var(--text2)" }}>×{cell.count}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted mt-8" style={{ fontSize: "0.7rem" }}>
        Each cell = avg rating the assignee gave to shows picked by the assigner.
      </div>
    </div>
  );
}

export default function Stats() {
  const [memberStats, setMemberStats] = useState([]);
  const [h2h, setH2h] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  const [avatars, setAvatars] = useState({});

  useEffect(() => {
    Promise.all([
      fetch(`${API}/stats/members`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/stats/head-to-head`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
    ]).then(async ([ms, h, mems]) => {
      setMemberStats(ms);
      setH2h(h);
      setMembers(mems);

      const avatarMap = {};

      await Promise.all(
        mems
          .filter(m => m.anilist_username)
          .map(m =>
            fetch(`${API}/anime/anilist-proxy`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                query: `query($name: String) { User(name: $name) { avatar { large } } }`,
                variables: { name: m.anilist_username },
              }),
              credentials: "include",
            })
              .then(r => r.json())
              .then(d => {
                avatarMap[m.id] = d.data?.User?.avatar?.large;
              })
              .catch(() => {})
          )
      );

      setAvatars(avatarMap);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Crunching numbers...</div>;

  const tabs = [
    { id: "members", label: "Per Member" },
    { id: "h2h", label: "Head-to-Head" },
  ];

  return (
    <div>
      <div className="section-header mb-24">
        <h1>Stats</h1>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <div className="flex flex-col gap-16">
          {memberStats.map(m => (
            <div key={m.id} className="card">
              <div className="flex items-center justify-between mb-16">
                <div className="flex items-center gap-8">
                  {avatars[m.id] ? (
                    <img
                      src={avatars[m.id]}
                      alt={m.name}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        objectFit: "cover"
                      }}
                    />
                  ) : (
                    <div className="avatar avatar-lg">{m.name?.charAt(0)}</div>
                  )}
                  <div>
                    <h2>{m.name}</h2>
                    {m.anilist_username && <div className="text-muted" style={{ fontSize: "0.75rem" }}>@{m.anilist_username}</div>}
                  </div>
                </div>
                <div className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  Taste vs AniList: <TasteLabel offset={m.taste_offset_vs_anilist} />
                </div>
              </div>

              <div className="grid-4" style={{ marginBottom: 16 }}>
                <div className="stat">
                  <div className="stat-value">{m.avg_rating_given ? m.avg_rating_given.toFixed(2) : "—"}</div>
                  <div className="stat-label">Avg Rating</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{m.received_count || 0}</div>
                  <div className="stat-label">Shows Watched</div>
                </div>
                <div className="stat">
                  <div className="stat-value" style={{ color: "var(--green)" }}>{m.max_rating || "—"}</div>
                  <div className="stat-label">Highest</div>
                </div>
                <div className="stat">
                  <div className="stat-value" style={{ color: "var(--red)" }}>{m.min_rating || "—"}</div>
                  <div className="stat-label">Lowest</div>
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <h3 className="mb-8">Best Received</h3>
                  {m.best_received ? (
                    <div style={{ fontSize: "0.875rem" }}>
                      <span className="text-accent">{m.best_received.anime_title}</span>
                      <span className="text-muted"> — {m.best_received.rating}/10</span>
                    </div>
                  ) : <span className="text-muted" style={{ fontSize: "0.8rem" }}>No data</span>}
                  <div className="mt-8">
                    <h3 className="mb-8">Worst Received</h3>
                    {m.worst_received ? (
                      <div style={{ fontSize: "0.875rem" }}>
                        <span style={{ color: "var(--red)" }}>{m.worst_received.anime_title}</span>
                        <span className="text-muted"> — {m.worst_received.rating}/10</span>
                      </div>
                    ) : <span className="text-muted" style={{ fontSize: "0.8rem" }}>No data</span>}
                  </div>
                </div>

                <div>
                  <h3 className="mb-8">Top Genres</h3>
                  <div className="flex" style={{ flexWrap: "wrap", gap: 4 }}>
                    {m.top_genres?.length ? m.top_genres.map(g => (
                      <span key={g.genre} className="genre-chip">{g.genre} ({g.count})</span>
                    )) : <span className="text-muted" style={{ fontSize: "0.8rem" }}>—</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "h2h" && (
        <div className="card">
          <h2 className="mb-16">Assigner → Assignee Rating Matrix</h2>
          <HeadToHeadMatrix data={h2h} members={members} />
        </div>
      )}
    </div>
  );
}
