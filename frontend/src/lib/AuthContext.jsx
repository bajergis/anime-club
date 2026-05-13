import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [member, setMember] = useState(undefined);
  const [authState, setAuthState] = useState(undefined); // 'member' | 'no_group' | null

  const authBase = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

  useEffect(() => {
    fetch(`${authBase}/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) {
          setMember(null);
          setAuthState(null);
        } else if (data.state === 'no_group') {
          setMember(data);   // partial member object with userId, anilistUsername etc
          setAuthState('no_group');
        } else {
          setMember(data);
          setAuthState('member');
        }
      })
      .catch(() => { setMember(null); setAuthState(null); });
  }, []);

  async function logout() {
    await fetch(`${authBase}/auth/logout`, { method: "POST", credentials: "include" });
    setMember(null);
    setAuthState(null);
  }

  return (
    <AuthContext.Provider value={{ member, authState, setMember, logout, authBase }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}