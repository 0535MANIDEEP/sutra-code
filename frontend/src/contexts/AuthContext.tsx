import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthUser, SignUpForm, SignInForm, ApiResponse } from '../types';
import { authService } from '../services/authService';
import { websocketService } from '../services/websocketService';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (credentials: SignInForm) => Promise<ApiResponse<AuthUser>>;
  signUp: (userData: SignUpForm) => Promise<ApiResponse<{ challengeName?: string }>>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const currentUser = authService.getCurrentUser();
        if (currentUser && authService.isAuthenticated()) {
          setUser(currentUser);
          // Connect to WebSocket for real-time features
          await websocketService.connect();
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for session expiry
    const handleSessionExpired = () => {
      setUser(null);
      websocketService.disconnect();
    };

    const handleAuthRequired = () => {
      setUser(null);
      websocketService.disconnect();
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    window.addEventListener('authRequired', handleAuthRequired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
      window.removeEventListener('authRequired', handleAuthRequired);
    };
  }, []);

  const signIn = async (credentials: SignInForm): Promise<ApiResponse<AuthUser>> => {
    setIsLoading(true);
    try {
      const result = await authService.signIn(credentials);
      if (result.success && result.data) {
        setUser(result.data);
        // Connect to WebSocket after successful sign in
        await websocketService.connect();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (userData: SignUpForm): Promise<ApiResponse<{ challengeName?: string }>> => {
    setIsLoading(true);
    try {
      return await authService.signUp(userData);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setUser(null);
      websocketService.disconnect();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const success = await authService.refreshToken();
      if (success) {
        const updatedUser = authService.getCurrentUser();
        setUser(updatedUser);
      } else {
        setUser(null);
        websocketService.disconnect();
      }
      return success;
    } catch (error) {
      console.error('Token refresh failed:', error);
      setUser(null);
      websocketService.disconnect();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && authService.isAuthenticated(),
    signIn,
    signUp,
    signOut,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};