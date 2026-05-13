import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Season from "./pages/Season";
import Seasons from "./pages/Seasons";
import Member from "./pages/Member";
import Roll from "./pages/Roll";
import Stats from "./pages/Stats";
import Admin from "./pages/Admin";
import "./App.css";
import { useAuth } from "./lib/AuthContext";
import logo from "./assets/icon.png";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

function Nav() {
  const { member, authState, logout, authBase } = useAuth();  // single call, correct destructure
  const location = useLocation();

  if (member === undefined) return null; // still loading
  if (!member || authState === 'no_group') return null;

  const links = [
    { to: "/", label: "Dashboard", icon: "⊞" },
    { to: "/seasons", label: "Seasons", icon: "◉" },
    { to: "/stats", label: "Stats", icon: "◈" },
    ...(member?.id === "jsn" ? [{ to: "/admin", label: "Admin", icon: "⚙" }] : []),
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <img src={logo} alt="番" className="logo-mark" />
        <span className="logo-text">AniRoll</span>
      </div>
      <ul className="nav-links">
        {links.map(l => (
          <li key={l.to}>
            <NavLink
              to={l.to}
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              end={l.to === "/"}
            >
              <span className="nav-icon">{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
        <div className="sidebar-footer">
          {member ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "var(--radius)",
              border: "1px solid rgba(255,255,255,0.07)",
              marginBottom: 12,
            }}>
              {member.avatar_url && (
                <img
                  src={member.avatar_url}
                  style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  alt={member.name}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
                <button
                  onClick={logout}
                  style={{ fontSize: "0.68rem", color: "var(--text2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  logout
                </button>
              </div>
            </div>
          ) : (
            <a
              href={`${authBase}/auth/anilist`}
              className="btn btn-primary btn-sm"
              style={{ width: "100%", textAlign: "center", marginBottom: 12 }}
            >
              Login with AniList
            </a>
          )}

          <div style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 10px",
          }}>
            {[
              { href: "/cookies.html", label: "Cookies" },
              { href: "/privacy.html", label: "Privacy" },
              { href: "/terms.html", label: "Terms" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "0.68rem", color: "var(--text2)", textDecoration: "none", opacity: 0.6 }}
              >
                {label}
              </a>
            ))}
            <span style={{ fontSize: "0.68rem", color: "var(--text2)", opacity: 0.4, marginLeft: "auto" }}>2026</span>
          </div>
        </div>
    </nav>
  );
}

// Wraps any route that requires a logged-in session.
// Redirects to /login if no session, shows nothing while loading.
function ProtectedRoute({ children }) {
  const { member, authState } = useAuth();
  if (member === undefined) return null; // still loading, avoid flash
  if (!member) return <Navigate to="/login" replace />;
  if (authState === 'no_group') return <Navigate to="/no-group" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav />
        <main className="main-content">
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/no-group" element={<NoGroupPage />} />
            <Route path="/join" element={<JoinPage />} />

            {/* Protected */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/seasons" element={<ProtectedRoute><Seasons /></ProtectedRoute>} />
            <Route path="/season/:id" element={<ProtectedRoute><Season /></ProtectedRoute>} />
            <Route path="/member/:id" element={<ProtectedRoute><Member /></ProtectedRoute>} />
            <Route path="/roll/:id" element={<ProtectedRoute><Roll /></ProtectedRoute>} />
            <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function LoginPage() {
  const { member, authState, authBase } = useAuth();
  if (member && authState === 'member') return <Navigate to="/" replace />;
  if (member && authState === 'no_group') return <Navigate to="/no-group" replace />;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Left hero panel ─────────────────────────────── */}
      <div style={{
        flex: 1,
        background: "#0e0e14",
        padding: "40px 36px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRight: "1px solid rgba(255,255,255,0.07)",
      }}>
        {/* Wordmark */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "rgba(140,120,255,0.15)",
              border: "1px solid rgba(140,120,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#a89cf7",
            }}>
              <img src={logo} alt="AniRoll" style={{ width: 24, height: 24, objectFit: "contain" }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "0.04em", color: "#e0dff5" }}>AniRoll</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.35, color: "#e0dff5", marginBottom: 10 }}>
            Watch together,<br />picked by each other.
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.65, maxWidth: 300, fontFamily: "var(--font-mono)" }}>
            A derangement algorithm assigns every member an anime to pick for someone else — nobody picks for themselves.
          </div>
        </div>

        {/* Derangement viz */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 20px 14px", marginTop: 28 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            how a roll works
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Left — assigners */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "kai", color: "#a89cf7", bg: "rgba(140,120,255,0.15)" },
                { name: "dan", color: "#7ec8b0", bg: "rgba(126,200,176,0.15)" },
                { name: "alex", color: "#f0c040", bg: "rgba(240,192,64,0.15)" },
                { name: "sam", color: "#e08080", bg: "rgba(200,100,100,0.15)" },
              ].map(({ name, color, bg }) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: bg, border: `2px solid ${color}`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{name}</div>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>picks for</span>
                </div>
              ))}
            </div>

            {/* Center — arrows SVG */}
            <div style={{ flex: 1, height: 180, position: "relative", margin: "0 4px" }}>
              <svg viewBox="0 0 100 172" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", overflow: "visible" }}>
                <defs>
                  <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.2)" />
                  </marker>
                </defs>
                <path d="M0,21 C50,21 50,109 100,109" stroke="#a89cf7" strokeWidth="1.5" fill="none" markerEnd="url(#arr)" opacity="0.7" />
                <path d="M0,65 C50,65 50,155 100,155" stroke="#7ec8b0" strokeWidth="1.5" fill="none" markerEnd="url(#arr)" opacity="0.7" />
                <path d="M0,109 C50,109 50,21 100,21" stroke="#f0c040" strokeWidth="1.5" fill="none" markerEnd="url(#arr)" opacity="0.7" />
                <path d="M0,155 C50,155 50,65 100,65" stroke="#e08080" strokeWidth="1.5" fill="none" markerEnd="url(#arr)" opacity="0.7" />
              </svg>
            </div>

            {/* Right — assignees */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "dan", color: "#7ec8b0", bg: "rgba(126,200,176,0.15)" },
                { name: "alex", color: "#f0c040", bg: "rgba(240,192,64,0.15)" },
                { name: "sam", color: "#e08080", bg: "rgba(200,100,100,0.15)" },
                { name: "kai", color: "#a89cf7", bg: "rgba(140,120,255,0.15)" },
              ].map(({ name, color, bg }) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: "row-reverse" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: bg, border: `2px solid ${color}`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>{name}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 14, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
            assignments randomized each roll — weighted to avoid repeats
          </div>
        </div>

      </div>

      {/* ── Right login panel ────────────────────────────── */}
      <div style={{
        width: 380,
        background: "#13131f",
        padding: "40px 32px",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Follow your current assignments
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "#e0dff5", marginBottom: 20 }}>
          See Who's Watching What.
        </div>

        {/* Demo roll preview */}
        <div style={{ background: "#0e0e14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflow: "hidden", marginBottom: 20, flex: 1, position: "relative" }}>
          {/* Top fade */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 60,
            background: "linear-gradient(#13131f, transparent)",
            zIndex: 2, pointerEvents: "none",
          }} />
          {/* Bottom fade */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
            background: "linear-gradient(transparent, #13131f)",
            zIndex: 2, pointerEvents: "none",
          }} />
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#a89cf7", fontWeight: 700 }}>#7</span>
              <span style={{ fontSize: 11, color: "#e0dff5", fontWeight: 600 }}>Viewer's Choice</span>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#f0c040" }}>avg 7.83</span>
          </div>
          <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { title: "Vinland Saga", url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-2fhDFPCuMNiz.jpg", bg: "#2d1b4e", accent: "#6c3fa0", from: "kai", to: "morgan", status: "completed", rating: "9/10", ratingColor: "#6ec97a" },
              { title: "Mushishi", url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx457-l6cTtNgI9Bi6.png", bg: "#1a3530", accent: "#2a7a60", from: "morgan", to: "alex", status: "watching", rating: "ep 8/26", ratingColor: "#a89cf7" },
              { title: "Berserk (1997)", url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx33-PSwfE5B0gejI.jpg", bg: "#3a1e1e", accent: "#7a3030", from: "alex", to: "sam", status: "completed", rating: "8.5/10", ratingColor: "#6ec97a" },
              { title: "Planetes", url: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx329-4xwXdazRA7Ph.png", bg: "#1a2a40", accent: "#2a5080", from: "sam", to: "kai", status: "pending", rating: null },
            ].map(({ title, url, bg, accent, from, to, status, rating, ratingColor }) => (
              <div key={title} style={{ background: "#13131f", borderRadius: 6, padding: "8px 10px", display: "flex", gap: 10, borderLeft: `3px solid ${accent}` }}>
                <img src={url} alt={title} style={{ width: 28, height: 40, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#e0dff5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                  <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,0.3)", marginTop: 2 }}>
                    <span style={{ color: "#7ec8b0" }}>{from}</span> → <span style={{ color: "#a89cf7" }}>{to}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{
                      fontSize: 9, fontFamily: "var(--font-mono)", borderRadius: 3, padding: "1px 5px",
                      ...(status === "completed" ? { background: "rgba(100,200,100,0.12)", color: "#6ec97a", border: "1px solid rgba(100,200,100,0.2)" }
                        : status === "watching" ? { background: "rgba(140,120,255,0.12)", color: "#a89cf7", border: "1px solid rgba(140,120,255,0.2)" }
                        : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)" })
                    }}>{status}</span>
                    {rating && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: ratingColor }}>{rating}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "0 0 16px" }} />
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, marginBottom: 16, fontFamily: "var(--font-mono)" }}>
          sign in with your AniList account to access your group's rolls, stats, and history.
        </div>

          <a href={`${authBase}/auth/anilist`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "rgba(140,120,255,0.15)",
            border: "1px solid rgba(140,120,255,0.35)",
            color: "#a89cf7",
            borderRadius: 8, padding: "11px 20px",
            fontSize: 14, fontWeight: 600,
            textDecoration: "none", textAlign: "center",
            letterSpacing: "0.02em",
          }}
        >
          Login with AniList
        </a>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 10, fontFamily: "var(--font-mono)" }}>
          closed group - invite only
        </div>
      </div>
    </div>
  );
}

