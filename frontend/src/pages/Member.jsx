import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export default function Member() {
  const { id } = useParams();
  const [assignments, setAssignments] = useState([]);
  const [assignedShows, setAssignedShows] = useState([]);
  const [member, setMember] = useState(null);
  const [anilistProfile, setAnilistProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 1 });

  function toggleSort(key) {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key ? -prev.dir : 1,
    }));
  }

  useEffect(() => {
    Promise.all([
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/assignments?member_id=${id}`, { credentials: "include" }).then(async r => r.json()),
      fetch(`${API}/assignments?assigner_id=${id}`, { credentials: "include" }).then(r => r.json()),
    ]).then(([members, assigns, assigned]) => {
      const found = members.find(m => String(m.id) === String(id));
      setMember(found);
      setAssignments(Array.isArray(assigns) ? assigns : []);
      setAssignedShows(Array.isArray(assigned) ? assigned : []);
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
          credentials: "include",
        })
          .then(r => r.json())
          .then(d => setAnilistProfile(d.data?.User))
          .catch(() => {});
      }
    });
  }, [id]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!member) return <div className="loading">Member not found.</div>;

  const watchedByMember = assignments.filter(a => a.rating != null);

  const avg = watchedByMember.length
    ? watchedByMember.reduce((s, a) => s + Number(a.rating), 0) / watchedByMember.length
    : null;

  const ratedAssignedShows = assignedShows.filter(a => a.rating != null);

  const assignedByAvg = ratedAssignedShows.length
    ? ratedAssignedShows.reduce((s, a) => s + Number(a.rating), 0) / ratedAssignedShows.length
    : null;

  const sortedAssignments = [...assignments].sort((a, b) => {
    if (!sortConfig.key) return 0;

    const av = a[sortConfig.key] ?? -Infinity;
    const bv = b[sortConfig.key] ?? -Infinity;

    return av < bv ? -sortConfig.dir : av > bv ? sortConfig.dir : 0;
  });

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
        <div style={{ marginLeft: "auto", display: "flex", gap: 24, textAlign: "right" }}>
          <div>
            <div className="stat-value">{avg != null ? avg.toFixed(2) : "—"}</div>
            <div className="stat-label">Avg Watched</div>
          </div>

          <div>
            <div className="stat-value">{assignedByAvg != null ? assignedByAvg.toFixed(2) : "—"}</div>
            <div className="stat-label">Avg Assigned</div>
          </div>
        </div>
      </div>

      <h2 className="mb-16">Assignment History ({assignments.length})</h2>
      <div className="card" style={{ overflowY: "auto", maxHeight: "600px" }}>
        <table className="data-table assignments-sticky">
          <thead>
            <tr>
              {[
                { label: "Anime", key: "anime_title" },
                { label: "Assigned by", key: "assigner_name" },
                { label: "Season / Roll", key: "roll_number" },
                { label: "Rating", key: "rating" },
                { label: "Episodes", key: "episodes_watched" },
                { label: "Status", key: "status" },
              ].map(({ label, key }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  {label}
                  {sortConfig.key === key ? (sortConfig.dir === 1 ? " ▲" : " ▼") : " ↕"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedAssignments.map(a => {
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
                        {aniData?.siteUrl ? (
                          <a
                            href={aniData.siteUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontWeight: 500,
                              fontSize: "0.875rem",
                              color: "var(--accent)",
                              textDecoration: "none"
                            }}
                          >
                            {a.anime_title}
                          </a>
                        ) : (
                          <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                            {a.anime_title}
                          </div>
                        )}
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