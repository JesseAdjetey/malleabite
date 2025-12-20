
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-background">
        <div className="relative">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse blur-xl"></div>
        </div>
        <p className="text-foreground/60 text-lg mt-4 animate-pulse">Loading your workspace...</p>
        
        {/* Orbital loading animation */}
        <div className="relative w-32 h-32 mt-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div 
              key={i}
              className="absolute top-1/2 left-1/2 rounded-full border border-primary/30"
              style={{
                width: `${(i + 1) * 40}px`,
                height: `${(i + 1) * 40}px`,
                marginLeft: `-${(i + 1) * 20}px`,
                marginTop: `-${(i + 1) * 20}px`,
                animation: `spin ${3 + i}s linear infinite`,
              }}
            >
              <div 
                className="absolute w-2 h-2 bg-primary rounded-full"
                style={{
                  left: '50%',
                  marginLeft: '-1px',
                  animation: `bounce ${2 + i}s ease-in-out infinite`,
                }}
              ></div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
