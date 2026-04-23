import { createContext, useContext, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const BASE = API.replace(/\/api$/, "");

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [member, setMember] = useState(undefined);

  useEffect(() => {
    fetch(`${BASE}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setMember)
      .catch(() => setMember(null));
  }, []);

  function logout() {
    fetch(`${BASE}/auth/logout`, { method: "POST", credentials: "include" })
      .then(() => setMember(null));
  }

  return (
    <AuthContext.Provider value={{ member, setMember, logout, authBase: BASE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}