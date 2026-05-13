import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine,
} from "recharts";

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

function InsightCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
      <div className="stat-label" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: color || "var(--accent)", marginBottom: 4, lineHeight: 1.2 }}>
        {value ?? "—"}
      </div>
      {sub && <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>{sub}</div>}
    </div>
  );
}

function RatingsChart({ memberId, memberName }) {
  const [rawData, setRawData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    fetch(`${API}/stats/ratings-over-time/${memberId}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { setRawData(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [memberId]);

  if (loading) return (
    <div className="text-muted" style={{ fontSize: "0.8rem", padding: "16px 0" }}>Loading chart...</div>
  );
  if (!rawData) return null;

  const { received, given, seasons } = rawData;

  // Build roll map filtered by season
  const rollMap = {};
  const addEntry = (arr, type) => {
    for (const a of arr) {
      if (selectedSeason !== "all" && String(a.season_id) !== String(selectedSeason)) continue;
      const key = `${a.season_id}-${a.roll_number}`;
      if (!rollMap[key]) rollMap[key] = {
        key,
        label: selectedSeason === "all" ? `S${a.season_id} R${a.roll_number}` : `Roll ${a.roll_number}`,
        season_id: a.season_id,
        roll_number: a.roll_number,
        receivedRatings: [],
        givenRatings: [],
      };
      if (type === "received") rollMap[key].receivedRatings.push(a.rating);
      else rollMap[key].givenRatings.push(a.rating);
    }
  };

  addEntry(received, "received");
  addEntry(given, "given");

  const chartData = Object.values(rollMap)
    .sort((a, b) => a.season_id !== b.season_id ? a.season_id - b.season_id : a.roll_number - b.roll_number)
    .map(r => ({
      label: r.label,
      received: r.receivedRatings.length
        ? +(r.receivedRatings.reduce((a, b) => a + b, 0) / r.receivedRatings.length).toFixed(2)
        : null,
      given: r.givenRatings.length
        ? +(r.givenRatings.reduce((a, b) => a + b, 0) / r.givenRatings.length).toFixed(2)
        : null,
    }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontFamily: "var(--font-mono)" }}>
        <div style={{ color: "var(--text)", marginBottom: 4 }}>{label}</div>
        {payload.map(p => p.value != null && (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {p.value.toFixed(2)}
          </div>
        ))}
      </div>
    );
  };

  const needsScroll = chartData.length > 12;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="flex items-center justify-between mb-8">
        <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
          {memberName} — rating per roll
        </div>
        <select
          value={selectedSeason}
          onChange={e => setSelectedSeason(e.target.value)}
          style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", padding: "2px 8px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)" }}
        >
          <option value="all">All seasons</option>
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {!chartData.length ? (
        <div className="text-muted" style={{ fontSize: "0.8rem", padding: "16px 0" }}>
          No rated data for this selection.
        </div>
      ) : (
        <>
          <div style={{ overflowX: needsScroll ? "auto" : "visible" }}>
            <div style={{ minWidth: needsScroll ? chartData.length * 48 : "100%" }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "var(--text2)", fontFamily: "var(--font-mono)" }}
                    interval={0}
                  />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "var(--text2)", fontFamily: "var(--font-mono)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)", cursor: "pointer" }}
                    onMouseEnter={e => setActiveKey(e.dataKey)}
                    onMouseLeave={() => setActiveKey(null)}
                  />
                  <ReferenceLine y={7} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="received"
                    name="received (assignee)"
                    stroke="var(--accent)"
                    strokeWidth={activeKey === null || activeKey === "received" ? 2.5 : 0.5}
                    opacity={activeKey === null || activeKey === "received" ? 1 : 0.2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="given"
                    name="given (assigner)"
                    stroke="var(--accent2)"
                    strokeWidth={activeKey === null || activeKey === "given" ? 2.5 : 0.5}
                    opacity={activeKey === null || activeKey === "given" ? 1 : 0.2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {needsScroll && (
            <div className="text-muted" style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", textAlign: "center", marginTop: 4 }}>
              scroll to see all rolls
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HeadToHeadMatrix({ data, members }) {
  if (!data.length || !members.length) return null;
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

function SeasonAvgChart({ seasons }) {
  if (!seasons?.length) return null;
  const data = seasons.map(s => ({
    name: s.name,
    avg: s.avg_rating != null ? +s.avg_rating.toFixed(2) : null,
    rolls: s.rolls_completed ?? 0,
  })).filter(d => d.avg != null);

  if (!data.length) return <div className="text-muted" style={{ fontSize: "0.8rem" }}>No rated data yet.</div>;

  const overallAvg = data.reduce((sum, d) => sum + d.avg, 0) / data.length;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text2)", fontFamily: "var(--font-mono)" }} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "var(--text2)", fontFamily: "var(--font-mono)" }} />
        <Tooltip
          contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
          labelStyle={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}
          itemStyle={{ fontFamily: "var(--font-mono)" }}
          formatter={(v) => [v.toFixed(2), "avg rating"]}
        />
        <ReferenceLine y={overallAvg} stroke="var(--gold)" strokeDasharray="4 4" label={{ value: "all-time avg", fill: "var(--gold)", fontSize: 10, fontFamily: "var(--font-mono)" }} />
        <Bar dataKey="avg" fill="var(--accent)" radius={[3, 3, 0, 0]} opacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Stats() {
  const [memberStats, setMemberStats] = useState([]);
  const [h2h, setH2h] = useState([]);
  const [members, setMembers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members");
  const [avatars, setAvatars] = useState({});
  const [expandedChart, setExpandedChart] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/stats/members`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/stats/head-to-head`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/members`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/stats/overview`, { credentials: "include" }).then(r => r.json()),
      fetch(`${API}/seasons`, { credentials: "include" }).then(r => r.json()),
    ]).then(async ([ms, h, mems, ov, seas]) => {
      setMemberStats(ms);
      setH2h(h);
      setMembers(mems);
      setOverview(ov);

      // Fetch per-season avg ratings for season comparison
      const seasonDetails = await Promise.all(
        seas.map(s =>
          fetch(`${API}/stats/season/${s.id}`, { credentials: "include" })
            .then(r => r.json())
            .then(data => {
              const rated = (data.rollStats || []).filter(r => r.avg_rating != null);
              const avg = rated.length
                ? rated.reduce((sum, r) => sum + r.avg_rating, 0) / rated.length
                : null;
              const dates = (data.rollStats || [])
                .map(r => r.roll_date)
                .filter(Boolean)
                .sort();
              const lengthDays = dates.length >= 2
                ? Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / (1000 * 60 * 60 * 24))
                : null;
              return {
                ...s,
                avg_rating: avg,
                length_days: lengthDays,
                roll_stats: data.rollStats,
                member_breakdown: data.memberBreakdown,
                top_genres: data.top_genres,
              };
            })
            .catch(() => ({ ...s }))
        )
      );
      setSeasons(seasonDetails);

      const avatarMap = {};
      await Promise.all(
        mems.filter(m => m.anilist_username).map(m =>
          fetch(`${API}/anime/anilist-proxy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `query($name: String) { User(name: $name) { avatar { large } } }`,
              variables: { name: m.anilist_username },
            }),
            credentials: "include",
          }).then(r => r.json()).then(d => {
            avatarMap[m.id] = d.data?.User?.avatar?.large;
          }).catch(() => {})
        )
      );
      setAvatars(avatarMap);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Crunching numbers...</div>;

  const allTimeAvg = overview?.avgRating;
  const avgSeasonLength = seasons.length
    ? seasons.filter(s => s.length_days != null).reduce((sum, s) => sum + s.length_days, 0) /
      seasons.filter(s => s.length_days != null).length
    : null;

  const tabs = [
    { id: "members", label: "Per Member" },
    { id: "seasons", label: "Per Season" },
    { id: "h2h", label: "Head-to-Head" },
  ];

  return (
    <div>
      <div className="section-header mb-16">
        <h1>Stats</h1>
      </div>

      {/* ── Group insights banner ─────────────────────────── */}
      <div className="grid-4" style={{ gap: 12, marginBottom: 24 }}>
        <InsightCard
          label="Best Taste"
          value={overview?.bestTaste?.name ?? "—"}
          sub={overview?.bestTaste ? `picks avg ${overview.bestTaste.avg_pick_rating?.toFixed(2)}/10` : null}
          color="var(--gold)"
        />
        <InsightCard
          label="Hardest to Please"
          value={overview?.hardestToPlease?.name ?? "—"}
          sub={overview?.hardestToPlease ? `avg given ${overview.hardestToPlease.avg_given?.toFixed(2)}/10` : null}
          color="var(--red)"
        />
        <InsightCard
          label="Best Taste Alignment"
          value={overview?.bestAlignment ? overview.bestAlignment.names.join(" & ") : "—"}
          sub={overview?.bestAlignment ? `mutual avg ${overview.bestAlignment.mutual_avg}/10` : null}
          color="var(--accent2)"
        />
        <InsightCard
          label="Longest Streak"
          value={overview?.longestStreak ? overview.longestStreak.names.join(" & ") : "—"}
          sub={overview?.longestStreak ? `${overview.longestStreak.seasons} consecutive rolls` : null}
          color="var(--accent)"
        />
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Per Member ───────────────────────────────────── */}
      {activeTab === "members" && (
        <div className="flex flex-col gap-16">
          {memberStats.map(m => (
            <div key={m.id} className="card">
              {/* Header */}
              <div className="flex items-center justify-between mb-16">
                <div className="flex items-center gap-12">
                  {avatars[m.id]
                    ? <img src={avatars[m.id]} alt={m.name} style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
                    : <div className="avatar avatar-lg">{m.name?.charAt(0)}</div>
                  }
                  <div>
                    <h2 style={{ marginBottom: 2 }}>{m.name}</h2>
                    {m.anilist_username && <div className="text-muted" style={{ fontSize: "0.75rem" }}>@{m.anilist_username}</div>}
                    <div style={{ marginTop: 4 }}>
                      <span className="text-muted" style={{ fontSize: "0.72rem" }}>Taste vs AniList: </span>
                      <TasteLabel offset={m.taste_offset_vs_anilist} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid-4" style={{ gap: 12, marginBottom: 16 }}>
                <div className="stat">
                  <div className="stat-value">{m.avg_rating_given != null ? m.avg_rating_given.toFixed(2) : "—"}</div>
                  <div className="stat-label">Avg Rating</div>
                </div>
                <div className="stat">
                  <div className="stat-value">{m.received_count || 0}</div>
                  <div className="stat-label">Shows Watched</div>
                </div>
                <div className="stat">
                  <div className="stat-value" style={{ color: "var(--green)" }}>{m.max_rating ?? "—"}</div>
                  <div className="stat-label">Highest</div>
                </div>
                <div className="stat">
                  <div className="stat-value" style={{ color: "var(--red)" }}>{m.min_rating ?? "—"}</div>
                  <div className="stat-label">Lowest</div>
                </div>
              </div>

              {/* Completion bar */}
              {m.received_count > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>completion rate</span>
                    <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--accent2)" }}>
                      {m.completion_rate != null ? `${Math.round(m.completion_rate * 100)}%` : "—"}
                    </span>
                  </div>
                  <div className="rating-track" style={{ height: 4 }}>
                    <div className="rating-fill" style={{ width: `${Math.round((m.completion_rate ?? 0) * 100)}%`, height: "100%" }} />
                  </div>
                </div>
              )}

              {/* Best/worst + genres */}
              <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
                <div>
                  <div className="text-muted mb-6" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best Received</div>
                  {m.best_received ? (
                    <div style={{ fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--accent)" }}>{m.best_received.anime_title}</span>
                      <span className="text-muted"> — {m.best_received.rating}/10</span>
                      {m.best_received.assigner_name && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                          picked by <span style={{ color: "var(--accent2)" }}>{m.best_received.assigner_name}</span>
                        </div>
                      )}
                    </div>
                  ) : <span className="text-muted" style={{ fontSize: "0.8rem" }}>No data</span>}
                </div>
                <div>
                  <div className="text-muted mb-6" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Worst Received</div>
                  {m.worst_received ? (
                    <div style={{ fontSize: "0.85rem" }}>
                      <span style={{ color: "var(--red)" }}>{m.worst_received.anime_title}</span>
                      <span className="text-muted"> — {m.worst_received.rating}/10</span>
                      {m.worst_received.assigner_name && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                          picked by <span style={{ color: "var(--accent2)" }}>{m.worst_received.assigner_name}</span>
                        </div>
                      )}
                    </div>
                  ) : <span className="text-muted" style={{ fontSize: "0.8rem" }}>No data</span>}
                </div>
              </div>

              {/* Top genres */}
              <div style={{ marginBottom: 16 }}>
                <div className="text-muted mb-6" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Genres</div>
                <div className="flex" style={{ flexWrap: "wrap", gap: 4 }}>
                  {m.top_genres?.length
                    ? m.top_genres.map(g => <span key={g.genre} className="genre-chip">{g.genre} ({g.count})</span>)
                    : <span className="text-muted" style={{ fontSize: "0.8rem" }}>—</span>
                  }
                </div>
              </div>

              {/* Ratings over time toggle */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedChart(expandedChart === m.id ? null : m.id)}
                  style={{ fontSize: "0.75rem" }}
                >
                  {expandedChart === m.id ? "▲ Hide chart" : "▼ Ratings over time"}
                </button>
                {expandedChart === m.id && (
                  <RatingsChart memberId={m.id} memberName={m.name} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Per Season ───────────────────────────────────── */}
      {activeTab === "seasons" && (
        <div className="flex flex-col gap-24">
          {/* Season avg comparison chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2>Season Avg Comparison</h2>
              {allTimeAvg != null && (
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--gold)" }}>
                  all-time avg {allTimeAvg.toFixed(2)}
                </span>
              )}
            </div>
            <div className="text-muted mb-16" style={{ fontSize: "0.75rem" }}>
              Average rating across all rolls per season. Dashed line = all-time average.
            </div>
            <SeasonAvgChart seasons={seasons} />
          </div>

          {/* Season length summary */}
          <div className="grid-3" style={{ gap: 12 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="stat-label mb-8">Total Seasons</div>
              <div className="stat-value">{seasons.length}</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="stat-label mb-8">Avg Season Length</div>
              <div className="stat-value" style={{ fontFamily: "var(--font-mono)" }}>
                {avgSeasonLength != null ? `${Math.round(avgSeasonLength)}d` : "—"}
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="stat-label mb-8">All-Time Avg Rating</div>
              <div className="stat-value" style={{ color: "var(--gold)" }}>
                {allTimeAvg != null ? allTimeAvg.toFixed(2) : "—"}
              </div>
            </div>
          </div>

          {/* Per season breakdown */}
          {seasons.map(s => (
            <div key={s.id} className="card">
              <div className="flex items-center justify-between mb-16">
                <div>
                  <div className="text-muted" style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                    {s.is_active ? "ACTIVE" : "FINISHED"}
                  </div>
                  <h2 style={{ marginBottom: 4 }}>{s.name}</h2>
                  <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                    {s.started_at}{s.ended_at ? ` → ${s.ended_at}` : " → ongoing"}
                    {s.length_days != null && (
                      <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)" }}>· {s.length_days}d</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-16">
                  <div className="stat">
                    <div className="stat-value" style={{ color: "var(--gold)" }}>
                      {s.avg_rating != null ? s.avg_rating.toFixed(2) : "—"}
                    </div>
                    <div className="stat-label">Season Avg</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{s.rolls_completed ?? 0}</div>
                    <div className="stat-label">Rolls</div>
                  </div>
                </div>
              </div>

              {/* Member breakdown table */}
              {s.member_breakdown?.length > 0 && (
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
                    {s.member_breakdown.map(mb => (
                      <tr key={mb.id}>
                        <td style={{ fontWeight: 500 }}>{mb.name}</td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>{mb.total ?? 0}</td>
                        <td style={{ fontFamily: "var(--font-mono)" }}>
                          {mb.avg_rating != null ? mb.avg_rating.toFixed(2) : "—"}
                        </td>
                        <td style={{ color: "var(--green)", fontFamily: "var(--font-mono)" }}>{mb.completed ?? 0}</td>
                        <td style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>{mb.dropped ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Top genres */}
              {s.top_genres?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="text-muted mb-6" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Genres</div>
                  <div className="flex" style={{ flexWrap: "wrap", gap: 4 }}>
                    {s.top_genres.map(g => <span key={g.genre} className="genre-chip">{g.genre} ({g.count})</span>)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Head-to-Head ─────────────────────────────────── */}
      {activeTab === "h2h" && (
        <div className="card">
          <h2 className="mb-16">Assigner → Assignee Rating Matrix</h2>
          <HeadToHeadMatrix data={h2h} members={members} />
        </div>
      )}
    </div>
  );
}