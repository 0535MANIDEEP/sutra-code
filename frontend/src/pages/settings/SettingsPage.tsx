import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { LanguageSelector } from '../../components/common/LanguageSelector';

export const SettingsPage: React.FC = () => {
  const { signOut } = useAuth();
  const { getLocalizedText } = useLanguage();

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {getLocalizedText('settings')}
          </h1>
          
          <div className="space-y-6">
            {/* Language Settings */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Language Preferences
              </h2>
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">
                  {getLocalizedText('preferredLanguage')}:
                </label>
                <LanguageSelector />
              </div>
            </div>

            {/* Account Actions */}
            <div className="pt-6 border-t border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 mb-3">
                Account
              </h2>
              <button
                onClick={handleSignOut}
                className="btn-outline text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
              >
                {getLocalizedText('signOut')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};