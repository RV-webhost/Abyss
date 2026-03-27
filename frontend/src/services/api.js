// Change this if you ever deploy your backend to a real server!
const BASE_URL = "http://localhost:3000/api/v1";

const api = {
  async request(endpoint, options = {}) {
    // 1. Automatically grab the token
    const token = localStorage.getItem("abyss_token");
    
    // 2. Set up default headers
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // 3. Attach token if it exists
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      // We automatically parse the JSON here so you don't have to do it in your components
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
  }
};

export default api;