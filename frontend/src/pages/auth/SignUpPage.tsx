import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { SignUpForm } from '../../types';
import toast from 'react-hot-toast';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { getLocalizedText, currentLanguage } = useLanguage();
  
  const [formData, setFormData] = useState<SignUpForm>({
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    givenName: '',
    familyName: '',
    userRole: 'student',
    institutionName: '',
    preferredLanguage: currentLanguage.code,
    dataConsentGiven: false,
    aadhaarOptional: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!formData.dataConsentGiven) {
      toast.error('Data processing consent is required');
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp(formData);
      
      if (result.success) {
        toast.success('Account created successfully! Please check your email for verification.');
        navigate('/auth/signin');
      } else {
        toast.error(result.error?.message || 'Sign up failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">सू</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {getLocalizedText('signUp')}
          </h1>
          <p className="text-gray-600">
            Start your journey from copy-paste to problem-solver
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Information */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="givenName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  id="givenName"
                  name="givenName"
                  value={formData.givenName}
                  onChange={handleInputChange}
                  required
                  className="input-primary"
                  placeholder="Arjun"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="familyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="familyName"
                  name="familyName"
                  value={formData.familyName}
                  onChange={handleInputChange}
                  required
                  className="input-primary"
                  placeholder="Sharma"
                  disabled={isLoading}
                />
              </div>
            </div>

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
                placeholder="arjun.sharma@example.com"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                required
                className="input-primary"
                placeholder="+91 9876543210"
                disabled={isLoading}
              />
            </div>

            {/* Role Selection */}
            <div>
              <label htmlFor="userRole" className="block text-sm font-medium text-gray-700 mb-1">
                I am a
              </label>
              <select
                id="userRole"
                name="userRole"
                value={formData.userRole}
                onChange={handleInputChange}
                className="input-primary"
                disabled={isLoading}
              >
                <option value="student">Student</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </div>

            {formData.userRole === 'student' && (
              <div>
                <label htmlFor="institutionName" className="block text-sm font-medium text-gray-700 mb-1">
                  Institution Name (Optional)
                </label>
                <input
                  type="text"
                  id="institutionName"
                  name="institutionName"
                  value={formData.institutionName}
                  onChange={handleInputChange}
                  className="input-primary"
                  placeholder="IIT Delhi, NIT Trichy, etc."
                  disabled={isLoading}
                />
              </div>
            )}

            {/* Password */}
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
                placeholder="Minimum 12 characters"
                disabled={isLoading}
                minLength={12}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="input-primary"
                placeholder="Re-enter your password"
                disabled={isLoading}
              />
            </div>

            {/* Language Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Language
              </label>
              <div className="flex items-center space-x-2">
                <LanguageSelector />
                <span className="text-sm text-gray-500">
                  You can change this later
                </span>
              </div>
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  name="dataConsentGiven"
                  checked={formData.dataConsentGiven}
                  onChange={handleInputChange}
                  required
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-700">
                  I consent to the processing of my personal data under the{' '}
                  <Link to="/privacy" className="text-primary-600 hover:text-primary-500">
                    Digital Personal Data Protection Act 2023
                  </Link>
                  {' '}for educational purposes. <span className="text-red-500">*</span>
                </span>
              </label>

              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  name="aadhaarOptional"
                  checked={formData.aadhaarOptional}
                  onChange={handleInputChange}
                  className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-700">
                  I may provide Aadhaar details later for enhanced verification (optional)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.dataConsentGiven}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                getLocalizedText('signUp')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/auth/signin"
                className="text-primary-600 hover:text-primary-500 font-medium"
              >
                {getLocalizedText('signIn')}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Your data is protected under DPDP Act 2023</p>
        </div>
      </div>
    </div>
  );
};