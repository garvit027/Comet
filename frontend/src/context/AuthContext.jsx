import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("comet_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("comet_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me").then((res) => {
      setUser(res.data);
      localStorage.setItem("comet_user", JSON.stringify(res.data));
    }).catch(() => {
      localStorage.removeItem("comet_token");
      localStorage.removeItem("comet_user");
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("comet_token", res.data.access_token);
    const me = await api.get("/auth/me");
    setUser(me.data);
    localStorage.setItem("comet_user", JSON.stringify(me.data));
    return me.data;
  };

  const register = async (payload) => (await api.post("/auth/register", payload)).data;
  const logout = () => { localStorage.removeItem("comet_token"); localStorage.removeItem("comet_user"); setUser(null); };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuctioneer: user?.role === "AUCTIONEER", isBidder: user?.role === "BIDDER" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
