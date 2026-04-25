import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [member, setMember] = useState(undefined);

  const authBase = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

  useEffect(() => {
    fetch(`${authBase}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(setMember)
      .catch(() => setMember(null));
  }, []);

  async function logout() {
    await fetch(`${authBase}/auth/logout`, { method: "POST", credentials: "include" });
    setMember(null);
  }

  return (
    <AuthContext.Provider value={{ member, setMember, logout, authBase }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}