function NoGroupPage() {
  const { member, logout, authBase } = useAuth();
  const [view, setView] = useState(null); // null | 'create' | 'search' | 'invite'

  useEffect(() => {
    // If user just came back from AniList login with a pending invite
    const pendingToken = sessionStorage.getItem("pendingInviteToken");
    if (pendingToken) {
      setView('invite');
    }
  }, []);

  if (!member) return <Navigate to="/login" replace />;

  return (
    <div className="no-group-page" style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", padding: 24,
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
          {member.avatar_url && (
            <img src={member.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
          )}
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{member.anilistUsername}</div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>logged in via AniList</div>
          </div>
        </div>
        <h1 style={{ marginBottom: 8 }}>You're not in a group yet</h1>
        <div className="text-muted" style={{ fontSize: "0.85rem", maxWidth: 380, lineHeight: 1.6 }}>
          AniRoll is built around groups. Create one for your friends, or join one you've been invited to.
        </div>
      </div>

      {/* Action cards */}
      {!view && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, width: "100%", maxWidth: 560 }}>
          <button
            onClick={() => setView('create')}
            style={{
              background: "rgba(140,120,255,0.08)", border: "1px solid rgba(140,120,255,0.25)",
              borderRadius: 10, padding: "24px 16px", cursor: "pointer", textAlign: "center",
              color: "var(--text)", transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(140,120,255,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(140,120,255,0.08)"}
          >
            <div style={{ fontSize: 24, marginBottom: 10 }}>⊕</div>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>Create a Group</div>
            <div className="text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
              Start a new club and invite your friends
            </div>
          </button>

          <button
            onClick={() => setView('invite')}
            style={{
              background: "rgba(126,200,176,0.08)", border: "1px solid rgba(126,200,176,0.25)",
              borderRadius: 10, padding: "24px 16px", cursor: "pointer", textAlign: "center",
              color: "var(--text)", transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(126,200,176,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(126,200,176,0.08)"}
          >
            <div style={{ fontSize: 24, marginBottom: 10 }}>⊞</div>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>Have an Invite?</div>
            <div className="text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
              Enter your invite code to join a group
            </div>
          </button>

          <button
            onClick={() => setView('search')}
            style={{
              background: "rgba(240,192,64,0.08)", border: "1px solid rgba(240,192,64,0.25)",
              borderRadius: 10, padding: "24px 16px", cursor: "pointer", textAlign: "center",
              color: "var(--text)", transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(240,192,64,0.15)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(240,192,64,0.08)"}
          >
            <div style={{ fontSize: 24, marginBottom: 10 }}>◎</div>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>Find a Group</div>
            <div className="text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
              Search for a group and request to join
            </div>
          </button>
        </div>
      )}

      {/* Create group form */}
      {view === 'create' && (
        <CreateGroupForm onBack={() => setView(null)} authBase={authBase} member={member} />
      )}

      {/* Invite code form */}
      {view === 'invite' && (
        <InviteCodeForm onBack={() => setView(null)} authBase={authBase} />
      )}

      {/* Search form */}
      {view === 'search' && (
        <GroupSearchForm onBack={() => setView(null)} authBase={authBase} />
      )}

      {/* Logout */}
      <button
        onClick={logout}
        style={{ marginTop: 32, fontSize: "0.75rem", color: "var(--text2)", background: "none", border: "none", cursor: "pointer" }}
      >
        logout
      </button>
    </div>
  );
}

function CreateGroupForm({ onBack, authBase, member }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`${authBase}/api/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
      credentials: "include",
    }).then(r => r.json());
    setSaving(false);
    if (res.error) return setError(res.error);
    // Reload to re-fetch /auth/me with new group context
    window.location.href = "/";
  }

  return (
    <div className="no-group-page" style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", padding: 24,
    }}>
      <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>← Back</button>
      <div className="card">
        <h2 className="mb-8">Create a Group</h2>
        <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
          You'll be the owner. You can invite members after creating the group.
        </div>
        <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
          Group Name
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="e.g. The Anime Bois"
          style={{ marginBottom: 12 }}
          autoFocus
        />
        {error && <div style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary" onClick={submit} disabled={saving || !name.trim()} style={{ width: "100%" }}>
          {saving ? "Creating..." : "Create Group"}
        </button>
      </div>
    </div>
  );
}

function InviteCodeForm({ onBack, authBase }) {
  const pendingToken = sessionStorage.getItem("pendingInviteToken") || "";
  const [token, setToken] = useState(pendingToken);
  const [checking, setChecking] = useState(false);
  const [groupInfo, setGroupInfo] = useState(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  async function checkToken() {
    if (!token.trim()) return;
    setChecking(true);
    setError(null);
    const res = await fetch(`${authBase}/api/groups/join?token=${encodeURIComponent(token.trim())}`, {
      credentials: "include",
    }).then(r => r.json());
    setChecking(false);
    if (res.error) return setError(res.error);
    setGroupInfo(res);
  }

  async function join() {
    setJoining(true);
    const res = await fetch(`${authBase}/api/groups/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
      credentials: "include",
    }).then(r => r.json());
    setJoining(false);
    if (res.error) return setError(res.error);
    window.location.href = "/";
  }

  return (
    <div style={{ width: "100%", maxWidth: 400 }}>
      <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>← Back</button>
      <div className="card">
        <h2 className="mb-8">Enter Invite Code</h2>
        <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
          Paste the invite code or link a group owner sent you.
        </div>
        <label className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
          Invite Code
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={token}
            onChange={e => {
              // Accept full URLs too — extract token param
              const val = e.target.value;
              try {
                const url = new URL(val);
                const t = url.searchParams.get("token");
                if (t) { setToken(t); return; }
              } catch {}
              setToken(val);
            }}
            placeholder="Paste code or invite link..."
            style={{ flex: 1 }}
            autoFocus
          />
          <button className="btn btn-ghost btn-sm" onClick={checkToken} disabled={checking || !token.trim()}>
            {checking ? "..." : "Check"}
          </button>
        </div>
        {error && <div style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: 12 }}>{error}</div>}
        {groupInfo && (
          <div style={{
            padding: "12px 16px", background: "rgba(126,200,176,0.08)",
            border: "1px solid rgba(126,200,176,0.2)", borderRadius: 8, marginBottom: 12,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{groupInfo.group_name}</div>
            <div className="text-muted" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
              {groupInfo.member_count} members
            </div>
          </div>
        )}
        {groupInfo && (
          <button className="btn btn-primary" onClick={join} disabled={joining} style={{ width: "100%" }}>
            {joining ? "Joining..." : `Join ${groupInfo.group_name}`}
          </button>
        )}
      </div>
    </div>
  );
}

function GroupSearchForm({ onBack, authBase }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState({});
  const [error, setError] = useState(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    const res = await fetch(`${authBase}/api/groups/search?q=${encodeURIComponent(query.trim())}`, {
      credentials: "include",
    }).then(r => r.json());
    setSearching(false);
    if (res.error) return setError(res.error);
    setResults(res);
  }

  async function requestJoin(groupId) {
    const res = await fetch(`${authBase}/api/groups/${groupId}/request`, {
      method: "POST",
      credentials: "include",
    }).then(r => r.json());
    if (res.error) return setError(res.error);
    setRequested(prev => ({ ...prev, [groupId]: true }));
  }

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>← Back</button>
      <div className="card">
        <h2 className="mb-8">Find a Group</h2>
        <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
          Search by group name. The owner will need to approve your request.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Search groups..."
            style={{ flex: 1 }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={search} disabled={searching || !query.trim()}>
            {searching ? "..." : "Search"}
          </button>
        </div>
        {error && <div style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: 12 }}>{error}</div>}
        {results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map(g => (
              <div key={g.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--bg3)",
                border: "1px solid var(--border)", borderRadius: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{g.name}</div>
                  <div className="text-muted" style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                    {g.member_count} members · {g.season_count} seasons
                  </div>
                </div>
                <button
                  className={requested[g.id] ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
                  onClick={() => requestJoin(g.id)}
                  disabled={requested[g.id]}
                >
                  {requested[g.id] ? "Requested ✓" : "Request to Join"}
                </button>
              </div>
            ))}
          </div>
        )}
        {results.length === 0 && query && !searching && (
          <div className="text-muted" style={{ fontSize: "0.8rem", textAlign: "center", padding: 16 }}>
            No groups found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}

function JoinPage() {
  const { member, authState, authBase } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [groupInfo, setGroupInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!token) { setError("No invite token provided."); setLoading(false); return; }
    // Store token in sessionStorage so we can use it after AniList login
    sessionStorage.setItem("pendingInviteToken", token);
    fetch(`${authBase}/api/groups/join?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setGroupInfo(data);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load invite."); setLoading(false); });
  }, [token]);

  async function join() {
    setJoining(true);
    const res = await fetch(`${authBase}/api/groups/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      credentials: "include",
    }).then(r => r.json());
    setJoining(false);
    if (res.error) return setError(res.error);
    sessionStorage.removeItem("pendingInviteToken");
    setJoined(true);
    setTimeout(() => { window.location.href = "/"; }, 1500);
  }

  if (loading) return <div className="loading">Checking invite...</div>;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100%", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: "rgba(140,120,255,0.15)",
            border: "1px solid rgba(140,120,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, margin: "0 auto 16px",
          }}>⊞</div>
          <h1 style={{ marginBottom: 8 }}>You've been invited</h1>
          <div className="text-muted" style={{ fontSize: "0.85rem" }}>
            Someone shared an invite link with you.
          </div>
        </div>

        {error ? (
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>✕</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Invite Invalid</div>
            <div className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>{error}</div>
            <a href="/login" className="btn btn-ghost btn-sm">Back to login</a>
          </div>
        ) : joined ? (
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 12 }}>✓</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Joined successfully!</div>
            <div className="text-muted" style={{ fontSize: "0.85rem" }}>Redirecting you now...</div>
          </div>
        ) : (
          <div className="card">
            <div className="text-muted mb-8" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              You've been invited to
            </div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4 }}>{groupInfo?.group_name}</div>
            <div className="text-muted mb-24" style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
              {groupInfo?.member_count} members
            </div>

            {!member ? (
              // Not logged in — send to AniList, token already in sessionStorage
              <div>
                <div className="text-muted mb-16" style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
                  Sign in with AniList to accept this invite.
                </div>

                  <a href={`${authBase}/auth/anilist`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, background: "rgba(140,120,255,0.15)",
                    border: "1px solid rgba(140,120,255,0.35)", color: "#a89cf7",
                    borderRadius: 8, padding: "11px 20px", fontSize: 14, fontWeight: 600,
                    textDecoration: "none", textAlign: "center",
                  }}
                >
                  Login with AniList to Join
                </a>
              </div>
            ) : authState === 'member' ? (
              // Already in a group
              <div>
                <div className="text-muted mb-16" style={{ fontSize: "0.8rem" }}>
                  You're already a member of a group. You can't join another one.
                </div>
                <a href="/" className="btn btn-ghost btn-sm">Go to dashboard</a>
              </div>
            ) : (
              // Logged in, no group — show join button
              <div>
                <div className="flex items-center gap-8 mb-16" style={{
                  padding: "10px 12px", background: "rgba(255,255,255,0.04)",
                  borderRadius: "var(--radius)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  {member.avatar_url && (
                    <img src={member.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                  )}
                  <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{member.anilistUsername}</div>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={join}
                  disabled={joining}
                  style={{ width: "100%" }}
                >
                  {joining ? "Joining..." : `Join ${groupInfo?.group_name}`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}