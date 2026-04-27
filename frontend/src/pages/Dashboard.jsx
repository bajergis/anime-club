import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const AUTH = API.replace("/api", "");

function RatingBar({ value, max = 10 }) {
  if (value == null) return <span className="text-muted" style={{ fontSize: "0.75rem" }}>—</span>;
  return (
    <div className="rating-bar">
      <div className="rating-track">
        <div className="rating-fill" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="rating-num">{value.toFixed(1)}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status || "pending"}`}>{status || "pending"}</span>;
}

function MemberAvatar({ member }) {
  if (member?.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={member.name}
        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <div className="avatar">
      {member?.name?.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Dashboard() {
  const { member: authMember } = useAuth();
  const [overview, setOverview] = useState(null);
  const [activeSeason, setActiveSeason] = useState(null);
  const [allSeasons, setAllSeasons] = useState([]);
  const [currentRoll, setCurrentRoll] = useState(null);
  const [currentRollId, setCurrentRollId] = useState(null);
  const [currentRollState, setCurrentRollState] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/stats/overview`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/seasons/active`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/seasons`, { credentials: "include" }).then(r => r.json()),
    ]).then(async ([ov, season, mems, seasons]) => {
      setOverview(ov);
      setActiveSeason(season);
      setMembers(mems);
      setAllSeasons(seasons);
      setLoading(false);

      if (season?.rolls?.length) {
        const lastRoll = season.rolls[season.rolls.length - 1];
        setCurrentRollId(lastRoll.id);
        setCurrentRollState(lastRoll.state ?? season.currentRollState);

        // Only fetch assignments if the roll is active or completed
        if (lastRoll.state === "active" || lastRoll.state === "completed" || !lastRoll.state) {
          fetch(`${API}/assignments?roll_id=${lastRoll.id}`, { credentials: "include" })
            .then(r => r.json())
            .then(setCurrentRoll);
        }
      }
    });
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  const isDraftingOrSelecting = currentRollState === "drafting" || currentRollState === "selecting";

  return (
    <div>
      {/* Header */}
      <div className="season-banner">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
              NOW ACTIVE
            </div>
            <h1>{activeSeason?.name || "No Active Season"}</h1>
            {activeSeason?.started_at && (
              <div className="text-muted mt-4" style={{ fontSize: "0.8rem" }}>
                Started {new Date(activeSeason.started_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {activeSeason?.rolls?.length || 0}
            </div>
            <div className="stat-label">rolls so far</div>
          </div>
        </div>
      </div>

      {/* Global stats */}
      {overview && (
        <div className="card mb-24">
          <div className="grid-4">
            <div className="stat">
              <div className="stat-value">{overview.totalAnime}</div>
              <div className="stat-label">Anime Watched</div>
            </div>
            <div className="stat">
              <div className="stat-value">{overview.avgRating ? overview.avgRating.toFixed(2) : "—"}</div>
              <div className="stat-label">All-Time Avg</div>
            </div>
            <div className="stat">
              <div className="stat-value">{overview.seasons}</div>
              <div className="stat-label">Seasons</div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {allSeasons.length
                  ? new Date(
                      [...allSeasons]
                        .sort((a, b) => new Date(a.started_at) - new Date(b.started_at))[0]
                        .started_at
                    ).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : "—"}
              </div>
              <div className="stat-label">Group Debut</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: 24 }}>
        {/* Current roll */}
        <div>
          <div className="section-header">
            <h2>Current Roll</h2>
            <div className="flex gap-8">
              {currentRollId && (
                <Link to={`/roll/${currentRollId}`} className="btn btn-ghost btn-sm">
                  {isDraftingOrSelecting ? "Go to Roll →" : "View Roll →"}
                </Link>
              )}
              {activeSeason && (
                <Link to={`/season/${activeSeason.id}`} className="btn btn-ghost btn-sm">View Season →</Link>
              )}
            </div>
          </div>

          {/* Drafting/selecting — show prompt instead of assignments */}
          {isDraftingOrSelecting ? (
            <div className="card" style={{
              textAlign: "center", padding: "40px 32px",
              border: "1px solid var(--accent)",
              background: "linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)",
            }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>
                {currentRollState === "drafting" ? "🔒" : "🎲"}
              </div>
              <h3 style={{ marginBottom: 8 }}>
                {currentRollState === "drafting" ? "New Roll — Lock In!" : "Selections in Progress"}
              </h3>
              <div className="text-muted mb-24" style={{ fontSize: "0.875rem" }}>
                {currentRollState === "drafting"
                  ? "A new roll lobby is open. Head over to lock in your participation."
                  : "Everyone is picking their show. Results will be revealed when all selections are in."
                }
              </div>
              <Link to={`/roll/${currentRollId}`} className="btn btn-primary">
                {currentRollState === "drafting" ? "🔒 Lock In →" : "View Selections →"}
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {currentRoll?.length ? currentRoll.map(a => {
                const ani = a.anilist_data ? JSON.parse(a.anilist_data) : null;
                return (
                  <div key={a.id} className="anime-card">
                    {ani?.cover_image_medium ? (
                      <img className="anime-thumb" src={ani.cover_image_medium} alt="" />
                    ) : (
                      <div className="anime-thumb" style={{
                        background: "var(--bg3)", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: "1.5rem"
                      }}>番</div>
                    )}
                    <div className="anime-info">
                      <div className="anime-title">{a.anime_title}</div>
                      <div className="anime-assigner mt-4">
                        <span className="assigner-tag">{a.assignee_name}</span>
                        <span className="text-muted"> ← assigned by </span>
                        <span className="assigner-tag">{a.assigner_name}</span>
                      </div>
                      <div className="flex items-center gap-8 mt-8">
                        <StatusBadge status={a.status} />
                        {a.episodes_watched != null && a.total_episodes && (a.status === "watching" || a.status === "hiatus") && (
                          <span className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                            {a.episodes_watched}/{a.total_episodes} ep
                          </span>
                        )}
                      </div>
                      {a.rating && <RatingBar value={a.rating} />}
                    </div>
                  </div>
                );
              }) : (
                <div className="card" style={{ textAlign: "center", padding: "32px" }}>
                  <div className="text-muted">No assignments yet this roll.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Members */}
        <div>
          <div className="section-header">
            <h2>{authMember?.group_name ?? "Members"}</h2>
          </div>
          <div className="flex flex-col gap-8">
            {members.map(m => (
              <Link key={m.id} to={`/member/${m.id}`} style={{ textDecoration: "none" }}>
                <div className="anime-card" style={{ alignItems: "center" }}>
                  <MemberAvatar member={m} />
                  <div className="anime-info">
                    <div className="anime-title">{m.name}</div>
                    {m.anilist_username && (
                      <div className="anime-meta">@{m.anilist_username}</div>
                    )}
                  </div>
                  <span className="text-accent" style={{ fontSize: "1.2rem" }}>→</span>
                </div>
              </Link>
            ))}
            {!members.length && (
              <div className="card text-muted" style={{ padding: 16, fontSize: "0.875rem" }}>No members yet.</div>
            )}
          </div>

          <div className="section-header mt-24">
            <h2>Seasons</h2>
          </div>
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Season</th>
                  <th>Started</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allSeasons.length ? allSeasons.map(s => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/season/${s.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>
                        {s.name}
                      </Link>
                    </td>
                    <td className="text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                      {s.started_at}
                    </td>
                    <td>
                      {s.is_active
                        ? <span className="badge badge-watching">Active</span>
                        : <span className="badge badge-completed">Finished</span>
                      }
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="text-muted" style={{ textAlign: "center" }}>No seasons yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}