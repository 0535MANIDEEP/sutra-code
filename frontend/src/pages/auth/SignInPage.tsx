import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SignInForm } from '../../types';
import toast from 'react-hot-toast';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { getLocalizedText } = useLanguage();
  
  const [formData, setFormData] = useState<SignInForm>({
    email: '',
    password: '',
    mfaCode: '',
    rememberMe: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn(formData);
      
      if (result.success) {
        toast.success('Successfully signed in!');
        navigate('/chat');
      } else if (result.error?.code === 'MFA_REQUIRED') {
        setShowMFA(true);
        toast('Please enter your MFA code');
      } else {
        toast.error(result.error?.message || 'Sign in failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">सू</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {getLocalizedText('signIn')}
          </h1>
          <p className="text-gray-600">
            Welcome back to your Socratic learning journey
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="input-primary"
                placeholder="your.email@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="input-primary"
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>

            {showMFA && (
              <div>
                <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-1">
                  MFA Code
                </label>
                <input
                  type="text"
                  id="mfaCode"
                  name="mfaCode"
                  value={formData.mfaCode}
                  onChange={handleInputChange}
                  className="input-primary"
                  placeholder="Enter 6-digit code"
                  disabled={isLoading}
                  maxLength={6}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isLoading}
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              
              <Link
                to="/auth/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-500"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                getLocalizedText('signIn')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link
                to="/auth/signup"
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                {getLocalizedText('signUp')}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Protected by DPDP Act 2023 compliance</p>
        </div>
      </div>
    </div>
  );
};