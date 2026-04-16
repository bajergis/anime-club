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

function Nav() {
  const loc = useLocation();
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
        <span className="version">S4 · 2026</span>
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