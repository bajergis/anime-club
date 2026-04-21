import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export default function Member() {
  const { id } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [member, setMember] = useState(null);
  const [anilistProfile, setAnilistProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/members`).then(r => r.json()),
      fetch(`${API}/assignments?member_id=${id}`).then(r => r.json()),
    ]).then(([members, assigns]) => {
      // fix: parseInt so string id from useParams matches numeric db id
      const found = members.find(m => m.id === id);
      setMember(found);
      setAssignments(assigns);
      setLoading(false);

      if (found?.anilist_username) {
        fetch(`${API}/anime/anilist-proxy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query($name: String) {
              User(name: $name) {
                avatar { large }
                siteUrl
              }
            }`,
            variables: { name: found.anilist_username },
          }),
        })
          .then(r => r.json())
          .then(d => setAnilistProfile(d.data?.User))
          .catch(() => {}); // silently fail — fallback to initial
      }
    });
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!member) return <div className="loading">Member not found.</div>;

  const rated = assignments.filter(a => a.rating != null);
  const avg = rated.length ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : null;

  return (
    <div>
      <div className="card mb-24" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {anilistProfile?.avatar?.large ? (
          <img
            src={anilistProfile.avatar.large}
            alt={member.name}
            style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div className="avatar avatar-lg">{member.name?.charAt(0)}</div>
        )}
        <div>
          <h1>{member.name}</h1>
          {member.anilist_username && (
            <a
              href={`https://anilist.co/user/${member.anilist_username}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent2)", fontSize: "0.8rem" }}
            >
              @{member.anilist_username} ↗
            </a>
          )}
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="stat-value">{avg ? avg.toFixed(2) : "—"}</div>
          <div className="stat-label">Average Rating</div>
        </div>
      </div>

      <h2 className="mb-16">Assignment History ({assignments.length})</h2>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Anime</th>
              <th>Assigned by</th>
              <th>Season / Roll</th>
              <th>Rating</th>
              <th>Episodes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => {
              const aniData = a.anilist_data
                ? (() => { try { return JSON.parse(a.anilist_data); } catch { return null; } })()
                : null;
              return (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {aniData?.cover_image_medium && (
                        <img
                          src={aniData.cover_image_medium}
                          alt=""
                          style={{ width: 28, height: 40, objectFit: "cover", borderRadius: 3 }}
                        />
                      )}
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{a.anime_title}</div>
                        {aniData?.genres?.slice(0, 2).map(g => (
                          <span key={g} className="genre-chip" style={{ marginRight: 3 }}>{g}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--accent)" }}>{a.assigner_name}</td>
                  <td className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    {a.season_name} · #{a.roll_number}
                  </td>
                  <td style={{
                    fontFamily: "var(--font-mono)",
                    color: a.rating >= 8
                      ? "var(--green)"
                      : a.rating >= 6
                      ? "var(--text)"
                      : a.rating
                      ? "var(--red)"
                      : "var(--text2)"
                  }}>
                    {a.rating ?? "—"}
                  </td>
                  <td className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    {a.episodes_watched != null ? `${a.episodes_watched}/${a.total_episodes || "?"}` : "—"}
                  </td>
                  <td>
                    <span className={`badge badge-${a.status || "pending"}`}>{a.status || "pending"}</span>
                  </td>
                </tr>
              );
            })}
            {!assignments.length && (
              <tr>
                <td colSpan={6} className="text-muted" style={{ textAlign: "center" }}>No assignments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}