import { Routes, Route, Navigate } from 'react-router-dom';
import Abyss from './pages/Abyss';
import Roadmap from './pages/Roadmap';
import Auth from './components/Auth';
import { useAuth } from './context/AuthContext';

// This wrapper checks for a token before rendering a page
const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();
  
  if (!token) {
    return <Auth />; // Show login screen if not authenticated
  }
  
  return children; // Show the actual page if authenticated
};

function App() {
  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Abyss />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/roadmap" 
        element={
          <ProtectedRoute>
            <Roadmap />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;