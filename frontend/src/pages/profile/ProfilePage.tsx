import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { getLocalizedText } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {getLocalizedText('profile')}
          </h1>
          
          {user && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="text-gray-900 capitalize">{user.userRole}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Language</label>
                <p className="text-gray-900">{user.preferredLanguage}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Grit Score</label>
                <div className="flex items-center space-x-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${user.gritScore}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user.gritScore}/100
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Skill Level</label>
                <p className="text-gray-900">{user.skillLevel}/10</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};