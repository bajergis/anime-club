import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Season from "./pages/Season";
import Seasons from "./pages/Seasons";
import Member from "./pages/Member";
import Roll from "./pages/Roll";
import Stats from "./pages/Stats";
import Admin from "./pages/Admin";
import "./App.css";
import { useAuth } from "./AuthContext";

function Nav() {
  const loc = useLocation();
  const { member, logout } = useAuth();
  if (member === undefined) return null;
  const links = [
    { to: "/", label: "Dashboard", icon: "⊞" },
    { to: "/seasons", label: "Seasons", icon: "◉" },
    { to: "/stats", label: "Stats", icon: "◈" },
    { to: "/admin", label: "Admin", icon: "⚙" },
  ];
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-mark">番</span>
        <span className="logo-text">Bois<br/>Anime</span>
      </div>
      <ul className="nav-links">
        {links.map(l => (
          <li key={l.to}>
            <NavLink to={l.to} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} end={l.to === "/"}>
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
                <img src={member.avatar_url} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, truncate: true }}>{member.name}</div>
                <button
                  onClick={logout}
                  style={{ fontSize: "0.7rem", color: "var(--text2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  logout
                </button>
              </div>
            </div>
          ) : (
            <a href="http://localhost:3001/auth/anilist" className="btn btn-primary btn-sm" style={{ width: "100%", textAlign: "center" }}>
              Login with AniList
            </a>
          )}
          <span className="version" style={{ marginTop: 8, display: "block" }}>S4 · 2026</span>
        </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/seasons" element={<Seasons />} />
            <Route path="/season/:id" element={<Season />} />
            <Route path="/member/:id" element={<Member />} />
            <Route path="/roll/:id" element={<Roll />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}