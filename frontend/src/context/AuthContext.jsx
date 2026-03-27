import { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("abyss_token") || null);

  const login = (newToken) => {
    localStorage.setItem("abyss_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("abyss_token");
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);