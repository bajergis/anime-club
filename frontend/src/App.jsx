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
        <span className="version" style={{ marginTop: 8, display: "block" }}>2026</span>
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
      <h1>AniRoll</h1>
      <p className="text-muted">Sign in to access the club.</p>
      <a href={`${authBase}/auth/anilist`} className="btn btn-primary">
        Login with AniList
      </a>
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