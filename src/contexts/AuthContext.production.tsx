// Production-ready AuthContext with proper user profile management
import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth, AuthContextType } from '@/hooks/use-auth-production';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Export for backward compatibility
export { useAuthContext as useAuth };
