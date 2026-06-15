import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from '../services/api';

function Auth() {
  const [isLoginView, setIsLoginView] = useState(true);
  
  // 🚨 FIX: Added name state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const endpoint = isLoginView ? "/auth/login" : "/auth/register";
    
    // 🚨 FIX: Dynamically build the payload based on the view
    const payload = isLoginView 
      ? { email, password } 
      : { name, email, password };

    try {
      const data = await api.post(endpoint, payload);

      if (data.success && data.token) {
        login(data.token); 
      } else {
        alert(data.message || "Authentication failed");
      }
    } catch (err) {
      console.log("Auth error:", err);
      // Fallback alert if the server throws a 400/500
      alert(err.response?.data?.message || "Server error during authentication");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-950 h-screen flex items-center justify-center font-sans text-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 p-10 rounded-2xl border border-gray-800 w-96 flex flex-col gap-5 shadow-2xl"
      >
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black text-red-600 tracking-tighter mb-2">ABYSS.</h1>
          <h2 className="text-gray-400 text-sm">
            {isLoginView ? "Welcome back, Developer." : "Join the Abyss."}
          </h2>
        </div>

        {/* 🚨 FIX: Only show the Name input if the user is registering */}
        {!isLoginView && (
            <input
              type="text"
              placeholder="Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-red-500 transition"
            />
        )}

        <input
          type="email"
          placeholder="Email Address"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-red-500 transition"
        />

        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-white focus:outline-none focus:border-red-500 transition"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl mt-2 transition shadow-lg shadow-red-500/20 disabled:opacity-50"
        >
          {isLoading ? "Authenticating..." : isLoginView ? "Login" : "Register"}
        </button>

        <button
          type="button"
          onClick={() => setIsLoginView(!isLoginView)}
          className="text-sm text-gray-500 hover:text-white mt-2 transition"
        >
          {isLoginView ? "Need an account? Register" : "Have an account? Login"}
        </button>
      </form>
    </div>
  );
}

export default Auth;