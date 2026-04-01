// src/services/api.js
const ROOT_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const BASE_URL = `${ROOT_URL.replace(/\/$/, "")}/api/v1`;

const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("abyss_token");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;

    const config = { ...options, headers };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      return await response.json(); 
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  },

  get(endpoint, options) {
    return this.request(endpoint, { method: "GET", ...options });
  },

  post(endpoint, body, options) {
    return this.request(endpoint, { method: "POST", body: JSON.stringify(body), ...options });
  },

  delete(endpoint, options) {
    return this.request(endpoint, { method: "DELETE", ...options });
  },

  // 🚨 THE NEW UPGRADE: A dedicated method for reading Server-Sent Events (Streams)
  stream(endpoint, body, options = {}) {
    const token = localStorage.getItem("abyss_token");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) headers["Authorization"] = `Bearer ${token}`;

    // Notice we DO NOT await response.json() here. We return the raw fetch Promise.
    return fetch(`${BASE_URL}${endpoint}`, { 
      method: "POST", 
      headers,
      body: JSON.stringify(body), 
      ...options 
    });
  }
};

export default api;