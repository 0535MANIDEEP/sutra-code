import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Components
import { AuthProvider } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages
import { SignInPage } from './pages/auth/SignInPage';
import { SignUpPage } from './pages/auth/SignUpPage';
import { ChatPage } from './pages/chat/ChatPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { ProgressPage } from './pages/progress/ProgressPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { RecruiterPage } from './pages/recruiter/RecruiterPage';

// Hooks
import { useAuth } from './hooks/useAuth';

// Services
import { authService } from './services/authService';
import { websocketService } from './services/websocketService';

// Styles
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/signin" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect to chat if authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" message="Loading..." />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
};

// Main App Component
const AppContent: React.FC = () => {
  return (
    <div className="App">
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/" 
          element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/auth/signin" 
          element={
            <PublicRoute>
              <SignInPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/auth/signup" 
          element={
            <PublicRoute>
              <SignUpPage />
            </PublicRoute>
          } 
        />

        {/* Protected Routes */}
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/progress" 
          element={
            <ProtectedRoute>
              <ProgressPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/recruiter" 
          element={
            <ProtectedRoute>
              <RecruiterPage />
            </ProtectedRoute>
          } 
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            border: '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};

// App with Providers
const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize app
    const initializeApp = async () => {
      try {
        // Check if user is already authenticated
        const user = authService.getCurrentUser();
        if (user && authService.isAuthenticated()) {
          // Connect to WebSocket for real-time features
          await websocketService.connect();
        }

        // Listen for session expiry
        const handleSessionExpired = () => {
          window.location.href = '/auth/signin';
        };

        const handleAuthRequired = () => {
          window.location.href = '/auth/signin';
        };

        window.addEventListener('sessionExpired', handleSessionExpired);
        window.addEventListener('authRequired', handleAuthRequired);

        setIsInitialized(true);

        // Cleanup
        return () => {
          window.removeEventListener('sessionExpired', handleSessionExpired);
          window.removeEventListener('authRequired', handleAuthRequired);
        };
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsInitialized(true); // Still show the app even if initialization fails
      }
    };

    initializeApp();
  }, []);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <div className="text-center">
          <div className="mb-4">
            <div className="w-16 h-16 mx-auto bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-2xl text-white font-bold">सू</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sutra-Code</h1>
          <p className="text-gray-600 mb-4">Socratic AI Mentor</p>
          <LoadingSpinner size="md" message="Initializing..." />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AuthProvider>
            <LanguageProvider>
              <ChatProvider>
                <AppContent />
              </ChatProvider>
            </LanguageProvider>
          </AuthProvider>
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;