import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
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

function Nav() {
  const { member, logout, authBase } = useAuth();  // single call, correct destructure

  if (member === undefined) return null; // still loading

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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {member.avatar_url && (
              <img
                src={member.avatar_url}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                alt={member.name}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{member.name}</div>
              <button
                onClick={logout}
                style={{ fontSize: "0.7rem", color: "var(--text2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                logout
              </button>
            </div>
          </div>
        ) : (
          <a
            href={`${authBase}/auth/anilist`}
            className="btn btn-primary btn-sm"
            style={{ width: "100%", textAlign: "center" }}
          >
            Login with AniList
          </a>
        )}
        <a
          href="/cookies.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 6,
            display: "block",
            fontSize: "0.75rem",
            color: "var(--text2)",
            textDecoration: "none"
          }}
        >
          Cookie Policy
        </a>
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 6,
            display: "block",
            fontSize: "0.75rem",
            color: "var(--text2)",
            textDecoration: "none"
          }}
        >
          Privacy Policy
        </a>
        <a
          href="/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 6,
            display: "block",
            fontSize: "0.75rem",
            color: "var(--text2)",
            textDecoration: "none"
          }}
        >
          Terms of Service
        </a>
        <span className="version" style={{ marginTop: 8, display: "block" }}>2026</span>
      </div>
    </nav>
  );
}

// Wraps any route that requires a logged-in session.
// Redirects to /login if no session, shows nothing while loading.
function ProtectedRoute({ children }) {
  const { member } = useAuth();
  if (member === undefined) return null; // still loading, avoid flash
  if (!member) return <Navigate to="/login" replace />;
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
            <Route path="/not-invited" element={<NotInvitedPage />} />

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
  const { member, authBase } = useAuth();
  if (member) return <Navigate to="/" replace />;

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

function NotInvitedPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
      <h1>Not Invited</h1>
      <p className="text-muted">Your AniList account isn't part of this club yet.</p>
    </div>
  );
}