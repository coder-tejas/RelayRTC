import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth-storage");
  if (token) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.state?.token) {
        config.headers.Authorization = `Bearer ${parsed.state.token}`;
      }
    } catch (error) {
      console.error("Error parsing auth token:", error);
    }
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401
      // Let components handle the redirect appropriately
      localStorage.removeItem("auth-storage");

      // Dispatch a custom event that components can listen to
      window.dispatchEvent(new CustomEvent("auth-logout"));
    }
    return Promise.reject(error);
  }
);

// Auth API functions
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post("/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),

  me: () => api.get("/auth/me"),
};

// Meeting API functions
export const meetingAPI = {
  create: (data: { title: string }) => api.post("/meetings/create", data),

  join: (meetingId: string) => api.post(`/meetings/join/${meetingId}`),

  get: (meetingId: string) => api.get(`/meetings/${meetingId}`),

  end: (meetingId: string) => api.post(`/meetings/end/${meetingId}`),

  getUserMeetings: () => api.get("/meetings/user/meetings"),
};

export default api;
