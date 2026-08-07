import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ltd_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  agents: () => api.get("/auth/agents"),
};

export const leadsApi = {
  list: (params) => api.get("/leads", { params }),
  get: (id) => api.get(`/leads/${id}`),
  create: (payload) => api.post("/leads", payload),
  assign: (id, payload) => api.patch(`/leads/${id}/assign`, payload),
  updateStatus: (id, payload) => api.patch(`/leads/${id}/status`, payload),
};

export const analyticsApi = {
  overview: (params) => api.get("/analytics/overview", { params }),
  bySource: (params) => api.get("/analytics/by-source", { params }),
  funnel: (params) => api.get("/analytics/funnel", { params }),
  dropReasons: (params) => api.get("/analytics/drop-reasons", { params }),
  agentPerformance: (params) => api.get("/analytics/agent-performance", { params }),
};

export const uploadApi = {
  import: (formData) =>
    api.post("/upload/import", formData, { headers: { "Content-Type": "multipart/form-data" } }),
  exportUrl: "/api/upload/export",
};

export const matchedApi = {
  overview: (params) => api.get("/matched/analytics/overview", { params }),
  byUtmSource: (params) => api.get("/matched/analytics/by-utm-source", { params }),
  funnel: (params) => api.get("/matched/analytics/funnel", { params }),
  dropReasons: (params) => api.get("/matched/analytics/drop-reasons", { params }),
  list: (params) => api.get("/matched/leads", { params }),
  get: (phone, params) => api.get(`/matched/leads/${phone}`, { params }),
  syncStatus: () => api.get("/matched/sync/status"),
  syncNow: () => api.post("/matched/sync/run"),
  trials: (params) => api.get("/matched/trials", { params }),
  trial: (phone, params) => api.get(`/matched/trials/${phone}`, { params }),
};

export default api;
