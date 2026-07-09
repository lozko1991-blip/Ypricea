import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Catalog from './pages/Catalog';
import Cabinet from './pages/Cabinet';
import AuthPage from './pages/AuthPage';

import Landing from './pages/Landing';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex justify-center p-12 text-[var(--text2)] font-bold">Завантаження...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  
  return <>{children}</>;
};

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        
        <Route element={<Layout />}>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route 
            path="/cabinet" 
            element={
              <ProtectedRoute>
                <Cabinet />
              </ProtectedRoute>
            } 
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
