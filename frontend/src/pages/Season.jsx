import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

function StatusBadge({ status }) {
  return <span className={`badge badge-${status || "pending"}`}>{status || "pending"}</span>;
}

export default function Season() {
  const { id } = useParams();
  const [stats, setStats] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/stats/season/${id}`).then(r => r.json()),
      fetch(`${API}/assignments?season_id=${id}`).then(r => r.json()),
    ]).then(([s, a]) => { setStats(s); setAssignments(a); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading">Loading season...</div>;
  if (!stats?.season) return <div className="loading">Season not found.</div>;

  const { season, rollStats, memberBreakdown, top_genres } = stats;

  return (
    <div>
      <div className="season-banner" data-season={`S${id}`}>
        <h1>{season.name}</h1>
        <div className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
          {season.started_at} {season.ended_at ? `→ ${season.ended_at}` : "→ ongoing"}
        </div>
      </div>

      {/* Roll history */}
      <div className="section-header">
        <h2>Rolls</h2>
      </div>
      <div className="card mb-24">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll #</th>
              <th>Date</th>
              <th>Shows</th>
              <th>Avg Rating</th>
              <th>High / Low</th>
            </tr>
          </thead>
          <tbody>
            {rollStats.map(r => (
              <tr key={r.roll_number} style={{ cursor: "pointer" }}>
                <td className="text-mono text-accent">
                  <Link to={`/roll/${r.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                    #{r.roll_number}
                  </Link>
                </td>
                <td className="text-muted" style={{ fontSize: "0.8rem" }}>{r.roll_date}</td>
                <td>{r.assignment_count}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                  {r.avg_rating ? r.avg_rating.toFixed(2) : "—"}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--green)" }}>{r.max_rating || "—"}</span>
                  {" / "}
                  <span style={{ color: "var(--red)" }}>{r.min_rating || "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Member breakdown */}
      <div className="section-header">
        <h2>Member Breakdown</h2>
      </div>
      <div className="card mb-24">
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Shows</th>
              <th>Avg Rating</th>
              <th>Completed</th>
              <th>Dropped</th>
            </tr>
          </thead>
          <tbody>
            {memberBreakdown.map(m => (
              <tr key={m.id}>
                <td>
                  <Link to={`/member/${m.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{m.name}</Link>
                </td>
                <td>{m.total}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {m.avg_rating ? m.avg_rating.toFixed(2) : "—"}
                </td>
                <td style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{m.completed || 0}</td>
                <td style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>{m.dropped || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assignments */}
      <div className="section-header">
        <h2>All Assignments</h2>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Anime</th>
              <th>Assignee</th>
              <th>Assigner</th>
              <th>Roll</th>
              <th>Rating</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.anime_title}</td>
                <td style={{ color: "var(--accent)" }}>{a.assignee_name}</td>
                <td className="text-muted">{a.assigner_name}</td>
                <td className="text-mono" style={{ fontSize: "0.75rem" }}>#{a.roll_number}</td>
                <td className="text-mono">
                  {a.rating != null ? (
                    <span style={{ color: a.rating >= 8 ? "var(--green)" : a.rating >= 6 ? "var(--text)" : "var(--red)" }}>
                      {a.rating}
                    </span>
                  ) : "—"}
                </td>
                <td><StatusBadge status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}