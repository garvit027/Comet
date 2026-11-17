import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: `${API_BASE}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("comet_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("comet_token");
      localStorage.removeItem("comet_user");
      if (window.location.pathname !== "/login" && window.location.pathname !== "/register" && window.location.pathname !== "/") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export function wsUrl(path) {
  const base = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/^http/, "ws");
  return `${base}${path}`;
}

export function formatINR(value) {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return `₹ ${value}`;
  return "₹ " + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
